const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseChatReply, answerChat, CHAT_SYSTEM_PROMPT } = require("../src/reports/chat");
const { parseReportReply } = require("../src/reports/analyze");
const { numbersAreGrounded } = require("../src/reports/responseChecks");

const report = { kind: "text", text: "SYNTHETIC CRP REPORT: Initial 20 mg/L. Later 1.8 mg/dL. No reference range supplied." };
const chat = (answer, options = {}) => parseChatReply(JSON.stringify({ answer, evidence: [], ...options }), { report });
const rejected = (answer, code = "unsafe_response") => assert.throws(() => parseChatReply(JSON.stringify({ answer, evidence: [] })), (error) => error.code === code);

for (const answer of [
  "You have anemia.", "Based on your results, you have diabetes.", "Your symptoms are caused by cancer.", "You have no cancer.",
  "Take 40 mg of ExampleDrug every day.", "You should take 0.5 mg of ExampleDrug.", "Please take one tablet.", "I recommend you take two pills daily.",
  "Increase your dose to 10 mg.", "تناول ٤٠ ملغ يوميا.", "خذ جرعة يومية من الدواء.", "عليك تناول ٤٠ ملغ يوميا.", "أنت مصاب بفقر الدم.",
]) test(`chat blocks a direct diagnosis or personal regimen: ${answer}`, () => rejected(answer));

for (const answer of [
  "I cannot determine whether you have anemia from this result alone.",
  "If you have diabetes, ask your clinician how this result relates to your existing care plan.",
  "You have not provided a report, so I cannot quote a result.",
  "You have described tiredness; several explanations are possible.",
  "Do not change your dose based on this explanation; ask your clinician.",
  "Hemoglobin is a protein in red blood cells that carries oxygen.",
  "لا يمكن تحديد التشخيص من هذه المعلومات وحدها.",
]) test(`chat keeps an educational or uncertainty statement: ${answer}`, () => {
  assert.equal(parseChatReply(JSON.stringify({ answer, evidence: [] })).answer, answer);
});

test("a quoted medication strength is not treated as a personal dosing instruction", () => {
  const medicationReport = { kind: "text", text: "The report lists ExampleDrug 40 mg. It does not specify a schedule." };
  const result = parseChatReply(JSON.stringify({ answer: "The report lists ExampleDrug 40 mg; it does not specify a schedule. Ask the clinician to confirm your instructions.", evidence: ["ExampleDrug 40 mg"] }), { report: medicationReport });
  assert.match(result.answer, /40 mg/);
});

test("explicit verified conversion is delivered without allowing arbitrary new values", () => {
  assert.match(chat("The later 1.8 mg/dL equals 18 mg/L, which is lower than the initial 20 mg/L.").answer, /18 mg\/L/);
  assert.match(chat("18 mg/L = 1.8 mg/dL.").answer, /18 mg\/L/);
  for (const answer of [
    "1.8 mg/dL equals 180 mg/L.",
    "1.8 mg/dL equals 18 mmol/L.",
    "Your result is 18 mg/L.",
    "1.8 mg/dL equals 18 mg/L. Your reference range is 18 to 20 mg/L.",
    "1.8 mg/dL equals 18 mg/L. The earlier result was 42 mg/L.",
    "3 mg/dL equals 30 mg/L.",
  ]) assert.throws(() => chat(answer), (error) => error.code === "unsupported_quote", answer);
});

test("normalizes numeric formatting and Arabic digits without dropping the source check", () => {
  assert.equal(numbersAreGrounded("12 mg/L", "12.0 mg/L"), true);
  assert.equal(numbersAreGrounded("١٫٨ mg/dL يساوي ١٨ mg/L", report.text, { allowConversions: true }), true);
  assert.equal(numbersAreGrounded("١٫٨ mg/dL يساوي ١٨٠ mg/L", report.text, { allowConversions: true }), false);
});

test("fabricated evidence stays blocked even when the unit conversion is correct", () => {
  assert.throws(() => chat("1.8 mg/dL equals 18 mg/L.", { evidence: ["Later 18 mg/L"] }), (error) => error.code === "unsupported_quote");
});

test("overlong answers are rejected rather than cutting away qualifications or next steps", () => {
  rejected("A".repeat(1801), "invalid_response");
});

const analysis = () => ({ documentType: "written_report", urgency: "routine", summary: "The report contains CRP measurements.", findings: [{ name: "CRP", sourceQuote: "Later 1.8 mg/dL", result: "1.8 mg/dL", reference: "Not provided", explanation: "CRP is a marker of inflammation.", followUp: "Review the complete report with the ordering clinician." }], nextStep: "Ask the ordering clinician to review the full report.", uncertainties: ["The report supplies no reference range."] });

test("report explanations reject direct treatment instructions but retain quoted values", () => {
  const value = analysis();
  assert.equal(parseReportReply(JSON.stringify(value), { reportText: report.text }).findings[0].result, "1.8 mg/dL");
  value.findings[0].followUp = "Take 40 mg of ExampleDrug daily.";
  assert.throws(() => parseReportReply(JSON.stringify(value), { reportText: report.text }), (error) => error.code === "unsafe_response");
});

test("report explanations allow checked conversions but result and reference fields stay source-only", () => {
  const value = analysis();
  value.findings[0].explanation = "1.8 mg/dL equals 18 mg/L.";
  assert.equal(parseReportReply(JSON.stringify(value), { reportText: report.text }).findings[0].explanation, value.findings[0].explanation);
  value.findings[0].reference = "Reference range 18 to 20 mg/L";
  assert.throws(() => parseReportReply(JSON.stringify(value), { reportText: report.text }), (error) => error.code === "unsupported_quote");
});

test("the chat requests a supported higher reasoning effort and explicitly bounds available context", async () => {
  let settings;
  const result = await answerChat({ question: "What does hemoglobin do?", client: { complete: async (messages, options) => {
    settings = options;
    return JSON.stringify({ answer: "Hemoglobin carries oxygen in red blood cells.", evidence: [] });
  } } });
  assert.match(result.answer, /oxygen/);
  assert.equal(settings.reasoningEffort, "medium");
  assert.match(CHAT_SYSTEM_PROMPT, /Prior assistant replies are unverified/);
});

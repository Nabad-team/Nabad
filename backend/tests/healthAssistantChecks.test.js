const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseChatReply, answerChat, CHAT_SYSTEM_PROMPT } = require("../src/reports/chat");
const { analyzeReport, parseReportReply } = require("../src/reports/analyze");
const { numbersAreGrounded } = require("../src/reports/responseChecks");
const { LlmError } = require("../src/triage/ai/llmClient");

const report = { kind: "text", text: "SYNTHETIC CRP REPORT: Initial 20 mg/L. Later 1.8 mg/dL. No reference range supplied." };
const chat = (answer, options = {}) => parseChatReply(JSON.stringify({ answer, evidence: [], ...options }), { report });
const rejected = (answer, code = "unsafe_response") => assert.throws(() => parseChatReply(JSON.stringify({ answer, evidence: [] })), (error) => error.code === code);

for (const answer of [
  "You have anemia.", "Based on your results, you have diabetes.", "Your symptoms are caused by cancer.", "You have no cancer.",
  "Take 40 mg of ExampleDrug every day.", "You should take 0.5 mg of ExampleDrug.", "Please take one tablet.", "I recommend you take two pills daily.",
  "Increase your dose to 10 mg.",
]) test(`chat blocks a direct diagnosis or personal regimen: ${answer}`, () => rejected(answer));

for (const answer of [
  "I cannot determine whether you have anemia from this result alone.",
  "If you have diabetes, ask your clinician how this result relates to your existing care plan.",
  "You have not provided a report, so I cannot quote a result.",
  "You have described tiredness; several explanations are possible.",
  "Do not change your dose based on this explanation; ask your clinician.",
  "Hemoglobin is a protein in red blood cells that carries oxygen.",
]) test(`chat keeps an educational or uncertainty statement: ${answer}`, () => {
  assert.equal(parseChatReply(JSON.stringify({ answer, evidence: [] })).answer, answer);
});

test("the English-only assistant rejects non-English input and output", async () => {
  await assert.rejects(answerChat({ question: "هل يمكنك شرح هذا؟", client: { complete: async () => "" } }), (error) => error.code === "invalid_language");
  assert.throws(() => parseChatReply(JSON.stringify({ answer: "لا يمكن تحديد التشخيص.", evidence: [] })), (error) => error.code === "non_english_response");
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

test("each report finding's quote must support that finding's result", () => {
  const value = analysis();
  value.findings[0].sourceQuote = "Initial 20 mg/L";
  value.findings[0].result = "1.8 mg/dL";
  assert.throws(() => parseReportReply(JSON.stringify(value), { reportText: report.text }), (error) => error.code === "unsupported_quote");
});

test("duplicate report findings are rejected", () => {
  const value = analysis();
  value.findings.push({ ...value.findings[0] });
  assert.throws(() => parseReportReply(JSON.stringify(value), { reportText: report.text }), (error) => error.code === "invalid_response");
});

for (const [reason, rejectedReply] of [
  ["unsafe_response", (() => { const value = analysis(); value.findings[0].explanation = "This may be caused by an infection."; return JSON.stringify(value); })()],
  ["unsupported_quote", (() => { const value = analysis(); value.findings[0].sourceQuote = "Invented CRP 1.8 mg/dL"; return JSON.stringify(value); })()],
  ["invalid_response", "not JSON"],
]) test(`report analysis regenerates once after ${reason}`, async () => {
  const calls = [];
  const accepted = JSON.stringify(analysis());
  const result = await analyzeReport({ report, client: { complete: async (messages, options) => {
    calls.push({ messages, options });
    return calls.length === 1 ? rejectedReply : accepted;
  } } });
  assert.equal(result.findings[0].result, "1.8 mg/dL");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].options, calls[0].options);
  assert.deepEqual(calls[1].messages.slice(1), calls[0].messages.slice(1));
  assert.match(calls[1].messages[0].content, /previous generation failed/i);
  assert.ok(!JSON.stringify(calls[1].messages).includes(rejectedReply));
});

test("a second invalid report analysis stays blocked", async () => {
  let calls = 0;
  await assert.rejects(analyzeReport({ report, client: { complete: async () => {
    calls += 1;
    return "not JSON";
  } } }), (error) => error.code === "invalid_response");
  assert.equal(calls, 2);
});

test("report explanations reject broad reassurance, speculative causes and ungrounded supplements", () => {
  for (const mutate of [
    (value) => { value.summary = "Most values are within the normal range, with minor deviations."; },
    (value) => { value.findings[0].explanation = "This may be associated with a recent viral infection."; },
    (value) => { value.findings[0].followUp = "Ask whether supplementation is needed."; },
  ]) {
    const value = analysis();
    mutate(value);
    assert.throws(() => parseReportReply(JSON.stringify(value), { reportText: report.text }), (error) => error.code === "unsafe_response");
  }
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
  assert.match(CHAT_SYSTEM_PROMPT, /warm, generous with useful explanation/);
  assert.match(CHAT_SYSTEM_PROMPT, /false reassurance/);
  assert.match(CHAT_SYSTEM_PROMPT, /For emergencies, put the action first/);
});

for (const [reason, rejectedReply] of [
  ["unsafe_response", JSON.stringify({ answer: "You have dehydration. Take 40 mg of ExampleDrug daily.", evidence: [] })],
  ["unsupported_quote", JSON.stringify({ answer: "The report describes a measurement.", evidence: ["Invented report quotation"] })],
  ["invalid_response", "not a JSON response"],
]) test(`chat regenerates once after ${reason} and validates the replacement`, async () => {
  const calls = [];
  const answer = "Dizziness has several possible explanations; I cannot determine the cause here. Avoid driving while dizzy. Seek urgent care for severe or worsening symptoms. How long has it lasted?";
  const result = await answerChat({
    question: "im feeling a little dizzy today, what can i do?",
    history: [{ role: "user", content: "I am asking about dizziness." }],
    report,
    client: { complete: async (messages, options) => {
      calls.push({ messages, options });
      return calls.length === 1 ? rejectedReply : JSON.stringify({ answer, evidence: [] });
    } },
  });
  assert.equal(result.answer, answer);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].options, calls[0].options);
  assert.deepEqual(calls[1].messages.slice(1), calls[0].messages.slice(1));
  assert.match(calls[1].messages[0].content, /previous generation failed/);
  assert.doesNotMatch(calls[0].messages[0].content, /previous generation failed/);
  assert.ok(!JSON.stringify(calls[1].messages).includes(rejectedReply));
});

test("a second unsafe answer stays blocked and does not trigger more requests", async () => {
  let calls = 0;
  await assert.rejects(answerChat({ question: "What could explain my symptoms?", client: { complete: async () => {
    calls += 1;
    return JSON.stringify({ answer: "You have anemia.", evidence: [] });
  } } }), (error) => error.code === "unsafe_response");
  assert.equal(calls, 2);
});

test("an ungrounded replacement stays blocked", async () => {
  let calls = 0;
  await assert.rejects(answerChat({ question: "Explain this report.", report, client: { complete: async () => {
    calls += 1;
    return calls === 1 ? "invalid JSON" : JSON.stringify({ answer: "The result is 999 mg/L.", evidence: [] });
  } } }), (error) => error.code === "unsupported_quote");
  assert.equal(calls, 2);
});

for (const failureAt of [1, 2]) test(`provider errors on request ${failureAt} are not retried or hidden`, async () => {
  let calls = 0;
  await assert.rejects(answerChat({ question: "Explain dizziness.", client: { complete: async () => {
    calls += 1;
    if (calls === failureAt) throw new LlmError("http_error", 429);
    return "invalid JSON";
  } } }), (error) => error.code === "provider_unavailable" && error.providerFailure.status === 429);
  assert.equal(calls, failureAt);
});

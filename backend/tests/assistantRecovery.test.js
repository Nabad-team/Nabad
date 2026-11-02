const { test } = require("node:test");
const assert = require("node:assert/strict");
const { answerChat } = require("../src/reports/chat");
const { analyzeReport } = require("../src/reports/analyze");
const { createLlmClient, readLlmConfig } = require("../src/triage/ai/llmClient");

const report = { kind: "text", text: "SYNTHETIC REPORT: Hemoglobin 13.5 g/dL. Reference range 12-16 g/dL. No abnormal flag is supplied." };
const validChat = { answer: "Hemoglobin carries oxygen in red blood cells.", evidence: [] };
const validAnalysis = {
  documentType: "written_report", urgency: "routine", summary: "The report lists a hemoglobin measurement.",
  findings: [{ name: "Hemoglobin", category: "unclear", sourceQuote: "Hemoglobin 13.5 g/dL", result: "13.5 g/dL", reference: "12-16 g/dL", explanation: "Hemoglobin carries oxygen in red blood cells.", followUp: "Review the report with the ordering clinician." }],
  nextStep: "Review the complete report with the ordering clinician.", uncertainties: ["The report does not state a cause."],
};

function provider(responses) {
  const requests = [];
  const client = createLlmClient(readLlmConfig({ LLM_API_URL: "https://example.test/v1", LLM_MODEL: "gemini-3-flash-preview" }), async (url, options) => {
    requests.push(JSON.parse(options.body));
    assert.ok(requests.length <= responses.length, "unexpected extra provider request");
    const response = responses[requests.length - 1];
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: response.content }, finish_reason: response.finish }] }) };
  });
  return { client, requests };
}

for (const mode of ["chat", "report"]) {
  const run = client => mode === "chat" ? answerChat({ question: "What does hemoglobin do?", client, retriever: null })
    : analyzeReport({ report, question: "Explain the report.", client });
  const accepted = JSON.stringify(mode === "chat" ? validChat : validAnalysis);

  test(`${mode} recovers an empty token-exhausted response using the original context`, async () => {
    const { client, requests } = provider([{ content: null, finish: "length" }, { content: accepted, finish: "stop" }]);
    const result = await run(client);
    assert.equal(mode === "chat" ? result.answer : result.summary, mode === "chat" ? validChat.answer : validAnalysis.summary);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1].messages, requests[0].messages);
    assert.ok(requests[1].max_tokens > requests[0].max_tokens);
  });

  test(`${mode} does not deliver partial JSON or exceed two attempts after repeated truncation`, async () => {
    const { client, requests } = provider([{ content: accepted, finish: "length" }, { content: accepted, finish: "length" }]);
    await assert.rejects(run(client), error => error.providerFailure?.code === "incomplete_response");
    assert.equal(requests.length, 2);
  });

  test(`${mode} still rejects an unsafe replacement after a truncated response`, async () => {
    const unsafe = mode === "chat" ? { ...validChat, answer: "You have anemia." } : { ...validAnalysis, summary: "You have anemia." };
    const { client, requests } = provider([{ content: null, finish: "length" }, { content: JSON.stringify(unsafe), finish: "stop" }]);
    await assert.rejects(run(client), error => error.code === "unsafe_response");
    assert.equal(requests.length, 2);
  });

  test(`${mode} shares the attempt limit between validation failure and truncation`, async () => {
    const { client, requests } = provider([{ content: "not JSON", finish: "stop" }, { content: null, finish: "length" }]);
    await assert.rejects(run(client), error => error.providerFailure?.code === "incomplete_response");
    assert.equal(requests.length, 2);
  });

  test(`${mode} does not retry a provider safety refusal`, async () => {
    const { client, requests } = provider([{ content: "Private provider response", finish: "content_filter" }]);
    await assert.rejects(run(client), error => error.providerFailure?.code === "provider_blocked" && !/Private/.test(error.message));
    assert.equal(requests.length, 1);
  });
}

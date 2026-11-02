const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const runFile = promisify(execFile);
const script = path.join(__dirname, "../scripts/check-ai.cjs");
const env = { ...process.env, LLM_API_URL: "https://private-endpoint.example.test/v1", LLM_MODEL: "test-model", LLM_PROVIDER: "openai-compatible", LLM_API_KEY: "private-test-api-key", RAG_ENABLED: "false" };
const outputLines = text => text.trim().split(/\r?\n/).map(line => JSON.parse(line));

test("configuration check identifies missing settings without calling the provider", async () => {
  let failure;
  try { await runFile(process.execPath, [script], { env: { ...env, LLM_API_URL: "", LLM_MODEL: "" } }); } catch (error) { failure = error; }
  assert.equal(failure.code, 1);
  assert.deepEqual(outputLines(failure.stdout)[0], { check: "configuration", configured: false, problem: "not_configured", missingVariables: ["LLM_API_URL", "LLM_MODEL"] });
});

test("configuration metadata does not expose endpoint or key", async () => {
  const result = await runFile(process.execPath, [script], { env });
  assert.equal(outputLines(result.stdout)[0].hasApiKey, true);
  assert.doesNotMatch(result.stdout, /private-endpoint|private-test-api-key/);
});

test("live diagnostics exercise both validated services without printing generated content", async () => {
  let calls = 0;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      calls += 1;
      const messages = JSON.parse(body).messages;
      const report = messages[0].content.includes("medical-report explainer");
      const answer = report ? {
        documentType: "written_report", urgency: "routine", summary: "The report lists a hemoglobin measurement.",
        findings: [{ name: "Hemoglobin", category: "unclear", sourceQuote: "Hemoglobin: 13.5 g/dL", result: "13.5 g/dL", reference: "12-16 g/dL", explanation: "Hemoglobin carries oxygen.", followUp: "Review with the ordering clinician." }],
        nextStep: "Review with the ordering clinician.", uncertainties: [],
      } : { answer: "Hemoglobin carries oxygen in red blood cells.", evidence: [] };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }] }));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const result = await runFile(process.execPath, [script, "--live"], { env: { ...env, LLM_API_URL: `http://127.0.0.1:${server.address().port}/v1` } });
    const [, chat, report] = outputLines(result.stdout);
    assert.equal(chat.check, "chat"); assert.equal(chat.status, "passed");
    assert.equal(report.check, "report"); assert.equal(report.status, "passed");
    assert.equal(calls, 2);
    assert.doesNotMatch(result.stdout, /carries oxygen|13\.5|private-test-api-key/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("live diagnostics report only safe provider codes and stop after an outage", async () => {
  let calls = 0;
  const server = http.createServer((req, res) => {
    calls += 1;
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "private provider text and private-test-api-key" }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    let failure;
    try { await runFile(process.execPath, [script, "--live"], { env: { ...env, LLM_API_URL: `http://127.0.0.1:${server.address().port}/v1` } }); } catch (error) { failure = error; }
    assert.equal(failure.code, 1);
    const [, probe] = outputLines(failure.stdout);
    assert.equal(probe.check, "chat");
    assert.equal(probe.reason, "unavailable");
    assert.equal(probe.providerCode, "http_error");
    assert.equal(probe.httpStatus, 503);
    assert.equal(calls, 1);
    assert.doesNotMatch(failure.stdout, /private provider text|private-test-api-key/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

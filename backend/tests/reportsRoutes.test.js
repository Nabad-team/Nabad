const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");
const ReportConversation = require("../src/models/ReportConversation");

const provider = { content: "", requests: [] };
function startFakeProvider() {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      provider.requests.push(JSON.parse(body || "{}"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: provider.content } }] }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function makeSamplePdf() {
  const stream = "BT /F1 12 Tf 50 750 Td (CBC Lab Report: Hemoglobin 13.5 g/dL, reference range 12.0-15.5 g/dL. Mildly low WBC 3.2 K/uL.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf).toString("base64");
}

describe("POST /api/reports routes", () => {
  let mongod, server, fakeProvider, base, token;
  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    mongod = await createTestMongo();
    process.env.MONGO_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all([User.init(), ReportConversation.init()]);
    const account = await User.create({ name: "Leen", email: "leen-report@example.test", passwordHash: "x" });
    token = jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
    fakeProvider = await startFakeProvider();
    const { createApp } = require("../src/app");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/reports`;
  }, { timeout: 240000 });
  after(async () => {
    for (const key of ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"]) delete process.env[key];
    if (server) await new Promise((resolve) => server.close(resolve));
    if (fakeProvider) await new Promise((resolve) => fakeProvider.close(resolve));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });
  beforeEach(async () => {
    process.env.LLM_API_URL = `http://127.0.0.1:${fakeProvider.address().port}/v1`;
    process.env.LLM_API_KEY = "fake-provider-key";
    process.env.LLM_MODEL = "fake-model";
    provider.requests = [];
    await ReportConversation.deleteMany({});
  });
  async function call(path, body) {
    const response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${token}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  // Without it, PDF analysis answers 503 "not configured" and the test below fails without saying why.
  test("the PDF reader (pdfjs-dist) is installed and loads", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs").catch((error) => {
      assert.fail(`pdfjs-dist could not be loaded (${error.code || error.name}). node_modules is probably older than package.json: run npm ci in backend/.`);
    });
    assert.equal(typeof pdfjs.getDocument, "function");
  });

  test("analyzes a sample PDF with lab values and a reference range", async () => {
    provider.content = JSON.stringify({
      documentType: "written_report", urgency: "routine", summary: "The report includes blood count results.",
      findings: [{ name: "Hemoglobin", sourceQuote: "Hemoglobin 13.5 g/dL", result: "13.5 g/dL", reference: "12.0-15.5 g/dL", explanation: "This is the reported hemoglobin value.", followUp: "Ask the ordering clinician to review the complete report." }],
      nextStep: "Please have the ordering clinician review the complete report.", uncertainties: [],
    });
    const res = await call("analyze", { consent: true, question: "What does this CBC report say?", file: { mimeType: "application/pdf", extension: "pdf", data: makeSamplePdf() } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.findings[0].result, "13.5 g/dL");
    assert.equal(res.body.findings[0].reference, "12.0-15.5 g/dL");
    assert.ok(res.body.conversationId);
    assert.equal(provider.requests.length, 1);

    const saved = await fetch(`${base}/conversations?profileId=self`, { headers: { Cookie: `accessToken=${token}` } });
    const history = await saved.json();
    assert.equal(history.conversations.length, 1);
    assert.match(history.conversations[0].messages[0].content, /CBC report/);
    assert.match(history.conversations[0].reportResult.summary, /blood count/);

    const outsider = await User.create({ name: "Other", email: `other-report-${Date.now()}@example.test`, passwordHash: "x" });
    const outsiderToken = jwt.sign({ sub: String(outsider._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const privateHistoryResponse = await fetch(`${base}/conversations?profileId=self`, { headers: { Cookie: `accessToken=${outsiderToken}` } });
    assert.deepEqual((await privateHistoryResponse.json()).conversations, []);
  });

  test("answers a chat question about a lab value", async () => {
    provider.content = JSON.stringify({ answer: "Hemoglobin is a protein in red blood cells. Your report lists 13.5 g/dL with a reference range of 12.0-15.5 g/dL; ask your clinician what it means for you.", evidence: ["Hemoglobin 13.5 g/dL, reference range 12.0-15.5 g/dL"] });
    const reportText = "CBC laboratory report dated 2026-10-10. Hemoglobin 13.5 g/dL, reference range 12.0-15.5 g/dL. Please consult your ordering clinician for interpretation.";
    const res = await call("chat", {
      consent: true,
      question: "What does my hemoglobin value mean?",
      file: { mimeType: "text/plain", extension: "txt", data: Buffer.from(reportText).toString("base64") },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.match(res.body.answer, /13\.5 g\/dL/);
    assert.deepEqual(res.body.evidence, ["Hemoglobin 13.5 g/dL, reference range 12.0-15.5 g/dL"]);
    assert.ok(res.body.conversationId);
    assert.equal(provider.requests.length, 1);
  });

  test("saves chat turns, uses saved history on follow-up, and allows deletion", async () => {
    provider.content = JSON.stringify({ answer: "Hemoglobin carries oxygen in the blood.", evidence: [] });
    const first = await call("chat", { consent: true, question: "What does hemoglobin do?" });
    assert.equal(first.status, 200);

    provider.content = JSON.stringify({ answer: "Your earlier question was about hemoglobin.", evidence: [] });
    const second = await call("chat", { consent: true, question: "Can you explain my earlier question?", conversationId: first.body.conversationId });
    assert.equal(second.status, 200);
    assert.match(provider.requests[1].messages[1].content[0].text, /What does hemoglobin do/);

    const saved = await fetch(`${base}/conversations?profileId=self`, { headers: { Cookie: `accessToken=${token}` } });
    const history = await saved.json();
    assert.equal(history.conversations.length, 1);
    assert.equal(history.conversations[0].messages.length, 4);

    const deleted = await fetch(`${base}/conversations/${first.body.conversationId}?profileId=self`, {
      method: "DELETE", headers: { Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${token}` },
    });
    assert.equal(deleted.status, 204);
    assert.equal(await ReportConversation.countDocuments(), 0);
  });

  test("continues a saved chat when an earlier assistant reply exceeds the history context limit", async () => {
    provider.content = JSON.stringify({ answer: "A".repeat(1300), evidence: [] });
    const first = await call("chat", { consent: true, question: "What should I know about this?" });
    assert.equal(first.status, 200, JSON.stringify(first.body));

    provider.content = JSON.stringify({ answer: "Here is the follow-up answer.", evidence: [] });
    const second = await call("chat", {
      consent: true,
      question: "Can you explain that further?",
      conversationId: first.body.conversationId,
    });
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(second.body.answer, "Here is the follow-up answer.");
    assert.equal(provider.requests.length, 2);
  });
});

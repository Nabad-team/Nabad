// SCRUM-280 over HTTP: POST /api/triage/ai-assess asks follow-up questions one round at a time, at most 3.
// A small local HTTP server stands in for the model provider (as in aiTriageEndpoint.test.js) and answers
// with whatever question id each test wants.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");

const provider = { reply: () => ({}), requests: [] };
function startFakeProvider() {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const request = JSON.parse(body || "{}");
      provider.requests.push(request);
      const content = JSON.stringify({ level: "soon", reasons: ["A fever should be checked by a doctor."], careType: "General practitioner", selfCare: [], ...provider.reply(request) });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
// The ids offered in a request to the model, in order.
const offered = (request) => [...request.messages[1].content.matchAll(/^- "([a-z0-9-]+)":/gm)].map((m) => m[1]);

describe("POST /api/triage/ai-assess, follow-up rounds (SCRUM-280)", () => {
  let mongod, server, fakeProvider, base;
  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    mongod = await createTestMongo();
    process.env.MONGO_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    await User.init();
    fakeProvider = await startFakeProvider();
    const { createApp } = require("../src/app");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/triage/ai-assess`;
  }, { timeout: 240000 });
  after(async () => {
    for (const key of ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"]) delete process.env[key];
    if (server) await new Promise((resolve) => server.close(resolve));
    if (fakeProvider) await new Promise((resolve) => fakeProvider.close(resolve));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });
  beforeEach(() => {
    process.env.LLM_API_URL = `http://127.0.0.1:${fakeProvider.address().port}/v1`;
    process.env.LLM_API_KEY = "fake-provider-key";
    process.env.LLM_MODEL = "fake-model";
    provider.requests = [];
    provider.reply = (request) => ({ nextQuestionId: offered(request)[0] ?? null });
  });

  let counter = 0;
  async function signedIn() {
    counter += 1;
    const user = await User.create({ name: "Rana", email: `rana-rounds-${counter}@example.test`, passwordHash: "x" });
    return jwt.sign({ sub: String(user._id), ver: user.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  }
  async function call(cookie, body) {
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${cookie}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  test("one question per round, every answer sent back, at most 3 rounds", async () => {
    const cookie = await signedIn();
    const symptoms = "I have a fever";
    let res = await call(cookie, { symptoms, checkId: "c1" });
    const answers = {};
    const rounds = [];
    while (res.body.followUpQuestions.length > 0) {
      assert.equal(res.status, 200);
      assert.equal(res.body.followUpQuestions.length, 1);
      assert.equal(res.body.followUpState.oneAtATime, true);
      const [question] = res.body.followUpQuestions;
      rounds.push(question.id);
      answers[question.id] = question.options[0].value;
      res = await call(cookie, { symptoms, answers: { ...answers }, followUpState: res.body.followUpState, checkId: "c1" });
    }
    assert.deepEqual(rounds, ["fever-temperature", "risk-group", "severity"]);
    assert.equal(res.body.followUpState.decision, "max_rounds");
    assert.equal(provider.requests.length, 4, "the first check and one per answered round");
    assert.match(provider.requests[2].messages[1].content, /Follow-up round 3 of at most 3/);
  });

  test("stops when the model is confident", async () => {
    provider.reply = () => ({ nextQuestionId: null });
    const res = await call(await signedIn(), { symptoms: "I have a fever" });
    assert.deepEqual(res.body.followUpQuestions, []);
    assert.equal(res.body.followUpState.decision, "model_confident");
  });

  test("a made-up question id from the model is never shown", async () => {
    provider.reply = () => ({ nextQuestionId: "what-medicines-do-you-take" });
    const res = await call(await signedIn(), { symptoms: "I have a fever" });
    assert.deepEqual(res.body.followUpQuestions.map((q) => q.id), ["fever-temperature"]);
    assert.equal(res.body.followUpState.decision, "model_pick_invalid");
  });

  test("with the AI off, all the questions come at once, as before", async () => {
    for (const key of ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"]) delete process.env[key];
    const res = await call(await signedIn(), { symptoms: "I have a fever" });
    assert.deepEqual(res.body.followUpQuestions.map((q) => q.id), ["fever-temperature", "risk-group", "severity", "duration", "trend"]);
    assert.equal(res.body.followUpState.oneAtATime, false);
  });

  test("invalid answers are still refused", async () => {
    const cookie = await signedIn();
    const first = await call(cookie, { symptoms: "I have a fever" });
    const res = await call(cookie, { symptoms: "I have a fever", answers: { "fever-temperature": "hot" }, followUpState: first.body.followUpState });
    assert.equal(res.status, 400);
  });

  test("the log says why these questions, never what was answered", async () => {
    const lines = [];
    const write = process.stdout.write;
    process.stdout.write = function (chunk, ...rest) { lines.push(String(chunk)); return write.call(this, chunk, ...rest); };
    try {
      const cookie = await signedIn();
      const first = await call(cookie, { symptoms: "I have a fever" });
      await call(cookie, { symptoms: "I have a fever", answers: { "fever-temperature": "39.5-plus" }, followUpState: first.body.followUpState });
    } finally {
      process.stdout.write = write;
    }
    const entries = lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter((e) => e?.event === "triage_ai");
    assert.deepEqual(entries.map((e) => e.followUp), ["model_pick", "model_pick"]);
    for (const secret of ["39.5", "fever"]) assert.equal(lines.join("").includes(secret), false, secret);
  });
});

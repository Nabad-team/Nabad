// SCRUM-126 (backlog #26): "As a user, I want the AI to ask relevant follow-up questions so that
// the urgency assessment is accurate."
// Part 1 tests question selection and how answers change the level. Part 2 calls the real endpoints.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");
const { getFollowUpQuestions, refineUrgency, AnswerError, GENERAL } = require("../src/triage/followUps");

const ids = (text) => getFollowUpQuestions(text).map((q) => q.id);
const GENERAL_IDS = GENERAL.map((q) => q.id);

describe("which questions are asked", () => {
  test("emergencies get no questions, so care is never delayed", () => {
    assert.deepEqual(getFollowUpQuestions("crushing chest pain"), []);
    assert.deepEqual(getFollowUpQuestions("fever and a stiff neck"), []);
  });

  test("questions match the symptoms described", () => {
    assert.ok(ids("I have a fever").includes("fever-temperature"));
    assert.ok(ids("bad headache since lunch").includes("headache-sudden"));
    assert.ok(ids("an itchy rash on my leg").includes("rash-glass"));
    assert.ok(ids("I keep vomiting").includes("keep-fluids"));
    assert.ok(ids("stomach pain after eating").includes("abdominal-severe"));
    assert.ok(ids("I get short of breath on the stairs").includes("breath-at-rest"));
  });

  test("unrelated questions are not asked", () => {
    const asked = ids("runny nose and sneezing");
    assert.deepEqual(asked, GENERAL_IDS);
  });

  test("a question is skipped when the description already answers it", () => {
    assert.equal(ids("high fever").includes("fever-temperature"), false);
    assert.equal(ids("can't keep anything down, vomiting").includes("keep-fluids"), false);
    assert.equal(ids("no headache, just a cough").includes("headache-sudden"), false);
  });

  test("the general questions are always asked, and there are at most 6 questions", () => {
    const asked = ids("fever, headache, rash and vomiting");
    assert.equal(asked.length, 6);
    assert.deepEqual(asked.slice(-4), GENERAL_IDS);
  });

  test("the browser gets each question's text and choices, not the escalation rules", () => {
    const [question] = getFollowUpQuestions("I have a fever");
    assert.deepEqual(Object.keys(question).sort(), ["id", "options", "text"]);
    for (const option of question.options) assert.deepEqual(Object.keys(option).sort(), ["label", "value"]);
  });
});

describe("how answers change the result", () => {
  test("a red-flag answer raises the level to emergency", () => {
    const result = refineUrgency("headache", { "headache-sudden": "yes" });
    assert.equal(result.level, "emergency");
    assert.equal(result.initialLevel, "routine");
    assert.deepEqual(result.reasons, ["A sudden, very severe headache can signal bleeding in the brain."]);
  });

  test("a very high temperature raises a fever to urgent", () => {
    const result = refineUrgency("I have a fever", { "fever-temperature": "39.5-plus" });
    assert.equal(result.level, "urgent");
    assert.equal(result.timeframe, "Within a few hours (today)");
  });

  test("calm answers keep the original level and its reasons", () => {
    const result = refineUrgency("I have a fever", { "fever-temperature": "under-38", severity: "mild", trend: "better" });
    assert.equal(result.level, "soon");
    assert.deepEqual(result.reasons, ["A fever should be checked by a doctor if it lasts or gets worse."]);
    assert.equal(result.confidence, "refined");
  });

  test("answers never lower the level found in the description", () => {
    const result = refineUrgency("high fever", { severity: "mild", duration: "under-1-day", trend: "better", "risk-group": "no" });
    assert.equal(result.level, "urgent");
  });

  test("being in a risk group raises the level by one step, but never to emergency", () => {
    assert.equal(refineUrgency("runny nose", { "risk-group": "yes" }).level, "soon");
    assert.equal(refineUrgency("I have a fever", { "risk-group": "yes" }).level, "urgent");
    assert.equal(refineUrgency("high fever", { "risk-group": "yes" }).level, "urgent");
  });

  test("a risk group raises the level that the other answers produced", () => {
    // Lasting more than a week -> soon, then the risk group -> urgent.
    assert.equal(refineUrgency("cough", { duration: "over-1-week", "risk-group": "yes" }).level, "urgent");
  });

  test("the most serious answer wins, and only its reasons are shown", () => {
    const result = refineUrgency("cough", { trend: "worse", severity: "severe" });
    assert.equal(result.level, "urgent");
    assert.deepEqual(result.reasons, ["You rated your symptoms as severe."]);
  });

  test("skipping every question leaves the first result unchanged", () => {
    const result = refineUrgency("something feels off with my elbow", {});
    assert.equal(result.level, "routine");
    assert.equal(result.confidence, "low");
  });

  test("invalid answers are rejected", () => {
    for (const answers of [null, "yes", ["yes"], { "made-up": "yes" }, { severity: "extreme" }, { "fever-temperature": "39.5-plus" }]) {
      // The last one is a real question, but not one asked for a runny nose.
      assert.throws(() => refineUrgency("runny nose", answers), AnswerError, JSON.stringify(answers));
    }
  });
});

describe("POST /api/triage/classify and /refine", () => {
  let mongod, server, base, cookie;
  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    await User.init();
    const { createApp } = require("../src/app");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/triage`;
    const account = await User.create({ name: "Leen", email: "leen-followup@example.test", passwordHash: "x" });
    cookie = jwt.sign({ sub: String(account._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  }, { timeout: 240000 });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  async function call(path, body, withCookie = true) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...(withCookie ? { Cookie: `accessToken=${cookie}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  test("classify returns follow-up questions for a non-emergency", async () => {
    const res = await call("/classify", { symptoms: "fever since yesterday" });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "soon");
    assert.equal(res.body.followUpQuestions[0].id, "fever-temperature");
  });

  test("classify returns no questions for an emergency", async () => {
    const res = await call("/classify", { symptoms: "chest pain" });
    assert.deepEqual(res.body.followUpQuestions, []);
  });

  test("refine applies the answers and returns the final result", async () => {
    const res = await call("/refine", { symptoms: "fever since yesterday", answers: { "fever-temperature": "39.5-plus" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "urgent");
    assert.deepEqual(res.body.followUpQuestions, []);
    assert.match(res.body.disclaimer, /not a diagnosis/);
  });

  test("refine rejects bad answers, bad symptoms and missing sessions", async () => {
    assert.equal((await call("/refine", { symptoms: "fever", answers: { severity: "extreme" } })).status, 400);
    assert.equal((await call("/refine", { symptoms: "fever", answers: "severe" })).status, 400);
    assert.equal((await call("/refine", { symptoms: "", answers: {} })).status, 400);
    assert.equal((await call("/refine", { symptoms: "fever", answers: {} }, false)).status, 401);
  });
});

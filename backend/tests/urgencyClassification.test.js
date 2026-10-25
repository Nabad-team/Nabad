// SCRUM-128 (backlog #27): "As a user, I want to receive an urgency classification so that
// I know whether and how soon I need care."
// Part 1 tests the classifier rules directly. Part 2 calls the real endpoint over HTTP.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");
const { classifyUrgency } = require("../src/triage/urgency");

describe("classifier rules", () => {
  const levelOf = (text) => classifyUrgency(text).level;

  test("red-flag symptoms are classified as emergency", () => {
    for (const text of [
      "I have crushing chest pain going down my left arm",
      "My dad can't breathe properly",
      "Her face is drooping and she has slurred speech",
      "He fainted and is not waking up",
      "Fever and a stiff neck since this morning",
      "I keep having thoughts of suicide",
    ]) {
      assert.equal(levelOf(text), "emergency", text);
    }
  });

  test("explicit current heart attack, stroke and overdose statements are emergency", () => {
    for (const text of ["I'm having a heart attack", "I think I'm having a stroke", "I may be having an overdose"]) {
      assert.equal(levelOf(text), "emergency", text);
    }
  });

  test("historical and third-person heart attack or stroke mentions are not current red flags", () => {
    for (const text of ["My father had a stroke years ago", "My mother had a heart attack last year"]) {
      assert.notEqual(levelOf(text), "emergency", text);
    }
  });

  test("serious but not life-threatening symptoms are urgent", () => {
    assert.equal(levelOf("I have a high fever and shivering"), "urgent");
    assert.equal(levelOf("Severe abdominal pain on the right side"), "urgent");
    assert.equal(levelOf("I fell and hit my head"), "urgent");
  });

  test("symptoms that need a doctor within a day or two are 'soon'", () => {
    assert.equal(levelOf("I have a fever and a headache"), "soon");
    assert.equal(levelOf("Ear pain for three days"), "soon");
    assert.equal(levelOf("A rash on my arm"), "soon");
  });

  test("mild common symptoms are routine", () => {
    assert.equal(levelOf("Runny nose and sneezing"), "routine");
    assert.equal(levelOf("A mild headache and I feel tired"), "routine");
  });

  test("the most serious matched level wins", () => {
    const result = classifyUrgency("runny nose, fever, and now chest pain");
    assert.equal(result.level, "emergency");
    assert.equal(result.matchedRuleIds[0], "chest-pain");
    assert.ok(result.matchedRuleIds.includes("fever"));
    // Only the emergency reason is shown, so the advice never contradicts itself.
    assert.deepEqual(result.reasons, ["Chest pain or pressure can be a sign of a heart attack."]);
  });

  test("negated symptoms do not count", () => {
    assert.equal(levelOf("cough but no chest pain and no fever"), "routine");
    assert.equal(levelOf("sore throat without fever"), "routine");
  });

  test("a negation in an earlier clause does not hide a red flag", () => {
    // Missing an emergency is the worst mistake, so "not" before "but" must not cancel "chest pain".
    assert.equal(levelOf("I'm not sure but I have chest pain"), "emergency");
    assert.equal(levelOf("no fever and chest pain"), "emergency");
  });

  test("unknown descriptions default to routine with low confidence and a safety message", () => {
    const result = classifyUrgency("something feels off with my elbow");
    assert.equal(result.level, "routine");
    assert.equal(result.confidence, "low");
    assert.match(result.reasons[0], /contact a doctor/);
  });

  test("every result tells the user how soon to get care and what to do", () => {
    for (const text of ["chest pain", "high fever", "rash", "sneezing", "xyz"]) {
      const result = classifyUrgency(text);
      for (const field of ["label", "timeframe", "action"]) assert.ok(result[field], `${text}: ${field}`);
      assert.ok(result.reasons.length > 0, text);
    }
  });

  test("phrases match whole words only", () => {
    assert.equal(classifyUrgency("I was in a car crash").matchedRuleIds.includes("rash"), false);
    assert.equal(classifyUrgency("my mum scolded me").matchedRuleIds.includes("mild"), false);
  });

  test("matching ignores case and extra punctuation", () => {
    assert.equal(levelOf("CHEST   PAIN!!!"), "emergency");
    assert.equal(levelOf("I can’t breathe"), "emergency"); // curly apostrophe from phones
  });
});

describe("POST /api/triage/classify", () => {
  let mongod, server, base;
  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    mongod = await createTestMongo();
    process.env.MONGO_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    await User.init();
    const { createApp } = require("../src/app");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/triage/classify`;
  }, { timeout: 240000 });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  const cookieFor = (account) => jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  async function call({ cookie, body }) {
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  test("a signed-in user gets a level, timeframe, action, reasons and disclaimer", async () => {
    const account = await User.create({ name: "Rana", email: "rana-triage@example.test", passwordHash: "x" });
    const res = await call({ cookie: cookieFor(account), body: { symptoms: "chest pain and sweating" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "emergency");
    assert.equal(res.body.timeframe, "Now");
    assert.match(res.body.action, /140/);
    assert.ok(res.body.reasons.length > 0);
    assert.match(res.body.disclaimer, /not a diagnosis/);
  });

  test("SCRUM-278: the result has a care-type id for the Find care link", async () => {
    const account = await User.create({ name: "Layla", email: "layla-caretype@example.test", passwordHash: "x" });
    const cookie = cookieFor(account);
    assert.equal((await call({ cookie, body: { symptoms: "chest pain and sweating" } })).body.careTypeId, "emergency-department");
    assert.equal((await call({ cookie, body: { symptoms: "a rash on my arm" } })).body.careTypeId, "dermatology");
    assert.equal((await call({ cookie, body: { symptoms: "runny nose" } })).body.careTypeId, "self-care");
  });

  test("rejects requests without a session", async () => {
    const res = await call({ body: { symptoms: "chest pain" } });
    assert.equal(res.status, 401);
  });

  test("rejects empty, non-text and overlong descriptions", async () => {
    const account = await User.create({ name: "Karim", email: "karim-triage@example.test", passwordHash: "x" });
    const cookie = cookieFor(account);
    for (const symptoms of ["", "  ", "ab", 42, null, "x".repeat(2001)]) {
      assert.equal((await call({ cookie, body: { symptoms } })).status, 400, String(symptoms).slice(0, 20));
    }
  });
});

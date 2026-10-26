// SCRUM-279 over HTTP: POST /api/triage/ai-assess reads the real My health profile of the active profile
// (the user's own or a linked one), and a symptom check never fails because of it.
// A small local HTTP server stands in for the model provider, as in aiTriageEndpoint.test.js.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const HealthFact = require("../src/models/HealthFact");

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
const modelSays = (body) => {
  provider.content = JSON.stringify({ level: "routine", reasons: ["Mild symptoms like these usually pass."], careType: "Self-care at home", selfCare: [], ...body });
};
const yearsAgo = (n) => new Date(Date.UTC(new Date().getUTCFullYear() - n, 0, 1));
const monthsAgo = (n) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - n); d.setUTCDate(d.getUTCDate() - 3); return d; };

describe("POST /api/triage/ai-assess with My health (SCRUM-279)", () => {
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
  const aiOff = () => { for (const key of ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"]) delete process.env[key]; };
  const aiOn = () => {
    process.env.LLM_API_URL = `http://127.0.0.1:${fakeProvider.address().port}/v1`;
    process.env.LLM_API_KEY = "fake-provider-key";
    process.env.LLM_MODEL = "fake-model";
  };
  beforeEach(() => { aiOff(); provider.requests = []; modelSays({}); });

  let counter = 0;
  async function account(fields = {}) {
    counter += 1;
    const user = await User.create({ name: "Rana Haddad", email: `rana-health-${counter}@example.test`, passwordHash: "x", ...fields });
    return { user, cookie: jwt.sign({ sub: String(user._id), ver: user.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }) };
  }
  const addFact = (who, profileId, category, value, status = "confirmed") =>
    HealthFact.create({ owner: who.user._id, profileId, category, value, status });
  async function check(who, symptoms, profileId = "self", extra = {}) {
    const response = await fetch(`${base}?profileId=${profileId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${who.cookie}` },
      body: JSON.stringify({ symptoms, ...extra }),
    });
    return { status: response.status, body: await response.json() };
  }
  const riskQuestion = (body) => body.followUpQuestions.find((q) => q.id === "risk-group");

  test("an account with nothing in My health gets exactly the old result", async () => {
    const rana = await account();
    const res = await check(rana, "runny nose");
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "routine");
    assert.deepEqual(res.body.healthProfile, { used: false, raisedBy: [] });
    assert.ok(riskQuestion(res.body));
  });

  test("a pregnancy in My health raises the rules one step and the question isn't asked", async () => {
    const rana = await account({ dateOfBirth: yearsAgo(29) });
    await addFact(rana, rana.user._id, "sex", "female");
    await addFact(rana, rana.user._id, "pregnancy", "pregnant");
    const res = await check(rana, "runny nose");
    assert.equal(res.body.level, "soon");
    assert.deepEqual(res.body.healthProfile.raisedBy, ["My health shows a pregnancy, so symptoms should be checked sooner."]);
    assert.equal(riskQuestion(res.body), undefined);
    assert.deepEqual(res.body.explanation.fromMyHealth, res.body.healthProfile.raisedBy);
  });

  test("a suggested fact waiting for review changes nothing", async () => {
    const rana = await account({ dateOfBirth: yearsAgo(29) });
    await addFact(rana, rana.user._id, "pregnancy", "pregnant", "suggested");
    const res = await check(rana, "runny nose");
    assert.equal(res.body.level, "routine");
    assert.match(riskQuestion(res.body).text, /pregnant/, "pregnancy is still unknown, so it is still asked");
  });

  test("a caregiver's check for a dependent uses the dependent's My health, not their own", async () => {
    const karim = await account({ dateOfBirth: yearsAgo(35) });
    const baby = await LinkedProfile.create({ owner: karim.user._id, fullName: "Sama", dateOfBirth: monthsAgo(2), relationship: "child" });
    const forBaby = await check(karim, "runny nose", String(baby._id));
    assert.equal(forBaby.body.level, "soon");
    assert.deepEqual(forBaby.body.healthProfile.raisedBy, ["My health shows an age under 3 months, so symptoms should be checked sooner."]);

    const forHimself = await check(karim, "runny nose");
    assert.equal(forHimself.body.level, "routine");
    assert.equal(riskQuestion(forHimself.body).text,
      "Does any of these apply to the person with the symptoms: pregnant, or a long-term illness or weak immune system?",
      "his age is known, so only the other parts are asked");
  });

  test("someone else's dependent is still a 404, so nobody reads another person's My health", async () => {
    const owner = await account();
    const other = await account();
    const dependent = await LinkedProfile.create({ owner: owner.user._id, fullName: "Old parent", dateOfBirth: yearsAgo(80), relationship: "parent" });
    assert.equal((await check(other, "runny nose", String(dependent._id))).status, 404);
  });

  test("the model is sent the My health summary, but never the name, email or date of birth", async () => {
    aiOn();
    modelSays({ level: "soon", reasons: ["A cough with asthma should be checked."] });
    const rana = await account({ dateOfBirth: yearsAgo(40) });
    await addFact(rana, rana.user._id, "condition", { code: "asthma" });
    await addFact(rana, rana.user._id, "allergy", { type: "medication", name: "Penicillin", reaction: "hives" });
    const res = await check(rana, "a cough at night");
    assert.equal(res.status, 200);
    const sent = provider.requests[0].messages[1].content;
    assert.match(sent, /My health background for the person with the symptoms/);
    assert.match(sent, /- Age: \d+ years/);
    assert.match(sent, /- Long-term conditions: asthma/);
    assert.match(sent, /- Allergies: Penicillin \(medication, reaction: hives\)/);
    for (const secret of ["Rana Haddad", rana.user.email, rana.user.dateOfBirth.toISOString().slice(0, 10)]) {
      assert.equal(sent.includes(secret), false, secret);
    }
  });

  test("if My health can't be loaded the check still answers, and the log has no health data", async () => {
    const rana = await account({ dateOfBirth: yearsAgo(70) });
    const find = HealthFact.find;
    HealthFact.find = () => { throw new Error("database unavailable"); };
    const lines = [];
    const write = process.stdout.write;
    process.stdout.write = function (chunk, ...rest) { lines.push(String(chunk)); return write.call(this, chunk, ...rest); };
    let res;
    try {
      res = await check(rana, "runny nose");
    } finally {
      process.stdout.write = write;
      HealthFact.find = find;
    }
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "routine");
    assert.equal(res.body.healthProfile.used, false);
    assert.ok(lines.some((line) => line.includes('"event":"triage_health_profile_unavailable"')));
    assert.ok(lines.some((line) => line.includes('"healthProfile":"none"')));
  });

  test("logs say whether My health was used and made it more urgent, never what it says", async () => {
    const rana = await account({ dateOfBirth: yearsAgo(70) });
    await addFact(rana, rana.user._id, "condition", { code: "diabetes" });
    const lines = [];
    const write = process.stdout.write;
    process.stdout.write = function (chunk, ...rest) { lines.push(String(chunk)); return write.call(this, chunk, ...rest); };
    try {
      await check(rana, "runny nose");
    } finally {
      process.stdout.write = write;
    }
    const entry = lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).find((e) => e?.event === "triage_ai");
    assert.equal(entry.healthProfile, "used");
    assert.equal(entry.healthRaised, true);
    const all = lines.join("\n");
    for (const secret of ["diabetes", "70 years", "runny nose"]) assert.equal(all.includes(secret), false, secret);
  });
});

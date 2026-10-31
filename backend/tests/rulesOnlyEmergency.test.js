const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const SymptomRecord = require("../src/models/SymptomRecord");
const HealthFact = require("../src/models/HealthFact");
const { RULES } = require("../src/triage/urgency");

const emergencies = RULES.filter(rule => rule.level === "emergency");
const description = rule => rule.all ? rule.all.join(" and ") : rule.any[0];
let mongo, server, provider, base, providerUrl, calls = 0, counter = 0;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: require("node:crypto").randomBytes(32).toString("hex"), USAGE_ANALYTICS_ENABLED: "false" });
  mongo = await createTestMongo(); process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  provider = http.createServer((req, res) => { calls += 1; res.writeHead(503).end(); }).listen(0, "127.0.0.1");
  await new Promise(resolve => provider.once("listening", resolve));
  providerUrl = `http://127.0.0.1:${provider.address().port}/v1`;
  server = require("../src/app").createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (provider) await new Promise(resolve => provider.close(resolve));
  await mongoose.disconnect(); if (mongo) await mongo.stop();
});
async function account() {
  const user = await User.create({ name: "Emergency test", email: `emergency-${++counter}@example.test`, passwordHash: "unused", emergencyContact: { name: "Saved contact", phone: "+96170123456" } });
  return { user, cookie: `accessToken=${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "15m" })}` };
}
async function check(who, symptoms, extra = {}, profileId = "self") {
  const response = await fetch(`${base}/triage/ai-assess?profileId=${profileId}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: who.cookie },
    body: JSON.stringify({ symptoms, ...extra }),
  });
  return { status: response.status, body: await response.json() };
}
function assertEmergency(result) {
  assert.equal(result.status, 200);
  assert.equal(result.body.level, "emergency");
  assert.equal(result.body.emergency.contactNumber, "140");
  assert.equal(result.body.ai.used, false);
  assert.deepEqual(result.body.followUpQuestions, []);
}

for (const mode of ["off", "misconfigured", "configured-but-unavailable"]) {
  test(`every emergency rule keeps essential guidance with AI ${mode}`, async () => {
    if (mode === "off") { delete process.env.LLM_API_URL; delete process.env.LLM_MODEL; }
    else Object.assign(process.env, { LLM_API_URL: mode === "misconfigured" ? "invalid-url" : providerUrl, LLM_MODEL: "unavailable-model" });
    const who = await account();
    for (const rule of emergencies) {
      const result = await check(who, description(rule));
      assertEmergency(result);
      assert.ok(result.body.matchedRuleIds.includes(rule.id), rule.id);
    }
    const contact = await fetch(`${base}/profile/emergency-contact?profileId=self`, { headers: { Cookie: who.cookie } });
    assert.equal(contact.status, 200);
    assert.deepEqual((await contact.json()).contact, { name: "Saved contact", phone: "+96170123456" });
    assert.equal(calls, 0, "rule emergencies must never call an AI provider");
  });
}

test("history/context failures cannot suppress a rule emergency", async () => {
  const who = await account();
  const history = SymptomRecord.find, facts = HealthFact.find;
  let attempted = 0;
  SymptomRecord.find = HealthFact.find = () => { attempted += 1; throw new Error("optional context unavailable"); };
  try { assertEmergency(await check(who, "chest pain")); }
  finally { SymptomRecord.find = history; HealthFact.find = facts; }
  assert.equal(attempted, 0);
});

test("AI budget exhaustion cannot block initial or follow-up red flags, while non-emergencies remain limited", async () => {
  delete process.env.LLM_API_URL;
  const who = await account();
  for (let i = 0; i < 30; i++) assert.equal((await check(who, "a mild cough")).status, 200);
  assert.equal((await check(who, "a mild cough")).status, 429);
  assertEmergency(await check(who, "chest pain"));
  assertEmergency(await check(who, "a headache", { answers: { "headache-sudden": "yes" } }));
  assert.equal((await check(who, "a mild cough", { ruleEmergency: true, level: "emergency" })).status, 429);
});

test("valid follow-up red flags work without AI; malformed answers still fail validation", async () => {
  delete process.env.LLM_API_URL;
  const who = await account();
  for (const [symptoms, id] of [["a headache", "headache-sudden"], ["a rash", "rash-glass"], ["wheezing", "breath-at-rest"]]) {
    assertEmergency(await check(who, symptoms, { answers: { [id]: "yes" } }));
  }
  assert.equal((await check(who, "chest pain", { answers: { unknown: "yes" } })).status, 400);
  assert.equal((await check(who, "")).status, 400);
});

test("linked patients retain their own saved contact on the rules-only emergency path", async () => {
  const who = await account();
  const child = await LinkedProfile.create({ owner: who.user._id, fullName: "Child", dateOfBirth: new Date("2020-01-01"), relationship: "child", emergencyContact: { name: "Child contact", phone: "+96171987654" } });
  assertEmergency(await check(who, "chest pain", {}, String(child._id)));
  const response = await fetch(`${base}/profile/emergency-contact?profileId=${child._id}`, { headers: { Cookie: who.cookie } });
  assert.deepEqual((await response.json()).contact, { name: "Child contact", phone: "+96171987654" });
});

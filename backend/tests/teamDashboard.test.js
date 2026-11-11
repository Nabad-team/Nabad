// SCRUM-311: "As a developer, I want usage analytics (e.g. number of triage sessions run) so that the
// team can track adoption." A team dashboard of anonymous daily totals (no personal or health data).
//
// GET /api/usage/summary over HTTP, with a temporary MongoDB: who can see it, what it counts, and that
// nothing personal or medical is in the answer or the logs.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const User = require("../src/models/User");
const UsageDaily = require("../src/models/UsageDaily");
const SymptomRecord = require("../src/models/SymptomRecord");
const { recordAssessment } = require("../src/usageAnalytics");
const { teamEmails, teamSummary } = require("../src/routes/usage");

let mongo, server, base, counter = 0;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: crypto.randomBytes(32).toString("hex") });
  mongo = await createTestMongo();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  server = require("../src/app").createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/usage/summary`;
}, { timeout: 240000 });
after(async () => {
  delete process.env.TEAM_DASHBOARD_EMAILS;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), UsageDaily.deleteMany({}), SymptomRecord.deleteMany({})]);
  process.env.TEAM_DASHBOARD_EMAILS = "lead@nabad.test, Dev@Nabad.test";
});

async function account(email, { verified = true, createdAt } = {}) {
  const user = await User.create({ name: `Person ${++counter}`, email, passwordHash: "unused", emailVerified: verified });
  if (createdAt) await User.collection.updateOne({ _id: user._id }, { $set: { createdAt } });
  return { user, cookie: `accessToken=${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "15m" })}` };
}
async function get(who, query = "") {
  const response = await fetch(base + query, { headers: who ? { Cookie: who.cookie } : {} });
  return { status: response.status, body: await response.json() };
}

test("the team list is read from TEAM_DASHBOARD_EMAILS, ignoring case and spaces; unset means nobody", () => {
  assert.deepEqual([...teamEmails({ TEAM_DASHBOARD_EMAILS: " A@x.test ,b@X.test,, " })], ["a@x.test", "b@x.test"]);
  assert.equal(teamEmails({}).size, 0);
});

test("needs sign-in, and anyone who is not a verified team member gets a plain 404", async () => {
  assert.equal((await get(null)).status, 401);
  const patient = await account("patient@example.test");
  const notFound = await get(patient);
  assert.equal(notFound.status, 404);
  assert.deepEqual(notFound.body, { error: "Route not found." });
  // Someone who signs up with a team member's address can't get in before verifying it.
  assert.equal((await get(await account("lead@nabad.test", { verified: false }))).status, 404);
  // With the setting removed, nobody can.
  const dev = await account("dev@nabad.test");
  assert.equal((await get(dev)).status, 200);
  delete process.env.TEAM_DASHBOARD_EMAILS;
  assert.equal((await get(dev)).status, 404);
});

test("shows daily totals of symptom checks and new accounts, including quiet days", async () => {
  const today = new Date();
  const day = (offset) => new Date(Date.parse(today.toISOString().slice(0, 10)) - offset * 86400000 + 12 * 3600000);
  await recordAssessment(false, day(0));
  await recordAssessment(false, day(0));
  await recordAssessment(true, day(0));
  await recordAssessment(false, day(3));
  await recordAssessment(false, day(10)); // outside a 7-day window
  const lead = await account("LEAD@nabad.test", { createdAt: day(0) });
  await account("someone@example.test", { createdAt: day(3) });
  await account("old@example.test", { createdAt: day(40) });

  const week = await get(lead, "?days=7");
  assert.equal(week.status, 200);
  assert.equal(week.body.timeZone, "UTC");
  assert.equal(week.body.daily.length, 7);
  assert.deepEqual(week.body.totals, { assessments: 4, sessionsStarted: 3, followupAssessments: 1, newAccounts: 2 });
  const last = week.body.daily.at(-1);
  assert.equal(last.day, today.toISOString().slice(0, 10));
  assert.deepEqual({ ...last, day: undefined }, { day: undefined, assessments: 3, sessionsStarted: 2, followupAssessments: 1, newAccounts: 1 });
  assert.equal(week.body.daily.filter((row) => row.assessments === 0).length, 5, "quiet days are listed with zeros");

  const month = await get(lead);
  assert.equal(month.body.daily.length, 30, "30 days by default");
  assert.equal(month.body.totals.assessments, 5);
  assert.equal(month.body.totals.newAccounts, 2);
  assert.equal((await get(lead, "?days=90")).body.totals.newAccounts, 3);
});

test("only 7, 30 or 90 days", async () => {
  const lead = await account("lead@nabad.test");
  for (const days of ["0", "14", "91", "abc", "30.5"]) assert.equal((await get(lead, `?days=${days}`)).status, 400, days);
});

test("nothing personal or medical is in the answer or the logs", async () => {
  const lead = await account("lead@nabad.test");
  const patient = await account("private-patient@example.test");
  await SymptomRecord.create({ owner: patient.user._id, profileId: patient.user._id, description: "PRIVATE-SYMPTOM chest pain", urgencyResult: { level: "emergency" } });
  await recordAssessment(false);
  const lines = [];
  const write = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { lines.push(String(chunk)); return write.call(this, chunk, ...rest); };
  let text;
  try {
    const response = await fetch(base, { headers: { Cookie: lead.cookie } });
    text = await response.text();
  } finally {
    process.stdout.write = write;
  }
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body).sort(), ["daily", "from", "generatedAt", "timeZone", "to", "totals"]);
  for (const row of body.daily) assert.deepEqual(Object.keys(row).sort(), ["assessments", "day", "followupAssessments", "newAccounts", "sessionsStarted"]);
  for (const secret of ["private-patient", "lead@nabad", "PRIVATE-SYMPTOM", "emergency", String(patient.user._id), String(lead.user._id), "Person"]) {
    assert.ok(!text.includes(secret), `the answer contains ${secret}`);
  }
  const log = lines.join("");
  assert.match(log, /"event":"team_dashboard_viewed"/);
  assert.doesNotMatch(log, /lead@nabad|private-patient|PRIVATE-SYMPTOM/);
});

test("teamSummary adds new accounts to the stored daily totals", async () => {
  const now = new Date("2026-11-10T15:00:00Z");
  await recordAssessment(false, new Date("2026-11-09T08:00:00Z"));
  await account("a@example.test", { createdAt: new Date("2026-11-09T23:59:59Z") });
  await account("b@example.test", { createdAt: new Date("2026-11-11T00:00:00Z") }); // after the window
  const summary = await teamSummary(7, now);
  assert.equal(summary.to, "2026-11-10");
  assert.deepEqual(summary.daily.find((row) => row.day === "2026-11-09"), { day: "2026-11-09", assessments: 1, sessionsStarted: 1, followupAssessments: 0, newAccounts: 1 });
  assert.equal(summary.totals.newAccounts, 1);
  assert.equal(summary.generatedAt, now.toISOString());
});

// Per-account daily AI limits (dailyAiLimits.js, docs/ai-fallback.md).
//
// Part 1: the Beirut day and its reset, and the settings (no database).
// Part 2: every limited endpoint over HTTP, with a temporary MongoDB and a local fake AI provider:
// each limit, the friendly answer at the limit, emergencies never counted or blocked, the rules-only symptom
// check at the limit, family profiles counting toward the same account, and the reset at Beirut midnight.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const limits = require("../src/dailyAiLimits");

const SETTINGS = Object.values(limits.FEATURES).map(({ setting }) => setting);

// ---------------------------------------------------------------------------------------------
describe("the Beirut day", () => {
  test("a day starts at midnight in Beirut, not UTC (winter, UTC+2)", () => {
    assert.equal(limits.beirutDay(new Date("2026-11-23T21:59:59Z")), "2026-11-23");
    assert.equal(limits.beirutDay(new Date("2026-11-23T22:00:00Z")), "2026-11-24");
    assert.equal(limits.nextReset(new Date("2026-11-23T08:00:00Z")).toISOString(), "2026-11-23T22:00:00.000Z");
    assert.equal(limits.nextReset(new Date("2026-11-23T22:00:00Z")).toISOString(), "2026-11-24T22:00:00.000Z");
  });

  test("in summer (UTC+3) the reset is an hour earlier in UTC", () => {
    assert.equal(limits.beirutDay(new Date("2027-07-01T21:00:00Z")), "2027-07-02");
    assert.equal(limits.nextReset(new Date("2027-07-01T12:00:00Z")).toISOString(), "2027-07-01T21:00:00.000Z");
  });

  test("the nights the clocks change still reset when the new Beirut day starts", () => {
    // Clocks go forward at midnight on the last Sunday of March: the day starts at 01:00 (UTC+3).
    const spring = limits.nextReset(new Date("2027-03-27T12:00:00Z"));
    assert.equal(spring.toISOString(), "2027-03-27T22:00:00.000Z");
    assert.equal(limits.beirutDay(spring), "2027-03-28");
    assert.equal(limits.beirutDay(new Date(spring - 1)), "2027-03-27");
    // Clocks go back at midnight on the last Sunday of October: the new day starts at 22:00 UTC.
    const autumn = limits.nextReset(new Date("2027-10-30T12:00:00Z"));
    assert.equal(autumn.toISOString(), "2027-10-30T22:00:00.000Z");
    assert.equal(limits.beirutDay(autumn), "2027-10-31");
    assert.equal(limits.beirutDay(new Date(autumn - 1)), "2027-10-30");
  });
});

describe("the settings", () => {
  test("default to 20 symptom checks, 40 messages, 30 history questions, 10 prescriptions and 5 reports", () => {
    assert.deepEqual(limits.readDailyLimits({}), { symptomChecks: 20, assistantMessages: 40, historyQuestions: 30, prescriptionReads: 10, reportAnalyses: 5 });
  });

  test("each one can be changed in the environment", () => {
    assert.equal(limits.readDailyLimits({ AI_DAILY_LIMIT_ASSISTANT_MESSAGES: "60" }).assistantMessages, 60);
    assert.equal(limits.readDailyLimits({ AI_DAILY_LIMIT_REPORT_ANALYSES: " " }).reportAnalyses, 5);
  });

  test("a wrong value stops the server at startup instead of silently turning a limit off", () => {
    for (const value of ["0", "-1", "2.5", "lots", "10001"]) {
      assert.throws(() => limits.readDailyLimits({ AI_DAILY_LIMIT_SYMPTOM_CHECKS: value }), /AI_DAILY_LIMIT_SYMPTOM_CHECKS must be a whole number/);
    }
    const { loadConfig } = require("../src/config");
    assert.throws(() => loadConfig({ JWT_SECRET: "x".repeat(32), MONGO_URI: "mongodb://localhost/x", AI_DAILY_LIMIT_PRESCRIPTION_READS: "none" }), /AI_DAILY_LIMIT_PRESCRIPTION_READS/);
  });

  test("the local security scan loosens them like every other limit", () => {
    assert.equal(limits.readDailyLimits({ SECURITY_SCAN_RELAXED_RATE_LIMITS: "true" }).reportAnalyses, 5000);
  });
});

// ---------------------------------------------------------------------------------------------
describe("daily AI limits over HTTP", () => {
  const provider = { status: 200, content: "", requests: 0 };
  let mongo, server, fakeProvider, base, counter = 0;
  let User, LinkedProfile, AiUsageDaily;

  const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), crypto.randomBytes(1024)]).toString("base64");
  const photo = { mimeType: "image/png", extension: "png", data: PNG };
  const triageReply = JSON.stringify({ level: "routine", reasons: ["Mild symptoms like these usually pass."], careType: "Self-care at home", selfCare: [] });
  const prescriptionReply = JSON.stringify({ isPrescription: true, unreadable: "", medications: [{ name: "Amoxicillin", dose: "500", unit: "mg", form: "tablet", frequency: "three times a day", durationDays: 7, instructions: "", legible: true }] });

  before(async () => {
    Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: crypto.randomBytes(32).toString("hex") });
    mongo = await createTestMongo();
    process.env.MONGO_URI = mongo.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    User = require("../src/models/User");
    LinkedProfile = require("../src/models/LinkedProfile");
    AiUsageDaily = require("../src/models/AiUsageDaily");
    await Promise.all([User.init(), AiUsageDaily.init()]);
    fakeProvider = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        provider.requests += 1;
        res.writeHead(provider.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(provider.status === 200 ? { choices: [{ message: { role: "assistant", content: provider.content } }] } : { error: { message: "provider text" } }));
      });
    });
    await new Promise((resolve) => fakeProvider.listen(0, "127.0.0.1", resolve));
    server = require("../src/app").createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
  }, { timeout: 240000 });
  after(async () => {
    for (const key of ["LLM_API_URL", "LLM_MODEL", "LLM_VISION_ENABLED", ...SETTINGS]) delete process.env[key];
    for (const running of [server, fakeProvider]) if (running) await new Promise((resolve) => running.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });
  beforeEach(() => {
    // A test with the provider down must not leave the model paused (3 failures in a row) for the next one.
    require("../src/triage/ai/modelAccess").resetModelBudgets();
    for (const key of SETTINGS) delete process.env[key];
    Object.assign(process.env, { LLM_API_URL: `http://127.0.0.1:${fakeProvider.address().port}/v1`, LLM_MODEL: "test-model", LLM_VISION_ENABLED: "true" });
    provider.status = 200;
    provider.requests = 0;
    provider.content = triageReply;
  });

  async function account() {
    const user = await User.create({ name: "Limit test", email: `limit-${++counter}@example.test`, passwordHash: "unused" });
    return { user, cookie: `accessToken=${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "15m" })}` };
  }
  async function call(who, path, body, method = "POST") {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: who.cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }
  const today = () => limits.beirutDay(new Date());
  const stored = async (who) => AiUsageDaily.findOne({ owner: who.user._id, day: today() }).lean();
  // Puts the account at a count for today, as if it had already used the feature.
  const usedAlready = (who, feature, count) => AiUsageDaily.updateOne(
    { owner: who.user._id, day: today() },
    { $set: { [feature]: count }, $setOnInsert: { expiresAt: new Date(Date.now() + 2 * 86400000) } },
    { upsert: true },
  );
  const assess = (who, symptoms, profileId = "self") => call(who, `/triage/ai-assess?profileId=${profileId}`, { symptoms });

  test("AI symptom checks: counted, and at the limit the check still answers with the safety rules", async () => {
    process.env.AI_DAILY_LIMIT_SYMPTOM_CHECKS = "2";
    const who = await account();
    for (const used of [1, 2]) {
      const res = await assess(who, "a mild headache today");
      assert.equal(res.status, 200);
      assert.equal(res.body.ai.used, true);
      assert.deepEqual([res.body.aiUsage.used, res.body.aiUsage.limit, res.body.aiUsage.remaining], [used, 2, 2 - used]);
      assert.equal(res.body.dailyLimit, undefined);
    }
    const calls = provider.requests;
    const res = await assess(who, "a mild headache today");
    assert.equal(res.status, 200, "never an error");
    assert.equal(provider.requests, calls, "the model is not called at the limit");
    assert.equal(res.body.ai.used, false);
    assert.equal(res.body.ai.reason, "daily_limit");
    assert.ok(res.body.level && res.body.reasons.length && res.body.careTypeId, "the rules still give a full result");
    assert.equal(res.body.dailyLimit.message, "You've used today's AI checks; this result uses Nabad's safety rules only. The AI part comes back tomorrow.");
    assert.equal(res.body.aiUsage.used, 2);
    assert.equal(res.body.aiUsage.resetsAt, limits.nextReset().toISOString());
    assert.equal((await stored(who)).symptomChecks, 2);
  });

  // A follow-up round, as the page sends it: the last result's followUpState with the answers so far.
  const followUp = (who, round, symptoms = "a mild headache today") =>
    call(who, "/triage/ai-assess?profileId=self", { symptoms, followUpState: { round, asked: [] } });

  test("one symptom check and all its follow-up rounds count as 1", async () => {
    const who = await account();
    assert.equal((await assess(who, "a mild headache today")).body.aiUsage.used, 1);
    for (const round of [1, 2, 3]) {
      const res = await followUp(who, round);
      assert.equal(res.status, 200);
      assert.equal(res.body.ai.used, true, "follow-up rounds still use the AI");
      assert.equal(res.body.aiUsage.used, 1, `round ${round} doesn't count again`);
    }
    const row = await stored(who);
    assert.deepEqual([row.symptomChecks, row.freeFollowUps], [1, 0]);
    assert.equal((await assess(who, "a sore throat")).body.aiUsage.used, 2, "the next check counts");
  });

  test("a follow-up with no rounds left counts as a new check, so the follow-up state can't be used to skip counting", async () => {
    const who = await account();
    const faked = await followUp(who, 1, "a mild cough");
    assert.equal(faked.body.aiUsage.used, 1, "a follow-up with no counted check before it counts");
    for (const round of [1, 2, 3]) await followUp(who, round);
    assert.equal((await stored(who)).symptomChecks, 1);
    assert.equal((await followUp(who, 1, "something new")).body.aiUsage.used, 2, "the 4th free round doesn't exist");
  });

  test("a check started before the limit keeps its follow-up rounds with the AI", async () => {
    process.env.AI_DAILY_LIMIT_SYMPTOM_CHECKS = "1";
    const who = await account();
    assert.equal((await assess(who, "a mild headache today")).body.aiUsage.used, 1);
    const round = await followUp(who, 1);
    assert.equal(round.body.ai.used, true);
    assert.equal(round.body.dailyLimit, undefined);
    assert.equal((await assess(who, "a new problem")).body.ai.reason, "daily_limit", "a new check is over the limit");
  });

  test("a follow-up round the model didn't answer gives its round back", async () => {
    const who = await account();
    await assess(who, "a mild headache today");
    provider.status = 503;
    await followUp(who, 1);
    const row = await stored(who);
    assert.deepEqual([row.symptomChecks, row.freeFollowUps], [1, 3]);
  });

  test("a check the model didn't answer gives back the check and its rounds", async () => {
    provider.status = 503;
    const who = await account();
    await assess(who, "a mild headache today");
    const row = await stored(who);
    assert.deepEqual([row.symptomChecks, row.freeFollowUps], [0, 0]);
  });

  test("emergencies are never counted, and are answered as normal at the limit", async () => {
    process.env.AI_DAILY_LIMIT_SYMPTOM_CHECKS = "1";
    const who = await account();
    for (let i = 0; i < 3; i += 1) {
      const res = await assess(who, "my father can't breathe");
      assert.equal(res.status, 200);
      assert.equal(res.body.level, "emergency");
      assert.equal(res.body.aiUsage, undefined, "not counted");
    }
    assert.equal(await stored(who), null, "nothing stored for emergencies");
    await usedAlready(who, "symptomChecks", 1);
    const res = await assess(who, "my father can't breathe");
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "emergency");
    assert.equal(res.body.emergency.contactNumber, "140");
    assert.equal(res.body.dailyLimit, undefined, "no limit note on an emergency");
    assert.equal((await stored(who)).symptomChecks, 1);
  });

  test("a symptom check the model didn't answer (provider down) doesn't count", async () => {
    provider.status = 503;
    const who = await account();
    const res = await assess(who, "a mild headache today");
    assert.equal(res.status, 200);
    assert.equal(res.body.ai.used, false);
    assert.equal(res.body.aiUsage.used, 0);
    assert.equal((await stored(who)).symptomChecks, 0);
  });

  test("with no AI configured nothing is counted", async () => {
    delete process.env.LLM_API_URL;
    delete process.env.LLM_MODEL;
    const who = await account();
    assert.equal((await assess(who, "a mild headache today")).status, 200);
    assert.equal(await stored(who), null);
  });

  test("family profiles count toward the same account", async () => {
    process.env.AI_DAILY_LIMIT_SYMPTOM_CHECKS = "2";
    const who = await account();
    const child = await LinkedProfile.create({ owner: who.user._id, fullName: "Child", dateOfBirth: new Date("2018-01-01"), relationship: "child" });
    assert.equal((await assess(who, "a mild headache today")).body.aiUsage.used, 1);
    assert.equal((await assess(who, "a mild cough", String(child._id))).body.aiUsage.used, 2);
    const third = await assess(who, "a mild cough", String(child._id));
    assert.equal(third.body.ai.reason, "daily_limit", "the child's profile is limited by the parent's use");
    const rows = await AiUsageDaily.find({ owner: who.user._id }).lean();
    assert.equal(rows.length, 1, "one row per account per day, not per profile");
    const other = await account();
    assert.equal((await assess(other, "a mild headache today")).body.aiUsage.used, 1, "another account has its own count");
  });

  test("prescription photo reading: counted, then a friendly 429 with when it resets", async () => {
    process.env.AI_DAILY_LIMIT_PRESCRIPTION_READS = "1";
    provider.content = prescriptionReply;
    const who = await account();
    const first = await call(who, "/prescriptions/read?profileId=self", { file: photo, consent: true });
    assert.equal(first.status, 200);
    assert.equal(first.body.aiUsage.used, 1);
    const calls = provider.requests;
    const second = await call(who, "/prescriptions/read?profileId=self", { file: photo, consent: true });
    assert.equal(second.status, 429);
    assert.equal(second.body.code, "daily_ai_limit");
    assert.equal(second.body.error, "You've used today's 1 prescription photo readings. They start again at midnight, Beirut time.");
    assert.deepEqual([second.body.dailyLimit.feature, second.body.dailyLimit.remaining], ["prescriptionReads", 0]);
    assert.equal(second.body.dailyLimit.resetsAt, limits.nextReset().toISOString());
    assert.equal(provider.requests, calls, "the model is not called");
  });

  test("a request that fails gives its use back", async () => {
    provider.status = 503;
    const who = await account();
    const res = await call(who, "/prescriptions/read?profileId=self", { file: photo, consent: true });
    assert.equal(res.status, 502);
    await new Promise((resolve) => setTimeout(resolve, 100)); // given back after the reply is sent
    assert.equal((await stored(who)).prescriptionReads, 0);
  });

  test("health assistant messages: a friendly 429 at the limit", async () => {
    process.env.AI_DAILY_LIMIT_ASSISTANT_MESSAGES = "40";
    const who = await account();
    await usedAlready(who, "assistantMessages", 40);
    const res = await call(who, "/reports/chat?profileId=self", { question: "What does hemoglobin do?", consent: true });
    assert.equal(res.status, 429);
    assert.equal(res.body.error, "You've used today's 40 health assistant messages. They start again at midnight, Beirut time.");
    assert.equal(provider.requests, 0);
  });

  test("an emergency question to the assistant is answered by the safety rules at the limit, and not counted", async () => {
    const who = await account();
    await usedAlready(who, "assistantMessages", 40);
    const res = await call(who, "/reports/chat?profileId=self", { question: "I have crushing chest pain now.", consent: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.responseSource, "safety_rules");
    assert.equal((await stored(who)).assistantMessages, 40);
  });

  test("assistant messages the model failed to answer are given back", async () => {
    provider.status = 503;
    const who = await account();
    const res = await call(who, "/reports/chat?profileId=self", { question: "What does hemoglobin do?", consent: true });
    assert.equal(res.status, 502);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal((await stored(who)).assistantMessages, 0);
  });

  test("lab report analysis: a friendly 429 at the limit", async () => {
    const who = await account();
    await usedAlready(who, "reportAnalyses", 5);
    const res = await call(who, "/reports/analyze?profileId=self", { file: { mimeType: "text/plain", extension: "txt", data: Buffer.from("Hemoglobin 13.5 g/dL").toString("base64") }, consent: true });
    assert.equal(res.status, 429);
    assert.equal(res.body.error, "You've used today's 5 lab report reviews. They start again at midnight, Beirut time.");
    assert.equal(provider.requests, 0);
  });

  test("history questions: only AI questions count; at the limit a friendly 429, but plain search still works", async () => {
    const who = await account();
    const ask = (useAi, question = "When did I last have a headache?") => call(who, "/history/ask?profileId=self", { question, useAi });
    provider.status = 503; // the AI fails, so the plain answer is used and the question is given back
    const failed = await ask(true);
    assert.equal(failed.status, 200);
    assert.equal(failed.body.answeredBy, "search");
    assert.equal(failed.body.aiUsage.used, 0);
    assert.equal((await stored(who)).historyQuestions, 0);
    await usedAlready(who, "historyQuestions", 30);
    const limited = await ask(true);
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error, "You've used today's 30 AI questions about your history. They start again at midnight, Beirut time.");
    assert.equal((await ask(false)).status, 200, "a question without AI is never limited");
    const emergency = await ask(true, "I can't breathe right now, what happened last time?");
    assert.equal(emergency.status, 200, "an emergency is never blocked");
    assert.equal(emergency.body.safety.phone, "140");
  });

  test("the counts start again at midnight Beirut time", async () => {
    process.env.AI_DAILY_LIMIT_REPORT_ANALYSES = "2";
    const who = await account();
    const lateEvening = new Date("2026-11-23T21:59:00Z"); // 23:59 in Beirut
    assert.equal((await limits.useOne(who.user._id, "reportAnalyses", { now: lateEvening })).allowed, true);
    assert.equal((await limits.useOne(who.user._id, "reportAnalyses", { now: lateEvening })).allowed, true);
    const blocked = await limits.useOne(who.user._id, "reportAnalyses", { now: lateEvening });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.usage.resetsAt, "2026-11-23T22:00:00.000Z");
    const midnight = new Date("2026-11-23T22:00:00Z"); // 00:00 in Beirut, still 22:00 the day before in UTC
    const fresh = await limits.useOne(who.user._id, "reportAnalyses", { now: midnight });
    assert.equal(fresh.allowed, true);
    assert.equal(fresh.usage.used, 1);
    assert.equal(fresh.day, "2026-11-24");
  });

  test("two requests at once can't both take the last one", async () => {
    process.env.AI_DAILY_LIMIT_REPORT_ANALYSES = "3";
    // Fresh accounts, so the first requests also race to create the day's row.
    for (let round = 0; round < 5; round += 1) {
      const who = await account();
      const results = await Promise.all(Array.from({ length: 12 }, () => limits.useOne(who.user._id, "reportAnalyses")));
      assert.equal(results.filter((r) => r.allowed).length, 3);
      assert.equal((await stored(who)).reportAnalyses, 3);
    }
  });

  test("a request that loses the race to create the day's row still gets its use", async () => {
    const who = await account();
    await usedAlready(who, "reportAnalyses", 0); // the row another request has just created
    const original = AiUsageDaily.findOneAndUpdate;
    let calls = 0;
    AiUsageDaily.findOneAndUpdate = function (...args) {
      calls += 1;
      if (calls === 1) return { lean: () => Promise.reject(Object.assign(new Error("E11000 duplicate key"), { code: 11000 })) };
      return original.apply(this, args);
    };
    try {
      const result = await limits.useOne(who.user._id, "reportAnalyses");
      assert.equal(result.allowed, true, "a duplicate key below the limit is not the limit");
      assert.equal(result.usage.used, 1);
    } finally {
      AiUsageDaily.findOneAndUpdate = original;
    }
  });

  test("only counts are stored, and they expire after 2 days", async () => {
    const who = await account();
    await assess(who, "a mild headache today");
    const row = await stored(who);
    assert.deepEqual(Object.keys(row).sort(), ["_id", "assistantMessages", "day", "expiresAt", "freeFollowUps", "historyQuestions", "owner", "prescriptionReads", "reportAnalyses", "symptomChecks"]);
    assert.equal(row.expiresAt.getTime(), limits.nextReset().getTime() + 86400000);
    const ttl = (await AiUsageDaily.collection.indexes()).find((index) => index.key.expiresAt);
    assert.equal(ttl.expireAfterSeconds, 0);
  });

  test("the counts are in the account's data export, and deleted with the account", async () => {
    const who = await account();
    await usedAlready(who, "assistantMessages", 3);
    const { buildExport } = require("../src/dataExport");
    const exported = await buildExport(who.user._id);
    assert.equal(exported.aiUsageCounts.length, 1);
    assert.deepEqual([exported.aiUsageCounts[0].day, exported.aiUsageCounts[0].healthAssistantMessages], [today(), 3]);
    assert.equal(exported.aiUsageCounts[0].owner, undefined);
    const user = await User.findById(who.user._id);
    user.passwordHash = await require("../src/passwordHashing").hashPassword("Correct horse battery 9!");
    await user.save();
    const res = await call(who, "/profile/me", { confirm: "DELETE", password: "Correct horse battery 9!" }, "DELETE");
    assert.equal(res.status, 204);
    assert.equal(await AiUsageDaily.countDocuments({ owner: who.user._id }), 0);
  });

  test("GET /api/ai-usage shows the account's use today", async () => {
    const who = await account();
    await usedAlready(who, "assistantMessages", 15);
    const res = await call(who, "/ai-usage", null, "GET");
    assert.equal(res.status, 200);
    assert.equal(res.body.timeZone, "Asia/Beirut");
    assert.deepEqual([res.body.assistantMessages.used, res.body.assistantMessages.limit], [15, 40]);
    assert.deepEqual([res.body.symptomChecks.used, res.body.symptomChecks.limit], [0, 20]);
    const anonymous = await fetch(`${base}/ai-usage`);
    assert.equal(anonymous.status, 401);
  });
});

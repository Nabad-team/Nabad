// SCRUM-310: "As a user, I want triage to keep working when the AI is slow, down or over its limit,
// so that I always get guidance."
//
//   - A fallback model is used if the main one fails.
//   - Usage limits protect the free quota.
//   - Red-flag rules still answer if all AI fails.
//
// Parts 1-3 use fake providers (a fetch function), so they need no network, key or database.
// Part 4 calls POST /api/triage/ai-assess over HTTP with two local fake providers.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const { LlmError } = require("../src/triage/ai/llmClient");
const {
  getLlmClient, getTriageLlmClient, readSettings, resetModelBudgets, takeCall, recordOutcome,
  PAUSE_AFTER_QUOTA_MS, PAUSE_AFTER_ACCESS_ERROR_MS, PAUSE_AFTER_FAILURES_MS, FAILURES_BEFORE_PAUSE,
} = require("../src/triage/ai/modelAccess");
const { assessWithAi } = require("../src/triage/ai/aiTriage");
const { providerFailureDetails } = require("../src/reports/providerFailure");
const { ReportAnalysisError } = require("../src/reports/analyze");

const MAIN = "https://main.example.test/v1";
const BACKUP = "https://backup.example.test/v1";
const ENV = { LLM_API_URL: MAIN, LLM_API_KEY: "main-key", LLM_MODEL: "main-model", LLM_FALLBACK_API_URL: BACKUP, LLM_FALLBACK_API_KEY: "backup-key", LLM_FALLBACK_MODEL: "backup-model" };
const MODEL_REPLY = JSON.stringify({ level: "soon", reasons: ["A rash that is spreading should be seen by a doctor."], careType: "General practitioner", selfCare: [] });

const json = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const ok = (content = MODEL_REPLY) => json(200, { choices: [{ message: { role: "assistant", content } }] });

// A fake network with one behaviour per host. Records which host each request went to and with which key.
function providers(behaviour) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const host = new URL(url).hostname.split(".")[0]; // "main" or "backup"
    calls.push({ host, authorization: options.headers.Authorization, model: JSON.parse(options.body).model });
    const respond = behaviour[host];
    if (!respond) throw new TypeError("fetch failed");
    return respond(options);
  };
  return { fetchImpl, calls, hosts: () => calls.map((call) => call.host) };
}
const hang = (options) => new Promise((resolve, reject) => {
  options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
});

beforeEach(() => resetModelBudgets());

// ---------------------------------------------------------------------------------------------
describe("settings", () => {
  test("the backup is off unless LLM_FALLBACK_MODEL is set", () => {
    const { fallback } = readSettings({ LLM_API_URL: MAIN, LLM_MODEL: "main-model" });
    assert.equal(fallback, null);
  });

  test("a backup on the same URL reuses the main key; a backup on another host never gets it", () => {
    const same = readSettings({ LLM_API_URL: MAIN, LLM_API_KEY: "main-key", LLM_MODEL: "main-model", LLM_FALLBACK_MODEL: "lite-model" });
    assert.equal(same.fallback.endpoint, `${MAIN}/chat/completions`);
    assert.equal(same.fallback.model, "lite-model");
    assert.equal(same.fallback.apiKey, "main-key");
    const other = readSettings({ LLM_API_URL: MAIN, LLM_API_KEY: "main-key", LLM_MODEL: "main-model", LLM_FALLBACK_API_URL: BACKUP, LLM_FALLBACK_MODEL: "b" });
    assert.equal(other.fallback.apiKey, null);
  });

  test("invalid limits are reported without secrets and treated as no limit", () => {
    const settings = readSettings({ ...ENV, LLM_MAX_CALLS_PER_DAY: "lots", LLM_QUOTA_TIME_ZONE: "Mars/Olympus", LLM_FALLBACK_API_URL: "http://insecure.example.test" });
    assert.equal(settings.limits.primary.perDay, null);
    assert.equal(settings.timeZone, "UTC");
    assert.equal(settings.fallback, null); // plain HTTP to a remote host is refused, as for the main model
    assert.equal(settings.problems.length, 3);
    assert.doesNotMatch(settings.problems.join(" "), /main-key|backup-key/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("fallback model", () => {
  test("the main model answers when it can; the backup is not called", async () => {
    const net = providers({ main: () => ok(), backup: () => ok() });
    const client = getTriageLlmClient(ENV, net.fetchImpl);
    assert.equal(await client.complete([]), MODEL_REPLY);
    assert.deepEqual(net.hosts(), ["main"]);
    assert.equal(client.answeredBy, "primary");
  });

  for (const [failure, respond] of [
    ["server error", () => json(503, {})],
    ["quota exceeded (429)", () => json(429, {})],
    ["bad key (401)", () => json(401, {})],
    ["network failure", () => { throw new TypeError("fetch failed"); }],
    ["unreadable reply", () => json(200, { choices: [] })],
  ]) {
    test(`a ${failure} on the main model is answered by the backup`, async () => {
      const net = providers({ main: respond, backup: () => ok() });
      const client = getTriageLlmClient(ENV, net.fetchImpl);
      assert.equal(await client.complete([]), MODEL_REPLY);
      assert.deepEqual(net.hosts(), ["main", "backup"]);
      assert.equal(client.answeredBy, "fallback");
      // Each model gets its own key; the main key never goes to the backup's host.
      assert.deepEqual(net.calls.map((call) => call.authorization), ["Bearer main-key", "Bearer backup-key"]);
      assert.equal(net.calls[1].model, "backup-model");
    });
  }

  test("a slow main model is cut off so the backup still has time, within the triage deadline", async () => {
    const net = providers({ main: hang, backup: () => ok() });
    const client = getTriageLlmClient({ ...ENV, LLM_TRIAGE_DEADLINE_MS: "3000" }, net.fetchImpl);
    const started = Date.now();
    assert.equal(await client.complete([]), MODEL_REPLY);
    const took = Date.now() - started;
    assert.ok(took >= 1700 && took < 2900, `took ${took} ms`); // 60% of 3000 ms for the main model
    assert.deepEqual(client.attempts, [{ role: "primary", reason: "timeout" }]);
  });

  test("the deadline must leave the backup at least a second", () => {
    assert.equal(readSettings({ ...ENV, LLM_TRIAGE_DEADLINE_MS: "2000" }).triageDeadlineMs, null);
    assert.equal(readSettings({ ...ENV, LLM_TRIAGE_DEADLINE_MS: "3000" }).triageDeadlineMs, 3000);
  });

  test("when both fail, the main model's real failure is reported", async () => {
    const net = providers({ main: () => json(500, {}), backup: () => json(503, {}) });
    const error = await getTriageLlmClient(ENV, net.fetchImpl).complete([]).catch((e) => e);
    assert.ok(error instanceof LlmError);
    assert.equal(error.code, "http_error");
  });

  test("a programming error is not hidden by trying the backup", async () => {
    const net = providers({ main: () => ok(), backup: () => ok() });
    // An invalid option is a bug in our code, not a provider failure: it is thrown, not retried.
    await assert.rejects(getTriageLlmClient(ENV, net.fetchImpl).complete([], { maxReplyChars: 0 }), TypeError);
    assert.deepEqual(net.hosts(), []);
  });

  test("the symptom check uses the backup's answer and says so", async () => {
    const net = providers({ main: () => json(503, {}), backup: () => ok() });
    const result = await assessWithAi("I have a rash on my arm that is spreading", { client: getTriageLlmClient(ENV, net.fetchImpl) });
    assert.equal(result.ai.used, true);
    assert.equal(result.ai.fallback, true);
    assert.equal(result.level, "soon");
  });

  test("the health assistant uses the main model only", async () => {
    const net = providers({ main: () => json(503, {}), backup: () => ok() });
    await assert.rejects(getLlmClient(ENV, net.fetchImpl).complete([]), (error) => error.code === "http_error");
    assert.deepEqual(net.hosts(), ["main"]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("usage limits protect the free quota", () => {
  test("over the per-minute limit, the main model is not called and the backup answers", async () => {
    const net = providers({ main: () => ok(), backup: () => ok() });
    const env = { ...ENV, LLM_MAX_CALLS_PER_MINUTE: "3" };
    for (let i = 0; i < 3; i += 1) await getTriageLlmClient(env, net.fetchImpl).complete([]);
    const client = getTriageLlmClient(env, net.fetchImpl);
    await client.complete([]);
    assert.deepEqual(net.hosts(), ["main", "main", "main", "backup"]);
    assert.deepEqual(client.attempts, [{ role: "primary", reason: "usage_limit" }]);
  });

  test("with every model over its limit, no provider is called and the rules answer", async () => {
    const net = providers({ main: () => ok(), backup: () => ok() });
    const env = { ...ENV, LLM_MAX_CALLS_PER_DAY: "1", LLM_FALLBACK_MAX_CALLS_PER_DAY: "1" };
    await getTriageLlmClient(env, net.fetchImpl).complete([]); // main: 1 of 1
    const second = getTriageLlmClient(env, net.fetchImpl);
    await second.complete([]); // main full: backup 1 of 1
    assert.equal(second.answeredBy, "fallback");
    const result = await assessWithAi("a rash on my arm", { client: getTriageLlmClient(env, net.fetchImpl) });
    assert.equal(net.calls.length, 2, "no third call reached a provider");
    assert.deepEqual(result.ai, { used: false, reason: "usage_limit" });
    assert.equal(result.level, "soon");
    assert.ok(result.reasons.length > 0);
  });

  test("the last 20% of the daily budget is kept for symptom checks", async () => {
    const net = providers({ main: () => ok() });
    const env = { LLM_API_URL: MAIN, LLM_MODEL: "main-model", LLM_MAX_CALLS_PER_DAY: "10" };
    for (let i = 0; i < 8; i += 1) await getLlmClient(env, net.fetchImpl).complete([]);
    const refused = await getLlmClient(env, net.fetchImpl).complete([]).catch((e) => e);
    assert.equal(refused.code, "usage_limit");
    // Report review and chat turn it into their existing "usage limit" message, without calling anyone.
    const details = providerFailureDetails(new ReportAnalysisError("provider_unavailable", { code: refused.code, status: refused.status }), "chat");
    assert.equal(details.serviceIssue, "usage_limit");
    // Triage can still use the reserved part, then it is full too.
    await getTriageLlmClient(env, net.fetchImpl).complete([]);
    await getTriageLlmClient(env, net.fetchImpl).complete([]);
    await assert.rejects(getTriageLlmClient(env, net.fetchImpl).complete([]), (error) => error.code === "usage_limit");
    assert.equal(net.calls.length, 10);
  });

  test("the reserve can be changed", async () => {
    const net = providers({ main: () => ok() });
    const env = { LLM_API_URL: MAIN, LLM_MODEL: "main-model", LLM_MAX_CALLS_PER_DAY: "10", LLM_TRIAGE_RESERVE_PERCENT: "50" };
    for (let i = 0; i < 5; i += 1) await getLlmClient(env, net.fetchImpl).complete([]);
    await assert.rejects(getLlmClient(env, net.fetchImpl).complete([]), (error) => error.code === "usage_limit");
  });

  test("the daily budget starts again at midnight in the quota's time zone", () => {
    const settings = readSettings({ LLM_API_URL: MAIN, LLM_MODEL: "main-model", LLM_QUOTA_TIME_ZONE: "America/Los_Angeles" });
    const limits = { perMinute: null, perDay: 2 };
    // 06:00 UTC on 10 Nov is still 9 Nov in Los Angeles; 09:00 UTC is 10 Nov there.
    const lateNight = Date.parse("2026-11-10T06:00:00Z");
    assert.equal(takeCall(settings.primary, limits, "triage", settings, lateNight), null);
    assert.equal(takeCall(settings.primary, limits, "triage", settings, lateNight + 1000 * 61), null);
    assert.equal(takeCall(settings.primary, limits, "triage", settings, lateNight + 1000 * 122), "usage_limit");
    assert.equal(takeCall(settings.primary, limits, "triage", settings, Date.parse("2026-11-10T09:00:00Z")), null);
  });

  test("the per-minute window slides: a call is allowed again 60 seconds after the oldest one", () => {
    const settings = readSettings({ LLM_API_URL: MAIN, LLM_MODEL: "main-model" });
    const limits = { perMinute: 1, perDay: null };
    const t = Date.parse("2026-11-10T12:00:00Z");
    assert.equal(takeCall(settings.primary, limits, "triage", settings, t), null);
    assert.equal(takeCall(settings.primary, limits, "triage", settings, t + 59000), "usage_limit");
    assert.equal(takeCall(settings.primary, limits, "triage", settings, t + 60000), null);
  });
});

// ---------------------------------------------------------------------------------------------
describe("pausing a model that said no", () => {
  const settings = readSettings({ LLM_API_URL: MAIN, LLM_MODEL: "main-model" });
  const none = { perMinute: null, perDay: null };
  const t = Date.parse("2026-11-10T12:00:00Z");

  test("a 429 pauses the model for a minute", () => {
    recordOutcome(settings.primary, new LlmError("http_error", 429), t);
    assert.equal(takeCall(settings.primary, none, "triage", settings, t + PAUSE_AFTER_QUOTA_MS - 1), "model_paused");
    assert.equal(takeCall(settings.primary, none, "triage", settings, t + PAUSE_AFTER_QUOTA_MS), null);
  });

  test("a rejected key pauses it for ten minutes", () => {
    recordOutcome(settings.primary, new LlmError("http_error", 403), t);
    assert.equal(takeCall(settings.primary, none, "triage", settings, t + PAUSE_AFTER_ACCESS_ERROR_MS - 1), "model_paused");
    assert.equal(takeCall(settings.primary, none, "triage", settings, t + PAUSE_AFTER_ACCESS_ERROR_MS), null);
  });

  test(`${FAILURES_BEFORE_PAUSE} failures in a row pause it briefly; a success in between resets the count`, () => {
    recordOutcome(settings.primary, new LlmError("timeout"), t);
    recordOutcome(settings.primary, new LlmError("network"), t);
    recordOutcome(settings.primary, null, t); // a success
    recordOutcome(settings.primary, new LlmError("timeout"), t);
    recordOutcome(settings.primary, new LlmError("http_error", 502), t);
    assert.equal(takeCall(settings.primary, none, "triage", settings, t), null, "only 2 in a row");
    recordOutcome(settings.primary, new LlmError("timeout"), t);
    assert.equal(takeCall(settings.primary, none, "triage", settings, t + 1), "model_paused");
    assert.equal(takeCall(settings.primary, none, "triage", settings, t + PAUSE_AFTER_FAILURES_MS), null);
  });

  test("the health assistant is not blocked by a pause: it shows the provider's own answer, as before", () => {
    recordOutcome(settings.primary, new LlmError("http_error", 429), t);
    assert.equal(takeCall(settings.primary, none, "assistant", settings, t + 1), null);
    assert.equal(takeCall(settings.primary, none, "triage", settings, t + 1), "model_paused");
  });

  test("while the main model is paused, checks go straight to the backup without waiting", async () => {
    const net = providers({ main: () => json(429, {}), backup: () => ok() });
    await getTriageLlmClient(ENV, net.fetchImpl).complete([]);
    const client = getTriageLlmClient(ENV, net.fetchImpl);
    await client.complete([]);
    assert.deepEqual(net.hosts(), ["main", "backup", "backup"]);
    assert.deepEqual(client.attempts, [{ role: "primary", reason: "model_paused" }]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("POST /api/triage/ai-assess with the main model down", () => {
  const state = { main: 503, backupCalls: 0, mainCalls: 0 };
  let mongo, server, mainProvider, backupProvider, base, counter = 0;
  const startProvider = (onRequest) => new Promise((resolve) => {
    const provider = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => onRequest(res));
    }).listen(0, "127.0.0.1", () => resolve(provider));
  });
  const reply = (res, status) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status === 200 ? { choices: [{ message: { role: "assistant", content: MODEL_REPLY } }] } : { error: { message: "private provider text" } }));
  };

  before(async () => {
    Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: crypto.randomBytes(32).toString("hex"), USAGE_ANALYTICS_ENABLED: "false" });
    mongo = await createTestMongo();
    process.env.MONGO_URI = mongo.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    mainProvider = await startProvider((res) => { state.mainCalls += 1; reply(res, state.main); });
    backupProvider = await startProvider((res) => { state.backupCalls += 1; reply(res, 200); });
    server = require("../src/app").createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/triage/ai-assess`;
  }, { timeout: 240000 });
  after(async () => {
    for (const key of ["LLM_API_URL", "LLM_MODEL", "LLM_FALLBACK_API_URL", "LLM_FALLBACK_MODEL", "LLM_MAX_CALLS_PER_DAY", "LLM_FALLBACK_MAX_CALLS_PER_DAY"]) delete process.env[key];
    for (const running of [server, mainProvider, backupProvider]) if (running) await new Promise((resolve) => running.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });
  beforeEach(() => {
    Object.assign(process.env, {
      LLM_API_URL: `http://127.0.0.1:${mainProvider.address().port}/v1`, LLM_MODEL: "main-model",
      LLM_FALLBACK_API_URL: `http://127.0.0.1:${backupProvider.address().port}/v1`, LLM_FALLBACK_MODEL: "backup-model",
    });
    delete process.env.LLM_MAX_CALLS_PER_DAY;
    delete process.env.LLM_FALLBACK_MAX_CALLS_PER_DAY;
    Object.assign(state, { main: 503, mainCalls: 0, backupCalls: 0 });
  });

  async function check(symptoms) {
    const User = require("../src/models/User");
    const user = await User.create({ name: "Fallback test", email: `fallback-${++counter}@example.test`, passwordHash: "unused" });
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "15m" })}` },
      body: JSON.stringify({ symptoms }),
    });
    return { status: response.status, body: await response.json() };
  }
  function captureLogs(run) {
    const lines = [];
    const write = process.stdout.write;
    process.stdout.write = function (chunk, ...rest) { lines.push(String(chunk)); return write.call(this, chunk, ...rest); };
    return run().finally(() => { process.stdout.write = write; }).then((value) => ({ value, output: lines.join("") }));
  }

  test("the backup answers, and only fixed codes are logged", async () => {
    const { value: res, output } = await captureLogs(() => check("PRIVATE-WORDS a rash on my arm that is spreading"));
    assert.equal(res.status, 200);
    assert.equal(res.body.ai.used, true);
    assert.equal(res.body.ai.fallback, true);
    assert.equal(state.mainCalls, 1);
    assert.equal(state.backupCalls, 1);
    assert.match(output, /"model":"fallback"/);
    assert.match(output, /"modelAttempts":"primary:http_error"/);
    assert.doesNotMatch(output, /PRIVATE-WORDS|private provider text/);
  });

  test("with both models down, a non-emergency still gets the rules' guidance", async () => {
    process.env.LLM_FALLBACK_API_URL = `http://127.0.0.1:${mainProvider.address().port}/v1`; // also failing
    const res = await check("a rash on my arm");
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "soon");
    assert.equal(res.body.ai.used, false);
    assert.ok(res.body.reasons.length > 0);
    assert.ok(res.body.disclaimer);
  });

  test("with both models over their daily limit, guidance comes from the rules without any provider call", async () => {
    Object.assign(process.env, { LLM_MAX_CALLS_PER_DAY: "1", LLM_FALLBACK_MAX_CALLS_PER_DAY: "1" });
    state.main = 200;
    await check("a cough"); // main: 1 of 1
    state.main = 503;
    await check("a cough"); // main: refused before calling; backup: 1 of 1
    const before = state.mainCalls + state.backupCalls;
    const res = await check("a rash on my arm");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.ai, { used: false, reason: "usage_limit" });
    assert.equal(state.mainCalls + state.backupCalls, before);
  });

  test("red flags are answered by the rules even with every model down, and no model is called", async () => {
    state.main = 503;
    process.env.LLM_FALLBACK_API_URL = process.env.LLM_API_URL;
    for (const symptoms of ["crushing chest pain and sweating", "my dad's face is drooping and he can't lift his arm", "she is not breathing"]) {
      const res = await check(symptoms);
      assert.equal(res.status, 200, symptoms);
      assert.equal(res.body.level, "emergency", symptoms);
      assert.equal(res.body.emergency.contactNumber, "140");
      assert.deepEqual(res.body.ai, { used: false, reason: "emergency_rule" });
    }
    assert.equal(state.mainCalls + state.backupCalls, 0);
  });
});

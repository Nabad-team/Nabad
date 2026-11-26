// Time limits (timeLimits.js): no request waits for minutes on a stuck database, network or AI provider.
// - The request limit (middleware/requestTimeLimit.js) answers 503 "request_timeout" with nothing from the request,
//   and whatever the handler tries to send afterwards is dropped without an error.
// - The symptom check: a hanging AI provider ends at the triage deadline (set, or the built-in default), an
//   emergency never waits for the AI, and slow optional database reads are skipped at their limit.
// The limits are shortened here so the tests take seconds; the real values are checked separately.
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const { timeLimits, requestLimitFor, withinTime, TimeLimitError } = require("../src/timeLimits");
const { requestTimeLimit, TIMEOUT_BODY } = require("../src/middleware/requestTimeLimit");
const { errorHandler } = require("../src/logger");

const REAL = { ...timeLimits };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const listen = (handler) => new Promise((resolve) => { const s = http.createServer(handler); s.listen(0, "127.0.0.1", () => resolve(s)); });
const close = (server) => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });
const SYMPTOMS = "mild sore throat since yesterday and my name is Rana Haddad";

test("the real limits fit together: AI deadline < symptom check limit, every limit < the frontend's", () => {
  assert.equal(REAL.DEFAULT_TRIAGE_DEADLINE_MS, 20000);
  assert.ok(REAL.DEFAULT_TRIAGE_DEADLINE_MS + REAL.OPTIONAL_READ_MS < REAL.TRIAGE_REQUEST_MS);
  assert.ok(12000 + REAL.OPTIONAL_READ_MS < REAL.TRIAGE_REQUEST_MS, "the recommended 12 s deadline leaves margin");
  assert.ok(REAL.REQUEST_MS < 30000, "below the frontend's 30 s (frontend/lib/api.js)");
  assert.ok(REAL.SLOW_REQUEST_MS < 120000 && REAL.TRIAGE_REQUEST_MS < 120000, "below the frontend's 120 s for slow routes");
  assert.ok(REAL.DB_READ_MS < REAL.DB_SOCKET_MS, "a slow query fails on maxTimeMS before the socket limit");
  assert.equal(REAL.DB_SERVER_SELECTION_MS, 5000);
});

test("each API path gets its limit", () => {
  assert.equal(requestLimitFor("/triage/ai-assess"), timeLimits.TRIAGE_REQUEST_MS);
  for (const path of ["/reports/analyze", "/medical-documents", "/visit-prep/abc", "/prescriptions/read", "/history/ask", "/profile-coverage/documents/insurance"]) {
    assert.equal(requestLimitFor(path), timeLimits.SLOW_REQUEST_MS, path);
  }
  for (const path of ["/auth/me", "/triage/classify", "/medications", "/history", "/reportsx"]) {
    assert.equal(requestLimitFor(path), timeLimits.REQUEST_MS, path);
  }
});

test("withinTime settles with the promise, or rejects at the limit and ignores a late failure", async () => {
  assert.equal(await withinTime(Promise.resolve(7), 1000, "x"), 7);
  const started = Date.now();
  await assert.rejects(withinTime(new Promise(() => {}), 50, "a read"), (error) => error instanceof TimeLimitError && error.code === "time_limit");
  assert.ok(Date.now() - started < 1000);
  // A promise that fails after the limit must not become an unhandled rejection.
  await assert.rejects(withinTime(wait(80).then(() => { throw new Error("late"); }), 20, "x"), TimeLimitError);
  await wait(100);
});

describe("the request time limit", () => {
  let server, base, unhandled;
  const onUnhandled = (error) => { unhandled = error; };
  before(async () => {
    Object.assign(timeLimits, { REQUEST_MS: 200, TRIAGE_REQUEST_MS: 300, SLOW_REQUEST_MS: 700 });
    process.on("unhandledRejection", onUnhandled);
    process.on("uncaughtException", onUnhandled);
    const app = express();
    app.use((req, res, next) => { req.requestId = "req-test-1"; next(); });
    app.use(express.json());
    app.use("/api", requestTimeLimit);
    app.get("/api/fast", (req, res) => res.json({ ok: true }));
    app.post("/api/never", () => {});
    // Answers after the limit, setting a cookie and a header on the way, then fails: all of it must be dropped.
    app.post("/api/late", async (req, res, next) => {
      await wait(400);
      res.clearCookie("accessToken");
      res.set("X-Late", "1");
      res.status(200).json({ symptoms: req.body.symptoms });
      res.end("more");
      next(new Error("failed after the limit"));
    });
    app.get("/api/reports/slow", async (req, res) => { await wait(400); res.json({ ok: true }); });
    app.use(errorHandler);
    server = await listen(app);
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    Object.assign(timeLimits, REAL);
    process.off("unhandledRejection", onUnhandled);
    process.off("uncaughtException", onUnhandled);
    await close(server);
  });

  test("a fast request is not touched", async () => {
    const res = await fetch(`${base}/api/fast`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test("a request that never answers gets 503 request_timeout at its limit, with nothing from the request", async () => {
    const logged = [];
    const write = process.stdout.write;
    process.stdout.write = (chunk, ...rest) => { const line = String(chunk); if (line.startsWith('{"time"') && line.includes('"event":"request_timeout"')) logged.push(JSON.parse(line)); return write.call(process.stdout, chunk, ...rest); };
    const started = Date.now();
    const res = await fetch(`${base}/api/never`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: SYMPTOMS, email: "rana@example.test" }),
    });
    const elapsed = Date.now() - started;
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("retry-after"), "5");
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { ...TIMEOUT_BODY, requestId: "req-test-1" });
    assert.match(TIMEOUT_BODY.error, /call 140/);
    for (const leaked of ["sore throat", "Rana", "rana@example.test"]) assert.ok(!text.includes(leaked), leaked);
    assert.ok(elapsed >= 180 && elapsed < 1500, `answered after ${elapsed} ms`);
    process.stdout.write = write;
    // The log line names the route segment and the limit, nothing that was sent.
    assert.equal(logged.length, 1);
    assert.deepEqual({ route: logged[0].route, durationMs: logged[0].durationMs, requestId: logged[0].requestId }, { route: "never", durationMs: 200, requestId: "req-test-1" });
    assert.ok(!JSON.stringify(logged[0]).includes("sore throat"));
  });

  test("a handler that answers and fails after the limit changes nothing and throws nothing", async () => {
    unhandled = undefined;
    const res = await fetch(`${base}/api/late`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symptoms: SYMPTOMS }),
    });
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("x-late"), null);
    assert.equal(res.headers.get("set-cookie"), null);
    const text = await res.text();
    assert.equal(JSON.parse(text).code, "request_timeout");
    assert.ok(!text.includes("sore throat"));
    await wait(400); // the handler's late writes and its error happen now
    assert.equal(unhandled, undefined);
    assert.equal((await fetch(`${base}/api/fast`)).status, 200, "the server keeps serving");
  });

  test("slow routes get the longer limit", async () => {
    const res = await fetch(`${base}/api/reports/slow`);
    assert.equal(res.status, 200);
  });
});

describe("the symptom check within its limits", () => {
  let mongod, app, base, hangingProvider, providerCalls;
  const User = require("../src/models/User");
  const SymptomRecord = require("../src/models/SymptomRecord");
  const HealthFact = require("../src/models/HealthFact");
  const original = { find: SymptomRecord.find, factFind: HealthFact.find };
  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    mongod = await createTestMongo();
    process.env.MONGO_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    await User.init();
    // A model provider that accepts the request and never answers.
    hangingProvider = await listen((req) => { providerCalls += 1; req.resume(); });
    const { createApp } = require("../src/app");
    app = await new Promise((resolve) => { const s = createApp().listen(0, "127.0.0.1", () => resolve(s)); });
    base = `http://127.0.0.1:${app.address().port}/api/triage/ai-assess`;
  }, { timeout: 240000 });
  after(async () => {
    Object.assign(timeLimits, REAL);
    for (const key of ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_TRIAGE_DEADLINE_MS"]) delete process.env[key];
    if (app) await close(app);
    if (hangingProvider) await close(hangingProvider);
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });
  beforeEach(() => {
    providerCalls = 0;
    process.env.LLM_API_URL = `http://127.0.0.1:${hangingProvider.address().port}/v1`;
    process.env.LLM_API_KEY = "fake-provider-key";
    process.env.LLM_MODEL = "fake-model";
    delete process.env.LLM_TRIAGE_DEADLINE_MS;
  });
  afterEach(() => {
    SymptomRecord.find = original.find;
    HealthFact.find = original.factFind;
    Object.assign(timeLimits, REAL);
  });

  let counter = 0;
  async function signedIn() {
    counter += 1;
    const account = await User.create({ name: "Rana Haddad", email: `rana-limits-${counter}@example.test`, passwordHash: "x" });
    return { cookie: jwt.sign({ sub: String(account._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }), email: account.email };
  }
  async function check(symptoms, cookie) {
    const started = Date.now();
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${cookie}` },
      body: JSON.stringify({ symptoms }),
    });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text), elapsed: Date.now() - started };
  }
  // A query whose result never arrives, recording the maxTimeMS it was given.
  function hangingQuery(seen) {
    const query = { sort: () => query, limit: () => query, select: () => query, lean: () => query,
      maxTimeMS: (ms) => { seen.push(ms); return query; }, then: () => {} };
    return query;
  }

  test("a hanging AI provider ends at LLM_TRIAGE_DEADLINE_MS and the rules answer", async () => {
    process.env.LLM_TRIAGE_DEADLINE_MS = "3000";
    const { cookie } = await signedIn();
    const res = await check("a mild headache since this morning", cookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.ai.used, false);
    assert.equal(res.body.ai.reason, "timeout");
    assert.ok(res.body.level);
    assert.ok(res.elapsed >= 2500 && res.elapsed < 6000, `answered after ${res.elapsed} ms`);
    assert.equal(providerCalls, 1);
  });

  test("without LLM_TRIAGE_DEADLINE_MS the built-in default still ends the wait", async () => {
    timeLimits.DEFAULT_TRIAGE_DEADLINE_MS = 3000;
    const { cookie } = await signedIn();
    const res = await check("a mild headache since this morning", cookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.ai.reason, "timeout");
    assert.ok(res.elapsed >= 2500 && res.elapsed < 6000, `answered after ${res.elapsed} ms`);
  });

  test("an emergency never waits for the AI or the deadline", async () => {
    process.env.LLM_TRIAGE_DEADLINE_MS = "12000";
    const { cookie } = await signedIn();
    const res = await check("my father can't breathe", cookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "emergency");
    assert.deepEqual(res.body.ai, { used: false, reason: "emergency_rule" });
    assert.equal(res.body.emergency.contactNumber, "140");
    assert.equal(providerCalls, 0, "the provider is never called");
    assert.ok(res.elapsed < 2000, `answered after ${res.elapsed} ms`);
  });

  test("slow optional database reads are skipped at their limit, with maxTimeMS on each", async () => {
    process.env.LLM_TRIAGE_DEADLINE_MS = "3000";
    timeLimits.OPTIONAL_READ_MS = 300;
    const seen = [];
    SymptomRecord.find = () => hangingQuery(seen);
    HealthFact.find = () => hangingQuery(seen);
    delete process.env.LLM_API_URL; // AI off: the reads are the only thing that can be slow
    const { cookie } = await signedIn();
    const res = await check("a mild headache since this morning", cookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.level);
    assert.ok(res.elapsed < 2000, `answered after ${res.elapsed} ms`);
    assert.ok(seen.length >= 2 && seen.every((ms) => ms === REAL.DB_READ_MS), `maxTimeMS given: ${seen}`);
  });

  test("past the request limit the check gets 503 request_timeout without symptoms or personal data", async () => {
    process.env.LLM_TRIAGE_DEADLINE_MS = "3000";
    timeLimits.TRIAGE_REQUEST_MS = 500;
    const { cookie, email } = await signedIn();
    const res = await check(SYMPTOMS, cookie);
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "request_timeout");
    assert.match(res.body.error, /call 140/);
    for (const leaked of ["sore throat", "Rana", "Haddad", email]) assert.ok(!res.text.includes(leaked), leaked);
    assert.deepEqual(Object.keys(res.body).sort(), ["code", "error", "requestId"]);
    assert.ok(res.elapsed < 2000, `answered after ${res.elapsed} ms`);
    await wait(3000); // the handler finishes at the AI deadline; its late answer is dropped
    timeLimits.TRIAGE_REQUEST_MS = REAL.TRIAGE_REQUEST_MS;
    const next = await check("my father can't breathe", cookie);
    assert.equal(next.status, 200, "the app keeps serving");
  });
});

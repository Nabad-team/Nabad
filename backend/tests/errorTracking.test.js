// Error tracking (story #89): what reaches Sentry. A fake Sentry ingest server receives exactly what the SDK sends, so
// these tests check the real payload: never health or personal data, only the error type, stack trace, route,
// status, requestId and environment.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const zlib = require("zlib");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const Sentry = require("@sentry/node");
const { initErrorTracking, captureServerError, scrubEvent } = require("../src/errorTracking");
const { requestLogger, errorHandler } = require("../src/logger");

const SYMPTOM = "crushing chest pain spreading to my left arm";
const EMAIL = "rana.haddad@example.test";
const COOKIE = "accessToken=eyJhbGciOiJIUzI1NiJ9.secret-session";
const BEARER = "Bearer secret-api-token-123";
const IP = "203.0.113.42";

let ingest, dsn, app, appServer, base;
const envelopes = [];
// Every event item the fake Sentry received, as JSON text and parsed.
const events = () => envelopes.flatMap((body) => {
  const lines = body.split("\n");
  const out = [];
  for (let i = 1; i < lines.length; i += 2) {
    const header = lines[i] && JSON.parse(lines[i]);
    if (header?.type === "event") out.push({ text: lines[i + 1], event: JSON.parse(lines[i + 1]) });
  }
  return out;
});
async function waitForEvents(count) {
  const deadline = Date.now() + 10000;
  while (events().length < count && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  return events();
}
// Nothing in the event may contain any of these.
function assertNothingPersonal(text) {
  for (const value of [SYMPTOM, "chest pain", EMAIL, "rana.haddad", COOKIE, "secret-session", BEARER, "secret-api-token", IP, "email=", "?email"]) {
    assert.ok(!text.includes(value), `the event sent to Sentry contains ${JSON.stringify(value)}`);
  }
}

before(async () => {
  ingest = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      envelopes.push((req.headers["content-encoding"] === "gzip" ? zlib.gunzipSync(raw) : raw).toString("utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise((resolve) => ingest.listen(0, "127.0.0.1", resolve));
  dsn = `http://publickey@127.0.0.1:${ingest.address().port}/1`;

  // The real request logger and central error handler, behind routes that fail like real ones.
  app = express();
  app.use(requestLogger);
  app.use(express.json());
  const router = express.Router();
  router.post("/:id/check", (req) => {
    throw new Error(`Could not save "${req.body.description}" for ${EMAIL}`);
  });
  router.post("/invalid", () => {
    const error = new Error(`Validation failed: description: ${SYMPTOM}`);
    error.name = "ValidationError";
    throw error;
  });
  app.use("/api/symptoms", router);
  const medications = express.Router();
  medications.get("/", () => { throw new Error(SYMPTOM); });
  app.use("/api/medications", medications);
  app.use(errorHandler);
  appServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => appServer.once("listening", resolve));
  base = `http://127.0.0.1:${appServer.address().port}`;
});
after(async () => {
  await Sentry.close(2000);
  appServer?.close();
  ingest?.close();
});
beforeEach(() => { envelopes.length = 0; });

const failingRequest = (pathname) => fetch(`${base}${pathname}?email=${encodeURIComponent(EMAIL)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: COOKIE, Authorization: BEARER, "X-Forwarded-For": IP },
  body: JSON.stringify({ description: SYMPTOM, email: EMAIL }),
});

// The frontend's tests import backend modules (passwordPolicy.js, which logs) without the backend's packages
// installed, and nothing should load the SDK while error tracking is off.
test("logging and the shared password policy work without the Sentry SDK", async () => {
  const script = `
    const Module = require("module");
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (request, ...rest) {
      if (request.startsWith("@sentry/")) throw Object.assign(new Error("Cannot find module " + request), { code: "MODULE_NOT_FOUND" });
      return resolve.call(this, request, ...rest);
    };
    require(${JSON.stringify(path.join(__dirname, "../src/passwordPolicy"))});
    const { initErrorTracking, captureServerError } = require(${JSON.stringify(path.join(__dirname, "../src/errorTracking"))});
    if (initErrorTracking({}) !== false) process.exit(2);
    captureServerError(new Error("x"), { requestId: "r", route: "/r", status: 500 });`;
  const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  assert.equal(await new Promise((resolve) => child.on("exit", resolve)), 0, stderr);
});

// Runs first: until SENTRY_DSN is set, nothing is initialized or sent.
test("without SENTRY_DSN, error tracking stays off and nothing is sent", async () => {
  assert.equal(initErrorTracking({}), false);
  assert.equal(Sentry.getClient(), undefined);
  const res = await failingRequest("/api/symptoms/123/check");
  assert.equal(res.status, 500);
  captureServerError(new Error(SYMPTOM), { requestId: "x", route: "/x", status: 500 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(envelopes.length, 0);
});

test("a 5xx from the central error handler is sent with only the type, stack, route, status, requestId and environment", async () => {
  assert.equal(initErrorTracking({ SENTRY_DSN: dsn, APP_ENV: "staging" }), true);
  // Sentry v11 no longer reads sendDefaultPii: every kind of data collection must be off explicitly.
  const collection = Sentry.getClient().getDataCollectionOptions();
  assert.deepEqual(collection, {
    userInfo: false, cookies: false, httpHeaders: { request: false, response: false }, httpBodies: [], urlQueryParams: false,
    graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
    databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0,
  });
  assert.deepEqual(Sentry.getClient().getOptions().integrations.map(({ name }) => name).sort(),
    ["Dedupe", "EventFilters", "LinkedErrors", "OnUncaughtException", "OnUnhandledRejection"]);
  assert.equal(Sentry.getClient().getOptions().tracesSampleRate, undefined);
  const res = await failingRequest("/api/symptoms/6650c0ffee/check");
  assert.equal(res.status, 500);
  const requestId = res.headers.get("x-request-id");

  const [{ text, event }] = await waitForEvents(1);
  assertNothingPersonal(text);
  assert.equal(event.environment, "staging");
  assert.deepEqual(event.tags, { requestId, route: "/api/symptoms/:id/check", status: "500" });
  // The route pattern, never the id from the URL.
  assert.ok(!text.includes("6650c0ffee"));
  const [exception] = event.exception.values;
  assert.equal(exception.type, "Error");
  assert.equal(exception.value, undefined, "the error message can contain health data and is never sent");
  assert.ok(exception.stacktrace.frames.length > 0);
  assert.ok(exception.stacktrace.frames.some((frame) => frame.filename && frame.lineno && frame.function !== undefined));
  for (const frame of exception.stacktrace.frames) {
    assert.deepEqual(Object.keys(frame).filter((key) => !["filename", "function", "module", "lineno", "colno", "in_app"].includes(key)), []);
  }
  for (const field of ["request", "user", "extra", "contexts", "breadcrumbs", "server_name", "release", "modules", "message", "transaction", "fingerprint"]) {
    assert.equal(event[field], undefined, `${field} must not be sent`);
  }
});

test("data attached to the scope (user, request, extra, contexts, breadcrumbs) is still removed before sending", async () => {
  Sentry.withScope((scope) => {
    scope.setUser({ id: "user-1", email: EMAIL, ip_address: IP, username: "rana" });
    scope.setExtra("symptoms", SYMPTOM);
    scope.setContext("health", { description: SYMPTOM });
    scope.setTag("email", EMAIL);
    scope.setTags({ requestId: "req-1", route: "/api/triage/ai-assess", status: "502" });
    scope.addBreadcrumb({ message: `typed ${SYMPTOM}`, data: { url: `/api/symptoms?email=${EMAIL}` } }, 10);
    scope.addEventProcessor((event) => ({
      ...event,
      request: { url: `https://nabad.example/api/symptoms?email=${EMAIL}`, query_string: `email=${EMAIL}`, cookies: { accessToken: COOKIE }, headers: { Cookie: COOKIE, Authorization: BEARER }, data: { description: SYMPTOM } },
    }));
    Sentry.captureException(new TypeError(`Cannot read "${SYMPTOM}"`));
  });
  const [{ text, event }] = await waitForEvents(1);
  assertNothingPersonal(text);
  assert.deepEqual(event.tags, { requestId: "req-1", route: "/api/triage/ai-assess", status: "502" });
  assert.equal(event.exception.values[0].type, "TypeError");
});

test("the route of a router's own root is its mount path, without the query string", async () => {
  const res = await fetch(`${base}/api/medications/?profileId=6650c0ffee&email=${encodeURIComponent(EMAIL)}`, { headers: { Cookie: COOKIE } });
  assert.equal(res.status, 500);
  const [{ text, event }] = await waitForEvents(1);
  assertNothingPersonal(text);
  assert.ok(!text.includes("6650c0ffee"));
  assert.equal(event.tags.route, "/api/medications");
});

test("4xx answers are not errors and are never sent", async () => {
  const res = await failingRequest("/api/symptoms/invalid");
  assert.equal(res.status, 400);
  await Sentry.flush(1000);
  assert.equal(events().length, 0);
});

test("scrubEvent keeps only the allowlisted fields", () => {
  const scrubbed = scrubEvent({
    event_id: "abc", timestamp: 1, platform: "node", level: "error", environment: "production", release: "1.0", server_name: "host-1",
    message: SYMPTOM, transaction: `/api/symptoms?email=${EMAIL}`,
    exception: { values: [{ type: "Error", value: SYMPTOM, mechanism: { type: "generic", handled: true, data: { url: EMAIL } },
      stacktrace: { frames: [{ filename: "src/routes/symptoms.js", function: "save", lineno: 10, colno: 5, in_app: true, abs_path: "/home/rana/app.js", vars: { description: SYMPTOM }, context_line: `const text = "${SYMPTOM}"`, pre_context: [EMAIL] }] } }] },
    tags: { requestId: "r1", route: "/api/symptoms", status: 500, email: EMAIL },
    user: { email: EMAIL, ip_address: IP }, request: { cookies: COOKIE, data: SYMPTOM }, extra: { SYMPTOM }, contexts: { os: {} }, breadcrumbs: [{ message: SYMPTOM }],
    sdk: { name: "sentry.javascript.node", version: "11.6.0", integrations: ["x"], packages: [] },
  });
  assert.deepEqual(scrubbed, {
    event_id: "abc", timestamp: 1, platform: "node", level: "error", environment: "production",
    exception: { values: [{ type: "Error", mechanism: { type: "generic", handled: true }, stacktrace: { frames: [{ filename: "src/routes/symptoms.js", function: "save", lineno: 10, colno: 5, in_app: true }] } }] },
    tags: { requestId: "r1", route: "/api/symptoms", status: "500" },
    sdk: { name: "sentry.javascript.node", version: "11.6.0" },
  });
});

// Unhandled errors end the process as before, after they are reported (scrubbed).
for (const [kind, crash] of [["an uncaught exception", `setTimeout(() => { throw new Error(${JSON.stringify(SYMPTOM)}); }, 10);`], ["an unhandled rejection", `Promise.reject(new RangeError(${JSON.stringify(SYMPTOM)}));`]]) {
  test(`${kind} is reported and still ends the process`, async () => {
    const script = `
      const { initErrorTracking } = require(${JSON.stringify(path.join(__dirname, "../src/errorTracking"))});
      initErrorTracking({ SENTRY_DSN: ${JSON.stringify(dsn)}, APP_ENV: "production" });
      ${crash}`;
    const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "ignore", "pipe"] });
    const code = await new Promise((resolve) => child.on("exit", resolve));
    assert.equal(code, 1);
    const [{ text, event }] = await waitForEvents(1);
    assertNothingPersonal(text);
    assert.equal(event.environment, "production");
    assert.equal(event.exception.values[0].mechanism.handled, false);
    assert.equal(event.exception.values[0].type, kind.includes("rejection") ? "RangeError" : "Error");
  });
}

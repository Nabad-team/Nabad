const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
const { errorDetails, errorHandler, INVALID_DETAILS } = require("../src/logger");
const { UserError, GENERIC_ERROR } = require("../src/userError");

// No raw library or database error message (JWT, Mongoose, MongoDB, crypto) ever reaches the user: they get a
// clear message, and the logs get what is safe (the error's type, code and field names, never its message).
let mongod, server, base, sent = [];
const password = "Safe errors test password 123!";
const INVALID_CHALLENGE = "Invalid verification challenge.";
const RAW = /jwt|signature|malformed|Cast to|ObjectId|E11000|Mongo|validation failed|Path `/i;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) process.env[key] = "test";
  mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => { sent.push(message); } }));
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  // Every request from its own address, so the per-IP code limiter never interferes.
  process.env.TRUST_PROXY = "1";
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  delete process.env.TRUST_PROXY;
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => { await User.deleteMany({}); sent = []; });

let visitor = 0;
async function request(method, path, { body, cookie } = {}) {
  visitor += 1;
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, "X-Forwarded-For": `203.0.113.${visitor % 250}`, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
// Everything the server writes to stdout while fn runs.
async function captureLogs(fn) {
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { written.push(String(chunk)); return original.call(this, chunk, ...rest); };
  try { await fn(); } finally { process.stdout.write = original; }
  return written.join("").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}
async function twoFactorUser(email = "owner@example.test") {
  return User.create({ name: "Owner", email, passwordHash: await bcrypt.hash(password, 4), twoFactorEnabled: true, emailVerified: true });
}
const sign = (payload, options = {}) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "10m", ...options });

test("2FA verify and resend answer a bad challenge with a clear message, never the JWT library's", async () => {
  const user = await twoFactorUser();
  const id = String(user._id);
  const badChallenges = {
    malformed: "x",
    "not three parts": "abc.def",
    "wrong signature": jwt.sign({ sub: id, purpose: "2fa", ver: 0 }, "another secret that is long enough to sign with", { expiresIn: "10m" }),
    "unsigned (alg none)": jwt.sign({ sub: id, purpose: "2fa", ver: 0 }, null, { algorithm: "none" }),
    "not a 2fa challenge": sign({ sub: id, ver: 0 }),
    "sub is not an id": sign({ sub: "not-an-id", purpose: "2fa", ver: 0 }),
    "sub is an object": sign({ sub: { $ne: null }, purpose: "2fa", ver: 0 }),
    "unknown account": sign({ sub: "000000000000000000000000", purpose: "2fa", ver: 0 }),
    "old session version": sign({ sub: id, purpose: "2fa", ver: 5 }),
    missing: undefined,
    empty: "",
    "a number": 12345,
    "an object": { token: "x" },
  };
  for (const route of ["/auth/2fa/verify", "/auth/2fa/resend"]) {
    for (const [name, challenge] of Object.entries(badChallenges)) {
      const response = await request("POST", route, { body: { challenge, code: "123456" } });
      assert.equal(response.status, 401, `${route} ${name}`);
      assert.deepEqual(response.body, { error: INVALID_CHALLENGE }, `${route} ${name}`);
    }
  }
  assert.equal(sent.length, 0, "no code was sent");
});

test("an expired challenge says to sign in again", async () => {
  const user = await twoFactorUser();
  const expired = jwt.sign({ sub: String(user._id), purpose: "2fa", ver: 0, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
  for (const route of ["/auth/2fa/verify", "/auth/2fa/resend"]) {
    const response = await request("POST", route, { body: { challenge: expired, code: "123456" } });
    assert.deepEqual([response.status, response.body], [401, { error: "This sign-in has expired. Please sign in again." }]);
  }
});

test("the real JWT error is logged with its type and reason, but never the token", async () => {
  const user = await twoFactorUser();
  const forged = jwt.sign({ sub: String(user._id), purpose: "2fa", ver: 0 }, "another secret that is long enough to sign with");
  const logs = await captureLogs(async () => {
    await request("POST", "/auth/2fa/verify", { body: { challenge: "x", code: "123456" } });
    await request("POST", "/auth/2fa/verify", { body: { challenge: forged, code: "123456" } });
  });
  const errors = logs.filter((entry) => entry.event === "request_error");
  assert.deepEqual(errors.map((entry) => [entry.errorType, entry.reason]), [["JsonWebTokenError", "jwt malformed"], ["JsonWebTokenError", "invalid signature"]]);
  const text = JSON.stringify(logs);
  assert.ok(!text.includes(forged) && !text.includes(forged.split(".")[2]), "the token is not logged");
  assert.ok(!text.includes("123456"));
});

test("a database failure during 2FA gives the generic message, and logs only safe details", async (t) => {
  const user = await twoFactorUser();
  const challenge = sign({ sub: String(user._id), purpose: "2fa", ver: 0 });
  const secretBits = "password=hunter2 Migraine";
  t.mock.method(User, "findById", async () => {
    throw Object.assign(new Error(`connection to 10.0.0.7:27017 closed (${secretBits})`), { name: "MongoNetworkError", code: "ECONNRESET" });
  });
  let response;
  const logs = await captureLogs(async () => { response = await request("POST", "/auth/2fa/verify", { body: { challenge, code: "123456" } }); });
  assert.equal(response.status, 500);
  assert.equal(response.body.error, GENERIC_ERROR);
  assert.match(response.body.requestId, /^[0-9a-f-]{36}$/);
  const logged = logs.find((entry) => entry.event === "request_error");
  assert.deepEqual([logged.errorType, logged.errorCode, logged.requestId], ["MongoNetworkError", "ECONNRESET", response.body.requestId]);
  assert.ok(!JSON.stringify(logs).includes("hunter2") && !JSON.stringify(logs).includes("Migraine") && !JSON.stringify(logs).includes("10.0.0.7"));
});

test("enabling 2FA: a database error is never shown, and is logged with its code name only", async (t) => {
  const account = await User.create({ name: "Setup", email: "setup@example.test", passwordHash: await bcrypt.hash(password, 4), emailVerified: true });
  const cookie = jwt.sign({ sub: String(account._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  assert.equal((await request("POST", "/auth/2fa/setup", { cookie })).status, 200);
  t.mock.method(User.prototype, "save", async () => {
    throw Object.assign(new Error('E11000 duplicate key error collection: nabad.users index: email_1 dup key: { email: "private@example.test" }'), { name: "MongoServerError", code: 11000, codeName: "DuplicateKey" });
  });
  let response;
  const logs = await captureLogs(async () => { response = await request("POST", "/auth/2fa/enable", { cookie, body: { code: "000000" } }); });
  assert.equal(response.status, 500);
  assert.equal(response.body.error, GENERIC_ERROR);
  assert.doesNotMatch(JSON.stringify(response.body), RAW);
  const logged = logs.find((entry) => entry.event === "request_error");
  assert.deepEqual([logged.errorType, logged.errorCode, logged.reason], ["MongoServerError", 11000, "DuplicateKey"]);
  assert.ok(!JSON.stringify(logs).includes("private@example.test"));
});

test("when email isn't configured, 2FA sign-in says so in plain words", async () => {
  await twoFactorUser();
  const saved = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try {
    const response = await request("POST", "/auth/login", { body: { email: "owner@example.test", password } });
    assert.deepEqual([response.status, response.body], [503, { error: "Sending email is temporarily unavailable. Please try again later." }]);
  } finally { process.env.SMTP_HOST = saved; }
});

test("the messages written for users still come through unchanged", async () => {
  const user = await twoFactorUser();
  const login = await request("POST", "/auth/login", { body: { email: user.email, password } });
  const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];
  const wrong = String((Number(code) + 1) % 1000000).padStart(6, "0");
  assert.deepEqual((await request("POST", "/auth/2fa/verify", { body: { challenge: login.body.challenge, code: wrong } })).body, { error: "Invalid verification code." });
  const resend = await request("POST", "/auth/2fa/resend", { body: { challenge: login.body.challenge } });
  assert.equal(resend.status, 429);
  assert.equal(resend.body.error, "Please wait before requesting another verification code.");
  assert.ok(resend.body.retryAfter > 0);
  assert.equal((await request("POST", "/auth/2fa/verify", { body: { challenge: login.body.challenge, code } })).status, 200);
});

// The central error handler (logger.js) for errors that reach it through asyncRoute.
function runHandler(error) {
  const res = {
    headersSent: false, statusCode: 0, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const req = { requestId: "req-1" };
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => { written.push(String(chunk)); return true; };
  try { errorHandler(error, req, res, () => {}); } finally { process.stdout.write = original; }
  return { res, log: JSON.parse(written[0]) };
}

test("a Mongoose validation error becomes a clear 400, logged by field name without the value", () => {
  const Model = mongoose.models.SafeErrorProbe || mongoose.model("SafeErrorProbe", new mongoose.Schema({ glasses: { type: Number, max: 30 }, condition: { type: String, enum: ["asthma"] } }));
  const error = new Model({ glasses: 9999, condition: "Private condition name" }).validateSync();
  assert.equal(error.name, "ValidationError");
  const { res, log } = runHandler(error);
  assert.deepEqual([res.statusCode, res.body], [400, { error: INVALID_DETAILS, requestId: "req-1" }]);
  assert.deepEqual([log.errorType, log.errorFields, log.reason], ["ValidationError", "glasses,condition", "max,enum"]);
  assert.ok(!JSON.stringify(log).includes("9999") && !JSON.stringify(log).includes("Private condition"));
});

test("a Mongoose cast error becomes a clear 400, logged by path and kind without the value", () => {
  const error = new mongoose.Error.CastError("ObjectId", "secret-looking-value", "profileId");
  const { res, log } = runHandler(error);
  assert.deepEqual([res.statusCode, res.body.error], [400, INVALID_DETAILS]);
  assert.deepEqual([log.errorType, log.errorFields, log.reason], ["CastError", "profileId", "cast_to_objectid"]);
  assert.ok(!JSON.stringify(log).includes("secret-looking-value"));
});

test("any other error is a generic 500, and its message is never logged", () => {
  for (const error of [new Error("Migraine"), new TypeError("Cannot read properties of undefined (reading 'value')"), Object.assign(new Error("bad decrypt"), { code: "ERR_OSSL_BAD_DECRYPT" })]) {
    const { res, log } = runHandler(error);
    assert.deepEqual([res.statusCode, res.body.error], [500, "An internal error occurred."]);
    assert.equal(log.reason, undefined, error.message);
    assert.ok(!JSON.stringify(log).includes(error.message));
  }
  assert.deepEqual(errorDetails(Object.assign(new Error("bad decrypt"), { code: "ERR_OSSL_BAD_DECRYPT" })), { errorType: "Error", errorCode: "ERR_OSSL_BAD_DECRYPT" });
  // Codes that aren't simple identifiers are left out too.
  assert.equal(errorDetails(Object.assign(new Error("x"), { code: "has spaces and private text" })).errorCode, undefined);
  // Only JWT's own fixed messages are kept as the reason.
  assert.equal(errorDetails(new jwt.JsonWebTokenError("jwt malformed")).reason, "jwt malformed");
  assert.equal(errorDetails(new jwt.JsonWebTokenError("jwt audience invalid. expected: secret-aud")).reason, undefined);
});

test("a UserError keeps its own message and status", () => {
  const error = new UserError("Please wait.", 429, { retryAfter: 30 });
  assert.deepEqual([error.message, error.status, error.retryAfter], ["Please wait.", 429, 30]);
});

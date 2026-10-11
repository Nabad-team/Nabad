// Story #2: "As a user, I want to verify my email so that my account is secure."
// Integration tests over HTTP with a real database. Outgoing email is captured instead of sent.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");

let mongod, server, base, sent = [];
const password = "Verify test password 123!";
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"), CLIENT_ORIGIN: "http://localhost:3000",
    SMTP_HOST: "smtp.example.test", SMTP_USER: "smtp-user", SMTP_PASS: "smtp-pass", EMAIL_FROM: "Nabad <no-reply@example.test>",
    // Each test uses its own client IP so the signup rate limit (5 per hour per IP) is not shared.
    TRUST_PROXY: "1" });
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => { server?.close(); await mongoose.disconnect(); await mongod?.stop(); delete process.env.TRUST_PROXY; });
beforeEach(async (t) => {
  await User.deleteMany({}); sent = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => { sent.push(message); } }));
});

let ipCounter = 0;
async function call(path, { body, cookie, ip = `10.1.0.${++ipCounter}` } = {}) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, "X-Forwarded-For": ip, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function waitFor(check) {
  for (let i = 0; i < 250; i++) { if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 20)); }
  throw new Error("Timed out waiting for background email.");
}
const tokenFrom = (message) => message.text.match(/verify-email\?token=([a-f0-9]{64})/)[1];
const cookieFrom = (res) => res.headers.get("set-cookie").split(";")[0].split("=")[1];
const cookieFor = (account) => jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
async function signupRana() {
  const res = await call("/auth/signup", { body: { name: "Rana", email: "rana@example.test", password } });
  assert.equal(res.status, 201);
  await waitFor(() => sent.length === 1);
  return { res, token: tokenFrom(sent[0]), cookie: cookieFrom(res) };
}

test("signup creates an unverified account and emails a verification link", async () => {
  const { res, token } = await signupRana();
  assert.equal(res.body.user.emailVerified, false);
  assert.equal(sent[0].to, "rana@example.test");
  assert.match(sent[0].text, /http:\/\/localhost:3000\/verify-email\?token=/);
  const saved = await User.findOne({ email: "rana@example.test" });
  assert.equal(saved.emailVerified, false);
  // Only the hash is stored, never the token from the email.
  assert.notEqual(saved.emailVerifyTokenHash, token);
  assert.equal(saved.emailVerifyTokenHash, crypto.createHash("sha256").update(token).digest("hex"));
});

test("opening the link verifies the email, and /auth/me reports it", async () => {
  const { token, cookie } = await signupRana();
  assert.equal((await call("/auth/me", { cookie })).body.user.emailVerified, false);
  const res = await call("/auth/verify-email", { body: { token } });
  assert.equal(res.status, 200);
  assert.equal(res.body.emailVerified, true);
  assert.equal((await call("/auth/me", { cookie })).body.user.emailVerified, true);
});

test("a link works only once", async () => {
  const { token } = await signupRana();
  assert.equal((await call("/auth/verify-email", { body: { token } })).status, 200);
  assert.equal((await call("/auth/verify-email", { body: { token } })).status, 400);
});

test("an expired link is rejected and the email stays unverified", async () => {
  const { token } = await signupRana();
  await User.updateOne({ email: "rana@example.test" }, { $set: { emailVerifyExpires: new Date(Date.now() - 1000) } });
  assert.equal((await call("/auth/verify-email", { body: { token } })).status, 400);
  assert.equal((await User.findOne({ email: "rana@example.test" })).emailVerified, false);
});

test("wrong, malformed and missing tokens are rejected", async () => {
  await signupRana();
  for (const body of [{ token: "a".repeat(64) }, { token: "not-a-token" }, { token: 123 }, {}]) {
    assert.equal((await call("/auth/verify-email", { body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await User.findOne({ email: "rana@example.test" })).emailVerified, false);
});

test("resend issues a new link to the account's own address and the old link stops working", async () => {
  const { token: oldToken, cookie } = await signupRana();
  await User.updateOne({ email: "rana@example.test" }, { $set: { emailVerifyLastSent: new Date(Date.now() - 61 * 1000) } });
  // An email in the body is ignored: the link only ever goes to the signed-in account's address.
  const res = await call("/auth/verify-email/resend", { cookie, body: { email: "attacker@example.test" } });
  assert.equal(res.status, 200);
  await waitFor(() => sent.length === 2);
  assert.equal(sent[1].to, "rana@example.test");
  assert.equal((await call("/auth/verify-email", { body: { token: oldToken } })).status, 400);
  assert.equal((await call("/auth/verify-email", { body: { token: tokenFrom(sent[1]) } })).status, 200);
});

test("resend is limited to one email per minute", async () => {
  const { cookie } = await signupRana();
  const res = await call("/auth/verify-email/resend", { cookie, body: {} });
  assert.equal(res.status, 429);
  assert.ok(res.body.retryAfter > 0 && res.body.retryAfter <= 60);
  assert.equal(sent.length, 1);
});

test("resend needs sign-in and refuses already-verified accounts", async () => {
  assert.equal((await call("/auth/verify-email/resend", { body: {} })).status, 401);
  const verified = await User.create({ name: "V", email: "v@example.test", passwordHash: "x", emailVerified: true });
  assert.equal((await call("/auth/verify-email/resend", { cookie: cookieFor(verified), body: {} })).status, 400);
  const google = await User.create({ name: "G", email: "g@example.test", passwordHash: "x", authProvider: "google", googleId: "g-1" });
  assert.equal((await call("/auth/verify-email/resend", { cookie: cookieFor(google), body: {} })).status, 400);
  assert.equal(sent.length, 0);
});

test("Google accounts count as verified even if created before this feature", async () => {
  const google = await User.create({ name: "G", email: "g@example.test", passwordHash: "x", authProvider: "google", googleId: "g-2" });
  assert.equal((await call("/auth/me", { cookie: cookieFor(google) })).body.user.emailVerified, true);
});

test("completing a password reset also verifies the email (the link proves inbox access)", async () => {
  await signupRana();
  await call("/auth/forgot-password", { body: { email: "rana@example.test" } });
  await waitFor(() => sent.length === 2);
  const resetToken = sent[1].text.match(/token=([a-f0-9]{64})/)[1];
  assert.equal((await call("/auth/reset-password", { body: { token: resetToken, password: "Another strong password 456!" } })).status, 200);
  assert.equal((await User.findOne({ email: "rana@example.test" })).emailVerified, true);
});

test("signup still succeeds when email is not configured; resend then answers 503", async () => {
  const saved = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try {
    const res = await call("/auth/signup", { body: { name: "Rana", email: "nomail@example.test", password } });
    assert.equal(res.status, 201);
    await User.updateOne({ email: "nomail@example.test" }, { $set: { emailVerifyLastSent: null } });
    assert.equal((await call("/auth/verify-email/resend", { cookie: cookieFrom(res), body: {} })).status, 503);
    assert.equal(sent.length, 0);
  } finally { process.env.SMTP_HOST = saved; }
});

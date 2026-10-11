const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
let mongod, server, base, sent = [];
const password = "Email test password 123!";
const smtpPassword = "Fake-Smtp-Pass-" + crypto.randomBytes(8).toString("hex");
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"), CLIENT_ORIGIN: "http://localhost:3000",
    SMTP_HOST: "smtp.example.test", SMTP_USER: "smtp-user", SMTP_PASS: smtpPassword, EMAIL_FROM: "Nabad <no-reply@example.test>",
    // Each test uses its own client IP so the shared reset rate limit (5 per hour) is not exhausted.
    TRUST_PROXY: "1" });
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => { server?.close(); await mongoose.disconnect(); await mongod?.stop(); delete process.env.TRUST_PROXY; });
beforeEach(async () => { await User.deleteMany({}); sent = []; });
async function user(email = "elias@example.test") { return User.create({ name: "Elias", email, passwordHash: await bcrypt.hash(password, 4) }); }
async function request(path, body, ip) {
  const started = performance.now();
  const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, "X-Forwarded-For": ip }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json(), ms: performance.now() - started };
}
async function waitFor(check) {
  for (let i = 0; i < 250; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error("Timed out waiting for background work.");
}
const neverResolves = () => new Promise(() => {});
const resetToken = message => message.text.match(/token=([a-f0-9]{64})/)[1];

test("forgot-password answers immediately and identically whether or not the account exists", async (t) => {
  await user();
  // SMTP that never answers, like the blocked port on Render.
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: message => { sent.push(message); return neverResolves(); } }));
  const known = await request("/auth/forgot-password", { email: "elias@example.test" }, "10.0.0.1");
  const unknown = await request("/auth/forgot-password", { email: "nobody@example.test" }, "10.0.0.1");
  assert.equal(known.status, 200); assert.deepEqual(known.body, unknown.body);
  assert.ok(known.ms < 3000 && unknown.ms < 3000, `responses took ${known.ms} and ${unknown.ms} ms`);
  await waitFor(() => sent.length === 1);
  assert.equal(sent[0].to, "elias@example.test");
});

test("two-factor login does not wait for the email to be delivered", async (t) => {
  const account = await user(); await User.updateOne({ _id: account._id }, { $set: { twoFactorEnabled: true } });
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: message => { sent.push(message); return neverResolves(); } }));
  const login = await request("/auth/login", { email: account.email, password }, "10.0.0.2");
  assert.equal(login.body.twoFactorRequired, true); assert.ok(login.ms < 3000);
  assert.match(sent[0].text, /\b\d{6}\b/);
});

test("SMTP uses 10 second timeouts and failures log the error code but never the SMTP password", async (t) => {
  await user();
  let options;
  t.mock.method(nodemailer, "createTransport", (opts) => {
    options = opts;
    return { sendMail: async () => { throw Object.assign(new Error(`Invalid login: 535 rejected ${smtpPassword}`), { code: "EAUTH" }); } };
  });
  const lines = [];
  const write = process.stdout.write;
  t.mock.method(process.stdout, "write", function (text, ...rest) { lines.push(String(text)); return write.call(this, text, ...rest); });
  const res = await request("/auth/forgot-password", { email: "elias@example.test" }, "10.0.0.3");
  assert.equal(res.status, 200);
  await waitFor(() => lines.some(line => line.includes('"email_failed"')));
  const entry = JSON.parse(lines.find(line => line.includes('"email_failed"')));
  assert.equal(entry.errorCode, "EAUTH");
  assert.equal(lines.join("").includes(smtpPassword), false);
  assert.deepEqual([options.connectionTimeout, options.greetingTimeout, options.socketTimeout], [10000, 10000, 10000]);
});

test("reset tokens last one hour, are single-use, and a new request invalidates the previous one", async (t) => {
  const account = await user();
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async message => { sent.push(message); } }));
  await request("/auth/forgot-password", { email: account.email }, "10.0.0.4");
  await waitFor(() => sent.length === 1);
  const requestedAt = Date.now();
  await request("/auth/forgot-password", { email: account.email }, "10.0.0.4");
  await waitFor(() => sent.length === 2);
  const [first, second] = sent.map(resetToken);
  const expires = (await User.findById(account._id)).resetPasswordExpires.getTime();
  assert.ok(Math.abs(expires - (requestedAt + 60 * 60 * 1000)) < 60 * 1000);
  assert.equal((await request("/auth/reset-password", { token: first, password: "New password 123!" }, "10.0.0.4")).status, 400);
  assert.equal((await request("/auth/reset-password", { token: second, password: "New password 123!" }, "10.0.0.4")).status, 200);
  assert.equal((await request("/auth/reset-password", { token: second, password: "Other password 123!" }, "10.0.0.5")).status, 400);
  const expired = "b".repeat(64);
  await User.updateOne({ _id: account._id }, { $set: { resetPasswordTokenHash: crypto.createHash("sha256").update(expired).digest("hex"), resetPasswordExpires: new Date(Date.now() - 1000) } });
  assert.equal((await request("/auth/reset-password", { token: expired, password: "Other password 123!" }, "10.0.0.5")).status, 400);
});

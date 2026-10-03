const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
let mongod, server, base, sent = [];
const password = "Remembered device password 123!";
const DAY = 24 * 60 * 60 * 1000;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

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
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => { await User.deleteMany({}); sent = []; });

async function account(email = "trusted@example.test") {
  return User.create({ name: "Trusted", email, passwordHash: await bcrypt.hash(password, 4), twoFactorEnabled: true });
}
async function request(method, path, { body, cookies = {} } = {}) {
  const cookie = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ");
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, setCookies: response.headers.getSetCookie() };
}
const cookieHeader = (res, name) => res.setCookies.find(value => value.startsWith(name + "="));
const cookieValue = (res, name) => cookieHeader(res, name)?.split(";")[0].slice(name.length + 1);
const login = (email, cookies) => request("POST", "/auth/login", { body: { email, password }, cookies });

// Signs in with password and email code, optionally remembering the device.
async function signInWithCode(email, rememberDevice) {
  const first = await login(email);
  assert.equal(first.body.twoFactorRequired, true);
  const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];
  const verified = await request("POST", "/auth/2fa/verify", { body: { challenge: first.body.challenge, code, ...(rememberDevice === undefined ? {} : { rememberDevice }) } });
  assert.equal(verified.status, 200);
  return verified;
}

test("remembering a device sets a secure 30-day cookie, stores only its hash, and skips the code next time", async () => {
  const user = await account();
  const verified = await signInWithCode(user.email, true);
  const header = cookieHeader(verified, "trustedDevice");
  assert.ok(header);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /Secure/i);
  assert.match(header, /SameSite=Lax/i);
  assert.match(header, /Path=\/api\/auth/);
  assert.match(header, /Max-Age=2592000/);
  const token = cookieValue(verified, "trustedDevice");
  assert.match(token, /^[a-f0-9]{64}$/);

  const saved = await User.findById(user._id).lean();
  assert.equal(saved.trustedDevices.length, 1);
  assert.equal(saved.trustedDevices[0].tokenHash, sha256(token));
  assert.equal(JSON.stringify(saved).includes(token), false);
  assert.ok(Math.abs(saved.trustedDevices[0].expiresAt - (Date.now() + 30 * DAY)) < 60 * 1000);

  const codesSent = sent.length;
  const again = await login(user.email, { trustedDevice: token });
  assert.equal(again.status, 200);
  assert.equal(again.body.user.email, user.email);
  assert.ok(cookieHeader(again, "accessToken"));
  assert.equal(sent.length, codesSent);

  // Without the cookie, or with a wrong one, a code is still required (reset the 60-second resend limit between tries).
  for (const cookies of [{}, { trustedDevice: "f".repeat(64) }]) {
    await User.updateOne({ _id: user._id }, { $set: { twoFactorCodeLastSent: null } });
    assert.equal((await login(user.email, cookies)).body.twoFactorRequired, true);
  }
});

test("without the checkbox no device is remembered", async () => {
  const user = await account();
  for (const rememberDevice of [undefined, false, "true"]) {
    await User.updateOne({ _id: user._id }, { $set: { twoFactorCodeLastSent: null } });
    const verified = await signInWithCode(user.email, rememberDevice);
    assert.equal(cookieHeader(verified, "trustedDevice"), undefined);
  }
  assert.equal((await User.findById(user._id)).trustedDevices.length, 0);
});

test("a device token only works for its own account and not after it expires", async () => {
  const user = await account();
  const other = await account("other@example.test");
  const token = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ _id: user._id }, { $set: { trustedDevices: [{ tokenHash: sha256(token), expiresAt: new Date(Date.now() - 1000) }] } });
  assert.equal((await login(user.email, { trustedDevice: token })).body.twoFactorRequired, true);
  await User.updateOne({ _id: user._id }, { $set: { trustedDevices: [{ tokenHash: sha256(token), expiresAt: new Date(Date.now() + DAY) }] } });
  assert.equal((await login(other.email, { trustedDevice: token })).body.twoFactorRequired, true);
});

test("a user keeps at most 10 trusted devices, dropping expired and then the oldest", async () => {
  const user = await account();
  const devices = [{ tokenHash: sha256("expired"), expiresAt: new Date(Date.now() - DAY) }];
  for (let i = 0; i < 10; i++) devices.push({ tokenHash: sha256("device-" + i), expiresAt: new Date(Date.now() + (i + 1) * DAY) });
  await User.updateOne({ _id: user._id }, { $set: { trustedDevices: devices } });
  const token = cookieValue(await signInWithCode(user.email, true), "trustedDevice");
  const hashes = (await User.findById(user._id)).trustedDevices.map(device => device.tokenHash);
  assert.equal(hashes.length, 10);
  assert.equal(hashes.includes(sha256("expired")), false);
  assert.equal(hashes.includes(sha256("device-0")), false);
  assert.equal(hashes.includes(sha256("device-1")), true);
  assert.equal(hashes.includes(sha256(token)), true);
});

test("a password reset removes every trusted device", async () => {
  const user = await account();
  const token = cookieValue(await signInWithCode(user.email, true), "trustedDevice");
  const resetToken = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenHash: sha256(resetToken), resetPasswordExpires: new Date(Date.now() + 60000) } });
  assert.equal((await request("POST", "/auth/reset-password", { body: { token: resetToken, password } })).status, 200);
  assert.equal((await User.findById(user._id)).trustedDevices.length, 0);
  assert.equal((await login(user.email, { trustedDevice: token })).body.twoFactorRequired, true);
});

test("turning 2FA off removes every trusted device and clears the cookie", async () => {
  const user = await account();
  const verified = await signInWithCode(user.email, true);
  const cookies = { accessToken: cookieValue(verified, "accessToken"), trustedDevice: cookieValue(verified, "trustedDevice") };
  const disabled = await request("POST", "/auth/2fa/disable", { body: { password }, cookies });
  assert.equal(disabled.status, 200);
  assert.match(cookieHeader(disabled, "trustedDevice"), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await User.findById(user._id)).trustedDevices.length, 0);
});

test("deleting the account removes its trusted devices and clears the cookie", async () => {
  const user = await account();
  const verified = await signInWithCode(user.email, true);
  const deleted = await request("DELETE", "/profile/me", { body: { confirm: "DELETE", password }, cookies: { accessToken: cookieValue(verified, "accessToken") } });
  assert.equal(deleted.status, 204);
  assert.match(cookieHeader(deleted, "trustedDevice"), /Expires=Thu, 01 Jan 1970/);
  assert.equal(await User.countDocuments({ _id: user._id }), 0);
});

test("Google accounts cannot set up email 2FA", async () => {
  const user = await User.create({ name: "G", email: "g@example.test", googleId: "google-1", authProvider: "google", passwordHash: await bcrypt.hash(password, 4) });
  const { signAccessToken } = require("../src/session");
  const cookies = { accessToken: signAccessToken(user) };
  for (const [path, body] of [["/auth/2fa/setup", undefined], ["/auth/2fa/enable", { code: "123456" }]]) {
    const res = await request("POST", path, { body, cookies });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Google accounts are protected by Google sign-in and do not use email codes.");
  }
  assert.equal(sent.length, 0);
  assert.equal((await User.findById(user._id)).twoFactorEnabled, false);
});

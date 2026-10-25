const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
const { hashCode, LOCKED_MESSAGE } = require("../src/twoFactorProtection");
let mongod, server, base, sent = [];
const password = "Brute force test password 123!";
const SECRET = crypto.randomBytes(32).toString("hex");
const MINUTE = 60 * 1000;
const ALERT_SUBJECT = "Incorrect sign-in codes on your Nabad account";

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.TWO_FACTOR_CODE_SECRET = SECRET;
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  // Each request comes from a new address (X-Forwarded-For), so the per-IP limiter never steps in:
  // the per-account protection must hold on its own, as it would against an attacker rotating IPs.
  process.env.TRUST_PROXY = "1";
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) process.env[key] = "test";
  mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => { sent.push(message); } }));
  mongod = await createTestMongo();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
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
beforeEach(async () => {
  await User.deleteMany({});
  sent = [];
  process.env.TWO_FACTOR_CODE_SECRET = SECRET;
});

let visitor = 0;
async function request(method, path, body) {
  visitor += 1;
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, "X-Forwarded-For": `198.51.${Math.floor(visitor / 250) % 250}.${visitor % 250}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
async function account(email = "owner@example.test") {
  return User.create({ name: "Owner", email, passwordHash: await bcrypt.hash(password, 4), twoFactorEnabled: true, emailVerified: true });
}
const login = (email = "owner@example.test", pass = password) => request("POST", "/auth/login", { email, password: pass });
const verify = (challenge, code) => request("POST", "/auth/2fa/verify", { challenge, code });
const resend = (challenge) => request("POST", "/auth/2fa/resend", { challenge });
const codes = (email = "owner@example.test") => sent.filter((m) => m.to === email && m.subject === "Your Nabad verification code").map((m) => m.text.match(/\b\d{6}\b/)[0]);
const latestCode = (email) => codes(email).at(-1);
const alerts = (email = "owner@example.test") => sent.filter((m) => m.to === email && m.subject === ALERT_SUBJECT);
// A 6-digit code that is certainly not the right one.
const wrong = (code) => String((Number(code) + 1) % 1000000).padStart(6, "0");
// Skips the existing 60-second wait between codes, so a test can ask for the next one at once.
const skipResendWait = (email = "owner@example.test") => User.updateOne({ email }, { $set: { twoFactorCodeLastSent: null } });
async function startSignIn(email) {
  const response = await login(email);
  assert.equal(response.status, 200);
  assert.equal(response.body.twoFactorRequired, true);
  return response.body.challenge;
}
// Enters n wrong codes, asking for a new code whenever the current one is cancelled (after 5 wrong tries).
async function enterWrongCodes(challenge, n, email = "owner@example.test") {
  let onThisCode = 0;
  const results = [];
  for (let i = 0; i < n; i++) {
    if (onThisCode === 5) {
      await skipResendWait(email);
      assert.equal((await resend(challenge)).status, 200);
      onThisCode = 0;
    }
    results.push(await verify(challenge, wrong(latestCode(email))));
    onThisCode += 1;
  }
  return results;
}

test("10 wrong codes within an hour, across codes, lock the 2FA step for 30 minutes with one calm message", async () => {
  const user = await account();
  const challenge = await startSignIn(user.email);
  const results = await enterWrongCodes(challenge, 10);

  assert.deepEqual(results.slice(0, 9).map((r) => r.status), Array(9).fill(401));
  assert.equal(results[4].body.error, "Too many incorrect attempts. This verification code has been cancelled. Request a new code.");
  assert.equal(results[9].status, 429);
  assert.deepEqual(results[9].body, { error: "Too many incorrect codes. For your security, please try again in 30 minutes.", retryAfter: 1800 });
  assert.equal(codes().length, 2, "the 10 wrong codes were spread over two codes");

  const saved = await User.findById(user._id);
  assert.ok(Math.abs(saved.twoFactorLockedUntil - Date.now() - 30 * MINUTE) < MINUTE);
  assert.deepEqual(saved.twoFactorFailedAttempts, [], "the count starts again after the lock");

  // While locked: even the right code is refused, no new code is sent, and signing in again says the same.
  const right = latestCode();
  assert.deepEqual((await verify(challenge, right)).body, { error: LOCKED_MESSAGE, retryAfter: 1800 });
  await skipResendWait();
  assert.equal((await resend(challenge)).body.error, LOCKED_MESSAGE);
  const again = await login();
  assert.equal(again.status, 429);
  assert.equal(again.body.error, LOCKED_MESSAGE);
  assert.equal(codes().length, 2, "no code is sent while locked");
  // A wrong password still gets the usual answer: the lock is never revealed to someone without the password.
  assert.deepEqual((await login(user.email, "not the password")).body, { error: "Invalid email or password." });

  // After the 30 minutes, signing in works again.
  await User.updateOne({ _id: user._id }, { $set: { twoFactorLockedUntil: new Date(Date.now() - 1000), failedLoginAttempts: 0 } });
  await skipResendWait();
  const fresh = await startSignIn(user.email);
  assert.equal((await verify(fresh, latestCode())).status, 200);
});

test("wrong codes older than an hour don't count", async () => {
  const user = await account();
  const old = Array.from({ length: 9 }, () => new Date(Date.now() - 61 * MINUTE));
  await User.updateOne({ _id: user._id }, { $set: { twoFactorFailedAttempts: old } });
  const challenge = await startSignIn(user.email);
  assert.equal((await verify(challenge, wrong(latestCode()))).status, 401);
  const saved = await User.findById(user._id);
  assert.equal(saved.twoFactorLockedUntil, null);
  assert.equal(saved.twoFactorFailedAttempts.length, 1, "the old ones were dropped");
});

test("a successful sign-in resets the wrong-code count", async () => {
  const user = await account();
  const challenge = await startSignIn(user.email);
  await enterWrongCodes(challenge, 9);
  assert.equal((await User.findById(user._id)).twoFactorFailedAttempts.length, 9);
  assert.equal((await verify(challenge, latestCode())).status, 200);
  assert.deepEqual((await User.findById(user._id)).twoFactorFailedAttempts, []);

  // Nine more wrong codes (18 in the hour, but only 9 since the success) don't lock.
  await skipResendWait();
  const next = await startSignIn(user.email);
  const results = await enterWrongCodes(next, 9);
  assert.ok(results.every((r) => r.status === 401));
  assert.equal((await User.findById(user._id)).twoFactorLockedUntil, null);
  assert.equal(alerts().length, 0);
});

test("the owner gets one alert email per lockout, even when wrong codes arrive together", async () => {
  const user = await account();
  const challenge = await startSignIn(user.email);
  await enterWrongCodes(challenge, 6);
  // Four wrong codes at the same moment: the 10th starts the lock. Only one request may send the alert.
  await skipResendWait();
  await resend(challenge);
  const code = latestCode();
  const together = await Promise.all(Array.from({ length: 4 }, () => verify(challenge, wrong(code))));
  assert.ok(together.some((r) => r.status === 429));
  await new Promise((resolve) => setImmediate(resolve));
  // More wrong codes while locked send nothing more.
  await verify(challenge, wrong(code));
  await verify(challenge, wrong(code));

  const sentAlerts = alerts();
  assert.equal(sentAlerts.length, 1);
  assert.equal(sentAlerts[0].text.split("\n")[0], "We noticed several incorrect sign-in codes on your Nabad account. If this wasn't you, reset your password.");
  assert.match(sentAlerts[0].text, /http:\/\/localhost:3000\/forgot-password/);
  assert.doesNotMatch(sentAlerts[0].text, /\b\d{6}\b/, "no code in the alert");

  // A later, separate lockout sends a new alert.
  await User.updateOne({ _id: user._id }, { $set: { twoFactorLockedUntil: new Date(Date.now() - 1000) } });
  await skipResendWait();
  const next = await startSignIn(user.email);
  await enterWrongCodes(next, 10);
  assert.equal(alerts().length, 2);
});

test("at most 5 codes are sent per account per hour, resends included, with a kind message saying when", async () => {
  const user = await account();
  const challenge = await startSignIn(user.email);
  for (let i = 0; i < 4; i++) {
    await skipResendWait();
    assert.equal((await resend(challenge)).status, 200, `resend ${i + 1}`);
  }
  assert.equal(codes().length, 5);

  await skipResendWait();
  const capped = await resend(challenge);
  assert.equal(capped.status, 429);
  assert.match(capped.body.error, /^For your security, we send at most 5 codes an hour\. You can request a new code in (59|60) minutes\.$/);
  assert.ok(capped.body.retryAfter > 58 * 60 && capped.body.retryAfter <= 3600);
  // Signing in again counts too.
  await skipResendWait();
  const viaLogin = await login();
  assert.equal(viaLogin.status, 429);
  assert.match(viaLogin.body.error, /^For your security, we send at most 5 codes an hour/);
  assert.equal(codes().length, 5, "nothing more was sent");
  // The codes already sent still work.
  assert.equal((await verify(challenge, latestCode())).status, 200);

  // The wait is counted from the oldest send in the hour.
  const sends = (await User.findById(user._id)).twoFactorCodeSends;
  sends[0] = new Date(Date.now() - 50 * MINUTE);
  await User.updateOne({ _id: user._id }, { $set: { twoFactorCodeSends: sends } });
  await skipResendWait();
  assert.match((await login()).body.error, /You can request a new code in 10 minutes\.$/);
  // Once it is over an hour old, a new code can be sent.
  sends[0] = new Date(Date.now() - 61 * MINUTE);
  await User.updateOne({ _id: user._id }, { $set: { twoFactorCodeSends: sends } });
  assert.equal((await login()).status, 200);
  assert.equal(codes().length, 6);
});

test("codes requested at the same moment still stop at 5", async () => {
  const user = await account();
  await User.updateOne({ _id: user._id }, { $set: { twoFactorCodeSends: [new Date(), new Date(), new Date()] } });
  const results = await Promise.all(Array.from({ length: 6 }, () => login()));
  // They all pass the 60-second wait together (none was sent yet when each started), so only the cap stops them.
  assert.equal(results.filter((r) => r.status === 200).length, 2);
  assert.equal(results.filter((r) => r.status === 429).length, 4);
  assert.equal((await User.findById(user._id)).twoFactorCodeSends.length, 5);
});

test("a lockout on one account doesn't affect another", async () => {
  const locked = await account("locked@example.test");
  const other = await account("other@example.test");
  const lockedChallenge = await startSignIn(locked.email);
  const otherChallenge = await startSignIn(other.email);
  const results = await enterWrongCodes(lockedChallenge, 10, locked.email);
  assert.equal(results.at(-1).status, 429);

  assert.equal((await verify(otherChallenge, latestCode(other.email))).status, 200);
  const saved = await User.findById(other._id);
  assert.equal(saved.twoFactorLockedUntil, null);
  assert.deepEqual(saved.twoFactorFailedAttempts, []);
  assert.equal(alerts(other.email).length, 0);
  assert.equal(alerts(locked.email).length, 1);
});

test("codes are stored as an HMAC-SHA256 keyed with TWO_FACTOR_CODE_SECRET, not a plain SHA-256", async () => {
  const user = await account();
  const challenge = await startSignIn(user.email);
  const code = latestCode();
  const stored = (await User.findById(user._id)).twoFactorCodeHash;
  assert.equal(stored, crypto.createHmac("sha256", SECRET).update(code).digest("hex"));
  assert.notEqual(stored, crypto.createHash("sha256").update(code).digest("hex"));
  assert.equal(stored, hashCode(code));

  // With another key (as after a change of secret) the same code no longer matches.
  process.env.TWO_FACTOR_CODE_SECRET = crypto.randomBytes(32).toString("hex");
  assert.notEqual(hashCode(code), stored);
  assert.equal((await verify(challenge, code)).status, 401);
  process.env.TWO_FACTOR_CODE_SECRET = SECRET;
  assert.equal((await verify(challenge, code)).status, 200);
});

test("a code stored by the old plain SHA-256 stops working after the change", async () => {
  const user = await account();
  const challenge = await startSignIn(user.email);
  const code = latestCode();
  await User.updateOne({ _id: user._id }, { $set: { twoFactorCodeHash: crypto.createHash("sha256").update(code).digest("hex") } });
  assert.deepEqual((await verify(challenge, code)).body, { error: "Invalid verification code." });
});

test("enabling 2FA from the security page checks the HMAC too", async () => {
  const user = await User.create({ name: "Setup", email: "setup@example.test", passwordHash: await bcrypt.hash(password, 4), emailVerified: true });
  const jwt = require("jsonwebtoken");
  const cookie = `accessToken=${jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" })}`;
  const call = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: cookie, "X-Forwarded-For": "192.0.2.77" }, body: JSON.stringify(body || {}) });
  assert.equal((await call("/auth/2fa/setup")).status, 200);
  const code = latestCode(user.email);
  assert.equal((await User.findById(user._id)).twoFactorCodeHash, hashCode(code));
  assert.equal((await call("/auth/2fa/enable", { code: wrong(code) })).status, 400);
  assert.equal((await call("/auth/2fa/enable", { code })).status, 200);
  assert.equal((await User.findById(user._id)).twoFactorEnabled, true);
});

test("never writes codes or their hashes to the logs", async () => {
  const user = await account();
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { written.push(String(chunk)); return original.call(this, chunk, ...rest); };
  let hashes = [];
  try {
    const challenge = await startSignIn(user.email);
    hashes.push((await User.findById(user._id)).twoFactorCodeHash);
    await enterWrongCodes(challenge, 10);
    hashes.push((await User.findById(user._id)).twoFactorCodeHash);
    await verify(challenge, latestCode());
  } finally { process.stdout.write = original; }
  const logs = written.join("");
  assert.match(logs, /"event":"two_factor_locked"/);
  // A code would be logged as a quoted value. (A bare 6-digit search could match by chance inside a request id.)
  for (const code of codes()) {
    assert.ok(!logs.includes(`"${code}"`), "a code is in the logs");
    assert.ok(!logs.includes(`"${wrong(code)}"`), "a typed code is in the logs");
  }
  assert.ok(!/"code"|"challenge"|twoFactorCodeHash/.test(logs));
  for (const value of hashes.filter(Boolean)) assert.ok(!logs.includes(value), "a code hash is in the logs");
  assert.ok(!logs.includes(SECRET));
});

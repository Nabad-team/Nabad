const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcryptjs = require("bcryptjs");
const argon2 = require("@node-rs/argon2");
const nativeBcrypt = require("@node-rs/bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../src/models/User");
const { ARGON2, verifyPassword, argon2NeedsRehash, dummyHashes } = require("../src/passwordHashing");

// Argon2id for new passwords, and old bcrypt hashes (made by bcryptjs, as in production) replaced at the next
// successful sign-in with no action from the user.
let mongod, server, base;
const CURRENT = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/;
const isBcrypt = (hash) => /^\$2[aby]\$/.test(hash);

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  process.env.PWNED_PASSWORDS_CHECK = "off";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  await dummyHashes();
  // Each request from its own address, so the per-IP signup and login limits never interfere.
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
beforeEach(async () => { await User.deleteMany({}); });

let visitor = 0;
async function request(method, path, body, cookie) {
  visitor += 1;
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, "X-Forwarded-For": `198.18.${Math.floor(visitor / 250) % 250}.${visitor % 250}`, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const signup = (password, email = "new@example.test") => request("POST", "/auth/signup", { name: "Pat Kim", email, password });
const login = (password, email = "old@example.test") => request("POST", "/auth/login", { email, password });
const storedHash = async (email = "old@example.test") => (await User.findOne({ email })).passwordHash;
// An account from before this change: a bcrypt hash made by bcryptjs (cost 4 keeps the tests fast).
async function bcryptUser(password, email = "old@example.test") {
  return User.create({ name: "Old Account", email, passwordHash: await bcryptjs.hash(password, 4) });
}
const OLD_PASSWORD = "evening walk by the sea";
// The real functions, for the mocks that count hashing work.
const nativeBcryptVerify = nativeBcrypt.verify;
const argon2Verify = argon2.verify;
const argon2Hash = argon2.hash;

test("new users get an Argon2id hash with the OWASP parameters, and can sign in with it", async () => {
  assert.deepEqual({ ...ARGON2 }, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const password = "a quiet morning with tea";
  assert.equal((await signup(password)).status, 201);
  const hash = await storedHash("new@example.test");
  assert.match(hash, CURRENT);
  assert.ok(!hash.includes(password));
  assert.equal((await login(password, "new@example.test")).status, 200);
  assert.equal(await storedHash("new@example.test"), hash, "a current hash is not rehashed");
});

test("a bcrypt account signs in and is moved to Argon2id, then signs in with Argon2id", async () => {
  await bcryptUser(OLD_PASSWORD);
  assert.ok(isBcrypt(await storedHash()));
  const first = await login(OLD_PASSWORD);
  assert.equal(first.status, 200);
  assert.equal(first.body.user.email, "old@example.test");
  const migrated = await storedHash();
  assert.match(migrated, CURRENT);
  assert.equal(await argon2.verify(migrated, OLD_PASSWORD), true);

  assert.equal((await login(OLD_PASSWORD)).status, 200);
  assert.equal(await storedHash(), migrated, "already Argon2id: unchanged");
});

test("a wrong password fails for both kinds of hash, the same way, and changes nothing", async () => {
  await bcryptUser(OLD_PASSWORD, "old@example.test");
  await signup("a quiet morning with tea", "new@example.test");
  const before = { old: await storedHash("old@example.test"), new: await storedHash("new@example.test") };

  const answers = [
    await login("evening walk by the see", "old@example.test"),
    await login("a quiet morning with tee", "new@example.test"),
    await login("a quiet morning with tea", "nobody@example.test"),
  ];
  for (const answer of answers) assert.deepEqual(answer, { status: 401, body: { error: "Invalid email or password." } });
  assert.equal(await storedHash("old@example.test"), before.old, "a failed sign-in never migrates");
  assert.equal(await storedHash("new@example.test"), before.new);
  assert.equal((await User.findOne({ email: "old@example.test" })).failedLoginAttempts, 1);
});

test("every sign-in does the same hashing work whatever the account has, so the time taken doesn't tell", async (t) => {
  await bcryptUser(OLD_PASSWORD, "old@example.test");
  await signup("a quiet morning with tea", "new@example.test");
  const work = [];
  t.mock.method(nativeBcrypt, "verify", async (...args) => { work.push("bcrypt"); return nativeBcryptVerify(...args); });
  t.mock.method(argon2, "verify", async (...args) => { work.push("argon2"); return argon2Verify(...args); });
  t.mock.method(argon2, "hash", async (...args) => { work.push("argon2"); return argon2Hash(...args); });
  const cases = {
    "bcrypt account, wrong password": () => login("not the password at all", "old@example.test"),
    "Argon2 account, wrong password": () => login("not the password at all", "new@example.test"),
    "unknown email": () => login("not the password at all", "nobody@example.test"),
    "Argon2 account, right password": () => login("a quiet morning with tea", "new@example.test"),
    "bcrypt account, right password (then migrated)": () => login(OLD_PASSWORD, "old@example.test"),
  };
  for (const [name, run] of Object.entries(cases)) {
    work.length = 0;
    await run();
    assert.deepEqual(work, ["bcrypt", "argon2"], name);
  }
});
test("an old bcrypt hash never accepts a password longer than 72 bytes that only matches on its first 72", async () => {
  const seventyTwo = "a".repeat(72);
  await bcryptUser(seventyTwo);
  // bcrypt itself would say yes here: it reads only the first 72 bytes.
  assert.equal(await bcryptjs.compare(seventyTwo + "EXTRA", await storedHash()), true);
  assert.deepEqual((await login(seventyTwo + "EXTRA")).body, { error: "Invalid email or password." });
  assert.ok(isBcrypt(await storedHash()), "not migrated to the longer password");
  assert.deepEqual(await verifyPassword(await storedHash(), "é".repeat(36) + "x"), { ok: false, rehash: null });
  // The real 72-byte password still works, and is migrated.
  assert.equal((await login(seventyTwo)).status, 200);
  assert.match(await storedHash(), CURRENT);
  assert.equal((await login(seventyTwo + "EXTRA")).status, 401, "and Argon2id uses every byte");
});

test("NFKC: the same password in composed or decomposed form, or Arabic presentation forms, signs in", async () => {
  const composed = "café au lait every morning";
  const decomposed = "café au lait every morning";
  assert.notEqual(composed, decomposed);
  assert.equal((await signup(decomposed, "nfkc@example.test")).status, 201);
  assert.equal((await login(composed, "nfkc@example.test")).status, 200);
  assert.equal((await login(decomposed, "nfkc@example.test")).status, 200);

  // "لا" typed as the single lam-alef ligature (U+FEFB) on some keyboards.
  const arabic = "لا شيء مثل البيت";
  const ligature = "ﻻ شيء مثل البيت";
  assert.equal((await signup(arabic, "arabic@example.test")).status, 201);
  assert.equal((await login(ligature, "arabic@example.test")).status, 200);
});

test("passwords up to 128 characters work; longer ones are refused", async () => {
  for (const [i, password] of ["a".repeat(128), "ب".repeat(128), "😀".repeat(128)].entries()) {
    const email = `long${i}@example.test`;
    assert.equal((await signup(password, email)).status, 201, `signup ${i}`);
    assert.equal((await login(password, email)).status, 200, `login ${i}`);
  }
  assert.deepEqual((await signup("a".repeat(129), "toolong@example.test")).body, { error: "Your password can be up to 128 characters. Please use a shorter one." });
  // Signing in with a huge value is refused at once, like any wrong password, before any lookup or hashing.
  await bcryptUser(OLD_PASSWORD);
  const huge = await login("x".repeat(64 * 1024));
  assert.deepEqual(huge, { status: 401, body: { error: "Invalid email or password." } });
  assert.equal((await User.findOne({ email: "old@example.test" })).failedLoginAttempts, 0);
});

test("a hash made with older Argon2 parameters is upgraded at the next sign-in, and only then", async () => {
  const password = "our garden in springtime";
  const old = await argon2.hash(password, { algorithm: 2, memoryCost: 8192, timeCost: 1, parallelism: 1 });
  assert.equal(argon2NeedsRehash(old), true);
  await User.create({ name: "Older params", email: "old@example.test", passwordHash: old });
  assert.equal((await login("our garden in summertime")).status, 401);
  assert.equal(await storedHash(), old, "a failed sign-in changes nothing");
  assert.equal((await login(password)).status, 200);
  const upgraded = await storedHash();
  assert.match(upgraded, CURRENT);
  assert.equal(argon2NeedsRehash(upgraded), false);
  // Argon2i or other variants count as outdated too.
  assert.equal(argon2NeedsRehash(await argon2.hash(password, { algorithm: 1, memoryCost: 19456, timeCost: 2, parallelism: 1 })), true);
});

test("password reset, turning off 2FA and deleting the account use the new hashing too", async () => {
  // Reset sets an Argon2id hash.
  const token = crypto.randomBytes(32).toString("hex");
  await User.create({ name: "Reset", email: "reset@example.test", passwordHash: await bcryptjs.hash(OLD_PASSWORD, 4), resetPasswordTokenHash: crypto.createHash("sha256").update(token).digest("hex"), resetPasswordExpires: new Date(Date.now() + 60000) });
  assert.equal((await request("POST", "/auth/reset-password", { token, password: "a brand new long password" })).status, 200);
  assert.match(await storedHash("reset@example.test"), CURRENT);

  // Turning off 2FA checks an old hash and migrates it.
  const twoFactor = await User.create({ name: "Two", email: "two@example.test", passwordHash: await bcryptjs.hash(OLD_PASSWORD, 4), twoFactorEnabled: true });
  const cookie = jwt.sign({ sub: String(twoFactor._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  assert.equal((await request("POST", "/auth/2fa/disable", { password: "wrong password here" }, cookie)).status, 400);
  assert.ok(isBcrypt(await storedHash("two@example.test")));
  assert.equal((await request("POST", "/auth/2fa/disable", { password: OLD_PASSWORD }, cookie)).status, 200);
  assert.match(await storedHash("two@example.test"), CURRENT);

  // Deleting the account accepts a long password (the old 72-byte check is gone) and an old bcrypt hash.
  const longPassword = "ب".repeat(100);
  assert.equal((await signup(longPassword, "delete@example.test")).status, 201);
  const owner = await User.findOne({ email: "delete@example.test" });
  const ownerCookie = jwt.sign({ sub: String(owner._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  assert.equal((await request("DELETE", "/profile/me", { confirm: "DELETE", password: longPassword }, ownerCookie)).status, 204);
  const old = await bcryptUser(OLD_PASSWORD, "olddelete@example.test");
  const oldCookie = jwt.sign({ sub: String(old._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  assert.equal((await request("DELETE", "/profile/me", { confirm: "DELETE", password: OLD_PASSWORD }, oldCookie)).status, 204);
});

test("never writes passwords or password hashes to the logs", async () => {
  const passwords = ["Signup secret phrase here", OLD_PASSWORD, "Wrong guess phrase here"];
  await bcryptUser(OLD_PASSWORD);
  const oldHash = await storedHash();
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { written.push(String(chunk)); return original.call(this, chunk, ...rest); };
  try {
    await signup(passwords[0], "logs@example.test");
    await login(passwords[2]);
    await login(OLD_PASSWORD);
    await login(passwords[0], "logs@example.test");
    await login("y".repeat(5000));
  } finally { process.stdout.write = original; }
  const logs = written.join("");
  assert.match(logs, /http_request/);
  for (const value of [...passwords, oldHash, await storedHash(), await storedHash("logs@example.test"), "$argon2", "$2a$", "$2b$", "yyyyyyyy"]) {
    assert.ok(!logs.includes(value), `log contains ${value.slice(0, 12)}...`);
  }
});

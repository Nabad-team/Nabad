// The password rules as the signup and reset-password routes apply them. Every request comes from its own
// client IP, so the real signup and reset rate limits (5 per hour) stay on without capping how much is covered.
const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const { PASSWORD_MESSAGES } = require("../src/passwordPolicy");
let mongod, server, base, ip = 0;
const goodPassword = "my cat sleeps on the sofa";
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"), CLIENT_ORIGIN: "http://localhost:3000", TRUST_PROXY: "1" });
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => { server?.close(); await mongoose.disconnect(); await mongod?.stop(); delete process.env.TRUST_PROXY; delete process.env.PWNED_PASSWORDS_CHECK; });
beforeEach(async () => { await User.deleteMany({}); delete process.env.PWNED_PASSWORDS_CHECK; });
async function post(path, body) {
  const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, "X-Forwarded-For": `198.51.100.${++ip}` }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const signup = (password, name = "Sam Rivers", email = "sam.rivers@example.test") => post("/auth/signup", { name, email, password });
// A user with a valid reset link; returns the link token.
async function resetLink({ name = "Sam Rivers", email = "sam.rivers@example.test", passwordHash } = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  await User.create({ name, email, passwordHash: passwordHash || await bcrypt.hash("old password here", 4), resetPasswordTokenHash: crypto.createHash("sha256").update(token).digest("hex"), resetPasswordExpires: new Date(Date.now() + 60000) });
  return token;
}
const rejected = [
  ["too short", "short pass", "tooShort"],
  ["Leen's old 'strong' rule-follower that is too short", "Short1!Aa", "tooShort"],
  ["too long for bcrypt", "a".repeat(73), "tooLong"],
  ["too long in Arabic", "ب".repeat(37), "tooLong"],
  ["common", "password1234", "common"],
  ["common in a different case", "PassWord1234", "common"],
  ["contains the name", "sam likes long walks", "hasName"],
  ["contains the email name", "sam.rivers loves tea", "hasEmail"],
  ["contains Nabad", "my nabad heart app", "hasSiteName"],
];

for (const [label, password, code] of rejected) {
  test(`signup rejects a password that is ${label}`, async () => {
    // For the email case the name differs from the email, so the name check does not catch it first.
    const result = await signup(password, code === "hasEmail" ? "Pat Kim" : "Sam Rivers");
    assert.deepEqual(result, { status: 400, body: { error: PASSWORD_MESSAGES[code] } });
    assert.equal(await User.countDocuments(), 0);
  });
}

test("signup accepts long passphrases with spaces, Arabic, and emoji, and no forced character mixes", async () => {
  for (const [i, password] of [goodPassword, "قطتي تحب الشمس كثيرا", "🌙 quiet evening 🌟", "ALL CAPS NO DIGITS", "a".repeat(72)].entries()) {
    const result = await signup(password, "Pat Kim", `pat${i}@example.test`);
    assert.equal(result.status, 201, password);
    assert.equal(await bcrypt.compare(password, (await User.findOne({ email: `pat${i}@example.test` })).passwordHash), true);
  }
});

test("signup reports the password problem without revealing whether the email has an account", async () => {
  await User.create({ name: "Taken", email: "taken@example.test", passwordHash: await bcrypt.hash(goodPassword, 4) });
  const result = await signup("password1234", "Pat Kim", "taken@example.test");
  assert.deepEqual(result, { status: 400, body: { error: PASSWORD_MESSAGES.common } });
});

test("signup rejects a breached password and still sends Have I Been Pwned only 5 hash characters", async () => {
  process.env.PWNED_PASSWORDS_CHECK = "on";
  const digest = crypto.createHash("sha1").update(goodPassword).digest("hex").toUpperCase();
  const realFetch = globalThis.fetch, ranges = [];
  mock.method(globalThis, "fetch", async (url, options) => {
    if (!String(url).startsWith("https://api.pwnedpasswords.com/")) return realFetch(url, options);
    ranges.push(String(url));
    return new Response(`${digest.slice(5)}:7\n`);
  });
  try {
    const result = await signup(goodPassword, "Pat Kim", "pat@example.test");
    assert.deepEqual(result, { status: 400, body: { error: PASSWORD_MESSAGES.breached } });
    assert.deepEqual(ranges, ["https://api.pwnedpasswords.com/range/" + digest.slice(0, 5)]);
    assert.equal((await signup("a calm and different sentence", "Pat Kim", "pat@example.test")).status, 201);
  } finally { mock.restoreAll(); }
});

test("signup still works when Have I Been Pwned is down", async () => {
  process.env.PWNED_PASSWORDS_CHECK = "on";
  const realFetch = globalThis.fetch;
  mock.method(globalThis, "fetch", async (url, options) => String(url).startsWith("https://api.pwnedpasswords.com/") ? new Response("", { status: 503 }) : realFetch(url, options));
  try { assert.equal((await signup(goodPassword, "Pat Kim", "pat@example.test")).status, 201); } finally { mock.restoreAll(); }
});

for (const [label, password, code] of rejected) {
  test(`reset-password rejects a password that is ${label} and keeps the link usable`, async () => {
    const token = await resetLink(code === "hasEmail" ? { name: "Pat Kim" } : {});
    assert.deepEqual(await post("/auth/reset-password", { token, password }), { status: 400, body: { error: PASSWORD_MESSAGES[code] } });
    assert.equal((await post("/auth/reset-password", { token, password: goodPassword })).status, 200);
  });
}

test("reset-password checks the link before the password, so it says nothing about other accounts", async () => {
  await resetLink();
  for (const password of ["sam likes long walks", goodPassword]) {
    assert.deepEqual(await post("/auth/reset-password", { token: "f".repeat(64), password }), { status: 400, body: { error: "This reset link is invalid or expired. Request a new one." } });
  }
});

test("existing users keep signing in with passwords from the old rules", async () => {
  for (const [i, oldPassword] of ["eightch1", "NoSymbol12345", "password1234"].entries()) {
    await User.create({ name: "Old User", email: `old${i}@example.test`, passwordHash: await bcrypt.hash(oldPassword, 4) });
    const login = await post("/auth/login", { email: `old${i}@example.test`, password: oldPassword });
    assert.equal(login.status, 200, oldPassword);
    assert.equal(login.body.user.email, `old${i}@example.test`);
  }
});

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
let mongod, server, base, googleProfile;
const realFetch = global.fetch;
const password = "Google test password 123!";

// Stands in for Google's token, userinfo and tokeninfo endpoints; every other request goes through.
function fakeGoogle(url, options) {
  const href = String(url);
  const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
  if (href === "https://oauth2.googleapis.com/token") return json({ access_token: "access", id_token: "id-token" });
  if (href === "https://openidconnect.googleapis.com/v1/userinfo") return json({ sub: googleProfile.sub, email: googleProfile.email, email_verified: googleProfile.email_verified ?? true, name: googleProfile.name });
  if (href.startsWith("https://oauth2.googleapis.com/tokeninfo")) return json({ aud: process.env.GOOGLE_CLIENT_ID, sub: googleProfile.sub });
  return realFetch(url, options);
}

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:5000/api/auth/google/callback";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  global.fetch = fakeGoogle;
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => {
  global.fetch = realFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => { await User.deleteMany({}); });

// Captures the JSON log lines written while fn runs.
async function captureLogs(fn) {
  const lines = [], write = process.stdout.write;
  process.stdout.write = (chunk, ...rest) => { lines.push(String(chunk)); return write.call(process.stdout, chunk, ...rest); };
  try { await fn(); } finally { process.stdout.write = write; }
  return lines.flatMap(line => line.split("\n")).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

async function googleSignIn(profile) {
  googleProfile = profile;
  const response = await realFetch(base + "/auth/google/callback?code=abc&state=s1", { redirect: "manual", headers: { Cookie: "googleOAuthState=s1" } });
  return { status: response.status, location: response.headers.get("location"), cookie: response.headers.get("set-cookie") || "" };
}

test("a new Google user gets a new Google account and is signed in", async () => {
  const res = await googleSignIn({ sub: "google-new", email: "New.User@Example.test", name: "New User" });
  assert.equal(res.status, 302);
  assert.equal(res.location, "http://localhost:3000/dashboard");
  assert.match(res.cookie, /accessToken=/);
  const users = await User.find({});
  assert.equal(users.length, 1);
  assert.equal(users[0].email, "new.user@example.test");
  assert.equal(users[0].googleId, "google-new");
  assert.equal(users[0].authProvider, "google");
});

test("the same Google user signing in again reuses the account without a duplicate", async () => {
  const profile = { sub: "google-again", email: "again@example.test", name: "Again" };
  await googleSignIn(profile);
  const first = await User.findOne({ googleId: "google-again" });
  const res = await googleSignIn(profile);
  assert.equal(res.location, "http://localhost:3000/dashboard");
  assert.equal(await User.countDocuments({}), 1);
  assert.equal(String((await User.findOne({ googleId: "google-again" }))._id), String(first._id));
});

test("a Google user whose email matches a password account is refused and the account is left untouched", async () => {
  const existing = await User.create({ name: "Password User", email: "shared@example.test", passwordHash: await bcrypt.hash(password, 4) });
  const res = await googleSignIn({ sub: "google-shared", email: "Shared@example.test", name: "Google Name" });
  assert.equal(res.status, 302);
  assert.equal(res.location, "http://localhost:3000/login?error=google_account_exists");
  assert.doesNotMatch(res.cookie, /accessToken=/);
  const users = await User.find({});
  assert.equal(users.length, 1);
  assert.equal(String(users[0]._id), String(existing._id));
  assert.equal(users[0].googleId, undefined);
  assert.equal(users[0].authProvider, "password");
});

test("a Google account without a verified email cannot create or sign in to an account", async () => {
  const failed = "http://localhost:3000/login?error=google_signin_failed";
  const res = await googleSignIn({ sub: "google-unverified", email: "unverified@example.test", name: "Unverified", email_verified: false });
  assert.equal(res.location, failed);
  assert.doesNotMatch(res.cookie, /accessToken=/);
  assert.equal(await User.countDocuments({}), 0);

  await googleSignIn({ sub: "google-linked", email: "linked@example.test", name: "Linked" });
  const again = await googleSignIn({ sub: "google-linked", email: "linked@example.test", name: "Linked", email_verified: false });
  assert.equal(again.location, failed);
  assert.doesNotMatch(again.cookie, /accessToken=/);
});

test("a different Google account with the same email never replaces the linked googleId", async () => {
  await googleSignIn({ sub: "google-first", email: "owner@example.test", name: "Owner" });
  const res = await googleSignIn({ sub: "google-second", email: "owner@example.test", name: "Other" });
  assert.equal(res.location, "http://localhost:3000/login?error=google_signin_failed");
  assert.doesNotMatch(res.cookie, /accessToken=/);
  const users = await User.find({});
  assert.equal(users.length, 1);
  assert.equal(users[0].googleId, "google-first");
});

test("a googleId match wins over an email match on another account", async () => {
  const linked = await User.create({ name: "Linked", email: "old@example.test", googleId: "google-moved", authProvider: "google", passwordHash: await bcrypt.hash(password, 4) });
  const other = await User.create({ name: "Other", email: "new@example.test", passwordHash: await bcrypt.hash(password, 4) });
  const res = await googleSignIn({ sub: "google-moved", email: "new@example.test", name: "Linked" });
  assert.equal(res.location, "http://localhost:3000/dashboard");
  assert.equal((await User.findById(linked._id)).googleId, "google-moved");
  assert.equal((await User.findById(other._id)).googleId, undefined);
});

test("a refused sign-in logs only the reason and the existing account's id, never the email or Google ID", async () => {
  const unlinked = await User.create({ name: "Password User", email: "private@example.test", passwordHash: await bcrypt.hash(password, 4) });
  const linked = await User.create({ name: "Linked", email: "linked.private@example.test", googleId: "google-kept", authProvider: "google", passwordHash: await bcrypt.hash(password, 4) });
  const logs = await captureLogs(async () => {
    await googleSignIn({ sub: "google-secret-1", email: "private@example.test", name: "A" });
    await googleSignIn({ sub: "google-secret-2", email: "linked.private@example.test", name: "B" });
  });
  const refused = logs.filter(entry => entry.event === "google_signin_refused");
  assert.equal(refused.length, 2);
  assert.deepEqual(refused.map(({ reason, userId }) => ({ reason, userId })), [
    { reason: "email_exists", userId: String(unlinked._id) },
    { reason: "google_id_conflict", userId: String(linked._id) },
  ]);
  for (const entry of refused) assert.deepEqual(Object.keys(entry).sort(), ["event", "reason", "requestId", "time", "userId"]);
  const text = JSON.stringify(logs);
  for (const secret of ["private@example.test", "google-secret-1", "google-secret-2", "google-kept"]) assert.equal(text.includes(secret), false, secret);
});

test("the users collection has unique indexes on email and googleId", async () => {
  const indexes = await User.collection.indexes();
  const email = indexes.find(index => index.key.email === 1);
  const googleId = indexes.find(index => index.key.googleId === 1);
  assert.equal(email?.unique, true);
  assert.equal(googleId?.unique, true);
  assert.equal(googleId?.sparse, true);
});

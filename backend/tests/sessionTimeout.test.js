const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../src/models/User");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const password = "Session test password 123!";
let mongod, server, base;
// The fake clock: every Date.now() call (including the ones inside jsonwebtoken) returns this.
let now;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  // Use the defaults from src/sessionConfig.js: 30 minutes idle, 12 hours maximum, 2 minutes warning.
  delete process.env.SESSION_IDLE_TIMEOUT;
  delete process.env.SESSION_ABSOLUTE_TIMEOUT;
  delete process.env.SESSION_WARNING_BEFORE;
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
beforeEach(async () => {
  await User.deleteMany({});
  await User.create({ name: "Test", email: "user@example.test", passwordHash: await bcrypt.hash(password, 4) });
  now = new Date("2026-01-01T08:00:00Z").getTime();
  mock.method(Date, "now", () => now);
});
afterEach(() => mock.restoreAll());

// Moves the fake clock forward.
function advance(ms) { now += ms; }

// Reads the accessToken cookie (value and Max-Age in seconds) from a response.
function authCookie(response) {
  const header = response.headers.getSetCookie().find(c => c.startsWith("accessToken="));
  if (!header) return null;
  return { value: header.split(";")[0], maxAge: Number(/Max-Age=(\d+)/.exec(header)[1]) };
}
async function logIn() {
  const response = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN },
    body: JSON.stringify({ email: "user@example.test", password }),
  });
  assert.equal(response.status, 200);
  return authCookie(response);
}
function checkSession(cookie) {
  return fetch(base + "/auth/session", { headers: { Cookie: cookie.value } });
}
function logOut(cookie) {
  return fetch(base + "/auth/logout", { method: "POST", headers: { Cookie: cookie.value, Origin: process.env.CLIENT_ORIGIN } });
}

test("signing in gives a cookie that lasts 30 minutes", async () => {
  const cookie = await logIn();
  assert.equal(cookie.maxAge, 30 * 60);
});

test("each request renews the session for another 30 minutes (sliding expiry)", async () => {
  const first = await logIn();

  advance(29 * MINUTE);
  const response = await checkSession(first);
  assert.equal(response.status, 200);
  const renewed = authCookie(response);
  assert.equal(renewed.maxAge, 30 * 60);

  // 58 minutes after signing in: the renewed cookie still works, the original one has expired.
  advance(29 * MINUTE);
  assert.equal((await checkSession(renewed)).status, 200);
  assert.equal((await checkSession(first)).status, 401);
});

test("the session expires after 30 minutes without activity", async () => {
  const cookie = await logIn();

  advance(31 * MINUTE);
  assert.equal((await checkSession(cookie)).status, 401);
});

test("an active session still ends after 12 hours", async () => {
  let cookie = await logIn();

  // Active every 20 minutes until 11h40m.
  for (let elapsed = 20 * MINUTE; elapsed <= 11 * HOUR + 40 * MINUTE; elapsed += 20 * MINUTE) {
    advance(20 * MINUTE);
    const response = await checkSession(cookie);
    assert.equal(response.status, 200);
    cookie = authCookie(response);
  }
  // At 11h40m only 20 minutes are left, so the cookie is not renewed past the 12-hour mark.
  assert.equal(cookie.maxAge, 20 * 60);

  advance(19 * MINUTE);
  assert.equal((await checkSession(cookie)).status, 200);

  // Exactly 12 hours after signing in: rejected, even though the user was active a minute ago.
  advance(1 * MINUTE);
  assert.equal((await checkSession(cookie)).status, 401);
});

test("GET /session tells the browser the timeout settings", async () => {
  const signedInAt = now;
  const cookie = await logIn();

  advance(5 * MINUTE);
  const response = await checkSession(cookie);
  assert.deepEqual(await response.json(), { idleTimeoutMs: 30 * MINUTE, warningBeforeMs: 2 * MINUTE, absoluteExpiresAt: signedInAt + 12 * HOUR });
});

test("after signing out the old cookie no longer works", async () => {
  const cookie = await logIn();

  assert.equal((await logOut(cookie)).status, 200);
  assert.equal((await checkSession(cookie)).status, 401);
});

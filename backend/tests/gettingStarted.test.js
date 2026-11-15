// The dashboard's Getting started card: "Hide" is remembered for the account on the server (one flag on the user),
// and /auth/me reports it. Integration tests over HTTP with a real database.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const User = require("../src/models/User");
const { TEST_PROXY_SECRET, asVisitor } = require("./helpers/proxyHeaders");

let mongod, server, base;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"), CLIENT_ORIGIN: "http://localhost:3000",
    API_PROXY_SECRET: TEST_PROXY_SECRET });
  mongod = await createTestMongo();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => { server?.close(); await mongoose.disconnect(); await mongod?.stop(); delete process.env.API_PROXY_SECRET; });
beforeEach(async () => { await User.deleteMany({}); });

let ip = 0;
async function call(path, { method = "GET", cookie } = {}) {
  const response = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...asVisitor(`10.7.0.${++ip}`), ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
  });
  return { status: response.status, body: await response.json() };
}
const cookieFor = (account) => jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
const makeUser = (email) => User.create({ name: "Rana Haddad", email, passwordHash: "synthetic-hash-not-a-password", emailVerified: true });

test("a new account shows the card; Hide is remembered on the server for that account only", async () => {
  const rana = await makeUser("rana.gs@example.test");
  const sami = await makeUser("sami.gs@example.test");
  assert.equal((await call("/auth/me", { cookie: cookieFor(rana) })).body.user.gettingStartedHidden, false);

  const hide = await call("/auth/getting-started/hide", { method: "POST", cookie: cookieFor(rana) });
  assert.equal(hide.status, 200);
  assert.deepEqual(hide.body, { gettingStartedHidden: true });
  assert.equal((await call("/auth/me", { cookie: cookieFor(rana) })).body.user.gettingStartedHidden, true);
  // Hiding twice is fine, and another account is not affected.
  assert.equal((await call("/auth/getting-started/hide", { method: "POST", cookie: cookieFor(rana) })).status, 200);
  assert.equal((await call("/auth/me", { cookie: cookieFor(sami) })).body.user.gettingStartedHidden, false);
});

test("hiding needs sign-in", async () => {
  assert.equal((await call("/auth/getting-started/hide", { method: "POST" })).status, 401);
});

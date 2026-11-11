// Who is calling (src/clientIp.js) and the limits that depend on it: no header a visitor sends is believed unless
// our Next.js proxy vouches for it with API_PROXY_SECRET. See docs/environments.md, "Client IP".
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const { clientIp, normalizeIp } = require("../src/clientIp");
const { loadConfig } = require("../src/config");

const SECRET = crypto.randomBytes(32).toString("hex");
const FAKES = { "X-Forwarded-For": "198.51.100.1, 203.0.113.2", "X-Vercel-Forwarded-For": "198.51.100.3", "X-Real-IP": "198.51.100.4",
  "X-Nabad-Client-IP": "198.51.100.5" };

async function serve(app) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
// A bare app with the middleware and an echo route, for the rules themselves.
async function echo(options) {
  const app = express();
  app.use(clientIp(options));
  app.all(/.*/, (req, res) => res.json({ clientIp: req.clientIp, viaAppProxy: req.viaAppProxy }));
  return serve(app);
}
async function call(url, path, headers = {}, method = "GET") {
  const response = await fetch(url + path, { method, headers });
  return { status: response.status, body: await response.json() };
}

test("locally, the socket address counts and no header is believed", async () => {
  const app = await echo({ secret: null, required: false, hosted: false });
  try {
    const { body } = await call(app.url, "/api/x", { ...FAKES, "CF-Connecting-IP": "198.51.100.6" });
    assert.deepEqual(body, { clientIp: "127.0.0.1", viaAppProxy: false });
  } finally { await app.close(); }
});

test("with the right secret, the proxy's X-Nabad-Client-IP counts, whatever else the visitor sent", async () => {
  const app = await echo({ secret: SECRET, required: true, hosted: true });
  try {
    const { body } = await call(app.url, "/api/x", { ...FAKES, "X-Nabad-Proxy-Secret": SECRET, "X-Nabad-Client-IP": "212.28.230.77" });
    assert.deepEqual(body, { clientIp: "212.28.230.77", viaAppProxy: true });
    const v6 = await call(app.url, "/api/x", { "X-Nabad-Proxy-Secret": SECRET, "X-Nabad-Client-IP": "2001:DB8::1" });
    assert.equal(v6.body.clientIp, "2001:db8::1");
    assert.equal((await call(app.url, "/api/x", { "X-Nabad-Proxy-Secret": SECRET, "X-Nabad-Client-IP": "not-an-ip" })).status, 400);
    assert.equal((await call(app.url, "/api/x", { "X-Nabad-Proxy-Secret": SECRET })).status, 400);
  } finally { await app.close(); }
});

test("required: no secret or a wrong one gets 403, except Render's health checks", async () => {
  const app = await echo({ secret: SECRET, required: true, hosted: true });
  try {
    for (const headers of [{}, FAKES, { "X-Nabad-Proxy-Secret": "wrong", "X-Nabad-Client-IP": "212.28.230.77" },
      { "X-Nabad-Proxy-Secret": SECRET.slice(0, -1), "X-Nabad-Client-IP": "212.28.230.77" }]) {
      assert.equal((await call(app.url, "/api/auth/me", headers)).status, 403);
      assert.equal((await call(app.url, "/api/auth/login", headers, "POST")).status, 403);
    }
    assert.equal((await call(app.url, "/api/health")).status, 200);
    assert.equal((await call(app.url, "/api/health/ready")).status, 200);
    assert.equal((await call(app.url, "/api/health/client-ip")).status, 403);
    assert.equal((await call(app.url, "/api/health/ready", {}, "POST")).status, 403);
  } finally { await app.close(); }
});

test("rolling out (not required yet): without the secret, Cloudflare's address on hosted environments", async () => {
  const app = await echo({ secret: SECRET, required: false, hosted: true });
  try {
    const { body } = await call(app.url, "/api/x", { ...FAKES, "CF-Connecting-IP": "51.44.16.21" });
    assert.deepEqual(body, { clientIp: "51.44.16.21", viaAppProxy: false });
    const wrong = await call(app.url, "/api/x", { "X-Nabad-Proxy-Secret": "wrong", "X-Nabad-Client-IP": "203.0.113.9", "CF-Connecting-IP": "51.44.16.21" });
    assert.equal(wrong.body.clientIp, "51.44.16.21");
    assert.equal((await call(app.url, "/api/x", { "CF-Connecting-IP": "garbage" })).body.clientIp, "127.0.0.1");
  } finally { await app.close(); }
});

test("settings: the secret needs 32 characters, and required needs the secret", () => {
  const base = { APP_ENV: "development", MONGO_URI: "mongodb://127.0.0.1:27017", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: "j".repeat(32) };
  assert.equal(loadConfig(base).proxySecret, null);
  assert.equal(loadConfig({ ...base, API_PROXY_SECRET: SECRET }).proxySecret, SECRET);
  assert.throws(() => loadConfig({ ...base, API_PROXY_SECRET: "short" }), /at least 32 characters/);
  assert.throws(() => loadConfig({ ...base, API_PROXY_REQUIRED: "true" }), /needs API_PROXY_SECRET/);
  assert.throws(() => loadConfig({ ...base, API_PROXY_REQUIRED: "yes", API_PROXY_SECRET: SECRET }), /must be "true" or "false"/);
  assert.equal(loadConfig({ ...base, API_PROXY_REQUIRED: "true", API_PROXY_SECRET: SECRET }).proxyRequired, true);
  // TRUST_PROXY is ignored now, whatever its value.
  assert.doesNotThrow(() => loadConfig({ ...base, TRUST_PROXY: "yes" }));
});

test("normalizeIp accepts IPv4 and IPv6 only", () => {
  assert.equal(normalizeIp(" 212.28.230.77 "), "212.28.230.77");
  assert.equal(normalizeIp("::ffff:10.0.0.1"), "10.0.0.1");
  for (const bad of ["", "1.2.3", "212.28.230.77, 1.1.1.1", "<script>", undefined, null]) assert.equal(normalizeIp(bad), null);
});

// ---- The whole API: sign-in limits per account and network ------------------------------------------------------

let mongod, api;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    CLIENT_ORIGIN: "http://localhost:3000", API_PROXY_SECRET: SECRET });
  mongod = await createTestMongo();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  const { createApp } = require("../src/app");
  api = await serve(createApp());
}, { timeout: 240000 });
after(async () => {
  if (api) await api.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  delete process.env.API_PROXY_SECRET;
});

let network = 0;
beforeEach(() => { network += 1; });
const ipOf = (n) => `203.0.${Math.floor(n / 250)}.${(n % 250) + 1}`;
const viaProxy = (ip, extra = {}) => ({ ...extra, "X-Nabad-Proxy-Secret": SECRET, "X-Nabad-Client-IP": ip });
function login(email, headers) {
  return fetch(`${api.url}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...headers },
    body: JSON.stringify({ email, password: "wrong password" }) });
}

test("reproduction: spoofed X-Forwarded-For no longer gives a fresh sign-in counter", async () => {
  const ip = ipOf(network * 10);
  for (let i = 0; i < 20; i++) assert.equal((await login("victim@example.test", viaProxy(ip, { "X-Forwarded-For": `198.18.0.${i + 1}` }))).status, 401);
  // Before the fix, each new X-Forwarded-For value was a new counter. Now it is the same visitor: limited.
  assert.equal((await login("victim@example.test", viaProxy(ip, { "X-Forwarded-For": "198.18.1.1", "X-Vercel-Forwarded-For": "198.18.1.2" }))).status, 429);
});

test("people on one network don't lock each other out; one account is still limited", async () => {
  const campus = ipOf(network * 10);
  for (let i = 0; i < 20; i++) assert.equal((await login("typo@example.test", viaProxy(campus))).status, 401);
  assert.equal((await login("typo@example.test", viaProxy(campus))).status, 429);
  // Other people on the same campus IP can still sign in.
  for (let i = 0; i < 5; i++) assert.equal((await login(`student${i}@example.test`, viaProxy(campus))).status, 401);
  // The same account from another network has its own counter.
  assert.equal((await login("typo@example.test", viaProxy(ipOf(network * 10 + 1)))).status, 401);
});

test("one network is capped at 200 sign-in attempts per 15 minutes, across accounts and sign-in endpoints", async () => {
  const ip = ipOf(network * 10);
  // 200 2FA attempts for 200 different (made-up) accounts: each account's own counter stays low, the network's fills.
  // 2FA checks are quick, so this stays fast; the cap is shared with sign-in.
  const jwt = require("jsonwebtoken");
  for (let i = 0; i < 200; i++) {
    const challenge = jwt.sign({ sub: crypto.randomBytes(12).toString("hex"), purpose: "2fa" }, "not-the-real-secret-".repeat(2));
    const response = await fetch(`${api.url}/api/auth/2fa/verify`, { method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...viaProxy(ip) }, body: JSON.stringify({ challenge, code: "000000" }) });
    assert.notEqual(response.status, 429, `attempt ${i + 1}`);
  }
  const blocked = await login("fresh@example.test", viaProxy(ip));
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /Too many attempts from this network/);
  assert.equal((await login("fresh@example.test", viaProxy(ipOf(network * 10 + 1)))).status, 401);
});

test("the client-ip check shows only the caller's own resolved address (staging and local, not production)", async () => {
  const proxied = await fetch(`${api.url}/api/health/client-ip`, { headers: viaProxy("212.28.230.77", FAKES) });
  assert.deepEqual(await proxied.json(), { clientIp: "212.28.230.77", viaAppProxy: true });
  const direct = await fetch(`${api.url}/api/health/client-ip`, { headers: FAKES });
  assert.deepEqual(await direct.json(), { clientIp: "127.0.0.1", viaAppProxy: false });
});

// ---- Sign-up and password reset: strict per email, a higher cap per network -------------------------------------

function post(path, body, headers) {
  return fetch(`${api.url}/api/auth${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...headers },
    body: JSON.stringify(body) });
}
// A weak password is refused before anything is saved or sent, but still counts towards the limits.
const signup = (email, headers) => post("/signup", { name: "Demo Student", email, password: "short" }, headers);

test("sign-up: 3 tries per email address, even from different networks", async () => {
  const email = `same${network}@example.test`;
  for (let i = 0; i < 3; i++) assert.equal((await signup(email, viaProxy(ipOf(network * 10 + i)))).status, 400);
  const blocked = await signup(email, viaProxy(ipOf(network * 10 + 5)));
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /Too many signup attempts/);
});

test("sign-up: a whole class of 60 on one network can sign up, the 61st sign-up from it waits", async () => {
  const campus = ipOf(network * 10);
  for (let i = 0; i < 60; i++) assert.notEqual((await signup(`class${network}-${i}@example.test`, viaProxy(campus))).status, 429, `student ${i + 1}`);
  const blocked = await signup(`late${network}@example.test`, viaProxy(campus));
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /Too many sign-ups from this network/);
  assert.notEqual((await signup(`late${network}@example.test`, viaProxy(ipOf(network * 10 + 1)))).status, 429);
});

test("password reset: 3 emails per address, 30 reset requests per network", async () => {
  const campus = ipOf(network * 10);
  const forgot = (email, ip) => post("/forgot-password", { email }, viaProxy(ip));
  // No mail server in tests, so these answer 503; the limits count them all the same.
  for (let i = 0; i < 3; i++) assert.notEqual((await forgot(`reset${network}@example.test`, ipOf(network * 10 + 1 + i))).status, 429);
  assert.equal((await forgot(`reset${network}@example.test`, ipOf(network * 10 + 5))).status, 429);
  for (let i = 0; i < 30; i++) assert.notEqual((await forgot(`r${network}-${i}@example.test`, campus)).status, 429, `request ${i + 1}`);
  const blocked = await forgot(`other${network}@example.test`, campus);
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /Too many reset attempts from this network/);
  // Setting the new password shares the network's reset cap.
  assert.equal((await post("/reset-password", { token: "0".repeat(64), password: "x" }, viaProxy(campus))).status, 429);
});

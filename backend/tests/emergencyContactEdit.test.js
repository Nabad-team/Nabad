// Story #12: "As a user, I want to edit or remove my emergency contact so that it stays current."
// Integration tests: a real Express app and a real database, called over HTTP like the browser does.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");

let mongod, server, base;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/profile/emergency-contact`;
}, { timeout: 240000 });
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => { await User.deleteMany({}); });

const makeUser = (email = "rana@example.test", extra = {}) => User.create({ name: "Rana", email, passwordHash: "x", ...extra });
const cookieFor = (account) => jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
async function call(method, { cookie, body, origin = process.env.CLIENT_ORIGIN } = {}) {
  const response = await fetch(base, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const withContact = (email) => makeUser(email, { emergencyContact: { name: "Mom", phone: "71123456" } });

test("edit replaces the existing contact's name and phone and the change survives reload", async () => {
  const account = await withContact();
  const cookie = cookieFor(account);
  const res = await call("PUT", { cookie, body: { name: "  Dad  ", phone: "+961 3 123 456" } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.contact, { name: "Dad", phone: "+9613123456" });
  assert.deepEqual((await call("GET", { cookie })).body.contact, { name: "Dad", phone: "+9613123456" });
});

test("edit with no saved contact returns 404 and does not create one", async () => {
  const account = await makeUser();
  const res = await call("PUT", { cookie: cookieFor(account), body: { name: "Dad", phone: "71123456" } });
  assert.equal(res.status, 404);
  assert.equal((await User.findById(account._id)).emergencyContact, undefined);
});

test("edit rejects invalid or missing values and keeps the old contact", async () => {
  const account = await withContact();
  const cookie = cookieFor(account);
  for (const body of [{ name: "", phone: "71123456" }, { name: "Dad", phone: "bad" }, { name: "Dad" }, { phone: "71123456" }, { name: 5, phone: 6 }, { name: "x".repeat(101), phone: "71123456" }]) {
    assert.equal((await call("PUT", { cookie, body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await User.findById(account._id)).emergencyContact.name, "Mom");
});

test("remove deletes the contact, and a new one can then be added", async () => {
  const account = await withContact();
  const cookie = cookieFor(account);
  assert.equal((await call("DELETE", { cookie })).status, 204);
  assert.equal((await call("GET", { cookie })).body.contact, null);
  assert.equal((await User.findById(account._id)).emergencyContact, undefined);
  assert.equal((await call("POST", { cookie, body: { name: "Sister", phone: "03123456" } })).status, 201);
});

test("removing twice is safe (idempotent)", async () => {
  const cookie = cookieFor(await withContact());
  assert.equal((await call("DELETE", { cookie })).status, 204);
  assert.equal((await call("DELETE", { cookie })).status, 204);
});

test("one account cannot edit or remove another account's contact", async () => {
  const a = await withContact("a@example.test");
  const b = await withContact("b@example.test");
  // userId in the body is ignored: the account always comes from the session cookie.
  await call("PUT", { cookie: cookieFor(b), body: { name: "Hacker", phone: "71999999", userId: String(a._id) } });
  await call("DELETE", { cookie: cookieFor(b), body: { userId: String(a._id) } });
  assert.equal((await User.findById(a._id)).emergencyContact.name, "Mom");
});

test("edit and remove require sign-in and the app's own origin", async () => {
  const account = await withContact();
  assert.equal((await call("PUT", { body: { name: "Dad", phone: "71123456" } })).status, 401);
  assert.equal((await call("DELETE")).status, 401);
  const cookie = cookieFor(account);
  assert.equal((await call("PUT", { cookie, origin: "https://evil.example", body: { name: "Dad", phone: "71123456" } })).status, 403);
  assert.equal((await call("DELETE", { cookie, origin: "https://evil.example" })).status, 403);
  assert.equal((await User.findById(account._id)).emergencyContact.name, "Mom");
});

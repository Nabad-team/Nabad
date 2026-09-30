const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
let mongod, server, base;
const password = "Profile test password 123!";
let passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init()]);
  passwordHash = await bcrypt.hash(password, 12);
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
beforeEach(async () => { await User.deleteMany({}); await LinkedProfile.deleteMany({}); });

async function user(email = "owner@example.test", extra = {}) { return User.create({ name: "Owner", email, passwordHash, ...extra }); }
function token(account) { return jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }); }
async function request(method, path, { body, cookie, origin = process.env.CLIENT_ORIGIN, raw } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}
const addDependent = (cookie, fields = {}) => request("POST", "/profile/linked", { cookie, body: { fullName: "Child", dateOfBirth: "2015-06-01", relationship: "child", ...fields } });
function picture(type, size = 64) {
  const header = type === "png" ? [0x89, 0x50, 0x4e, 0x47] : [0xff, 0xd8, 0xff];
  const bytes = Buffer.concat([Buffer.from(header), Buffer.alloc(size - header.length, 1)]);
  return `data:image/${type};base64,${bytes.toString("base64")}`;
}

test("every profile route requires sign-in and writes require our Origin", async () => {
  const routes = [["GET", "/profile/me"], ["PATCH", "/profile/me"], ["DELETE", "/profile/me"], ["GET", "/profile/linked"], ["POST", "/profile/linked"],
    ["DELETE", "/profile/linked/000000000000000000000000"], ["PUT", "/profile/me/picture"], ["DELETE", "/profile/me/picture"],
    ["PUT", "/profile/linked/000000000000000000000000/picture"], ["DELETE", "/profile/linked/000000000000000000000000/picture"]];
  for (const [method, path] of routes) assert.equal((await request(method, path, { body: method === "GET" ? undefined : {} })).status, 401, `${method} ${path}`);
  const cookie = token(await user());
  assert.equal((await request("PATCH", "/profile/me", { cookie, origin: "https://evil.example", body: { fullName: "X" } })).status, 403);
});

test("reads and edits my profile, ignoring fields that are not editable", async () => {
  const account = await user(); const cookie = token(account);
  const me = await request("GET", "/profile/me", { cookie });
  assert.deepEqual(me.body.profile, { id: "self", fullName: "Owner", email: "owner@example.test", phone: "", dateOfBirth: "", relationship: "self", isSelf: true, profilePicture: "", authProvider: "password" });
  const saved = await request("PATCH", "/profile/me", { cookie, body: { fullName: "  New Name ", phone: "+961 71 123 456", dateOfBirth: "1990-02-03", email: "attacker@example.test", passwordHash: "x", authVersion: 99, twoFactorEnabled: true } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.profile.fullName, "New Name"); assert.equal(saved.body.profile.phone, "+96171123456"); assert.equal(saved.body.profile.dateOfBirth, "1990-02-03");
  const stored = await User.findById(account._id);
  assert.equal(stored.email, "owner@example.test"); assert.equal(stored.passwordHash, passwordHash); assert.equal(stored.authVersion, 0); assert.equal(stored.twoFactorEnabled, false);
  assert.equal((await request("GET", "/profile/me", { cookie })).body.profile.fullName, "New Name");
  // Clearing the optional fields.
  const cleared = await request("PATCH", "/profile/me", { cookie, body: { phone: "", dateOfBirth: "" } });
  assert.equal(cleared.body.profile.phone, ""); assert.equal(cleared.body.profile.dateOfBirth, "");
});

test("rejects an invalid name, phone or date of birth", async () => {
  const cookie = token(await user());
  for (const body of [{ fullName: "" }, { fullName: "   " }, { fullName: "x".repeat(101) }, { fullName: 5 }, { phone: "abc" }, { phone: "12" }, { phone: ["71123456"] },
    { dateOfBirth: "2999-01-01" }, { dateOfBirth: "2020-02-30" }, { dateOfBirth: "01/02/1990" }, { dateOfBirth: 5 }]) {
    assert.equal((await request("PATCH", "/profile/me", { cookie, body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await request("GET", "/profile/me", { cookie })).body.profile.fullName, "Owner");
});

test("creates, lists and deletes linked profiles, always owned by the signed-in user", async () => {
  const account = await user(); const other = await user("other@example.test"); const cookie = token(account);
  const created = await addDependent(cookie, { fullName: " Lina ", owner: String(other._id), _id: "000000000000000000000001" });
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.body.profile).sort(), ["dateOfBirth", "fullName", "id", "isSelf", "profilePicture", "relationship"]);
  assert.equal(created.body.profile.fullName, "Lina"); assert.equal(created.body.profile.dateOfBirth, "2015-06-01"); assert.equal(created.body.profile.isSelf, false);
  assert.notEqual(created.body.profile.id, "000000000000000000000001");
  assert.equal(String((await LinkedProfile.findById(created.body.profile.id)).owner), String(account._id));
  await addDependent(cookie, { fullName: "Sami", relationship: "parent", dateOfBirth: "1960-01-01" });
  const list = await request("GET", "/profile/linked", { cookie });
  assert.deepEqual(list.body.profiles.map(p => p.fullName), ["Lina", "Sami"]);
  assert.equal((await request("DELETE", `/profile/linked/${created.body.profile.id}`, { cookie })).status, 204);
  assert.deepEqual((await request("GET", "/profile/linked", { cookie })).body.profiles.map(p => p.fullName), ["Sami"]);
  assert.equal((await request("DELETE", `/profile/linked/${created.body.profile.id}`, { cookie })).status, 404);
});

test("rejects invalid linked profiles and more than 10", async () => {
  const cookie = token(await user());
  for (const fields of [{ fullName: "" }, { dateOfBirth: "" }, { dateOfBirth: "2999-01-01" }, { relationship: "self" }, { relationship: "friend" }]) {
    assert.equal((await addDependent(cookie, fields)).status, 400, JSON.stringify(fields));
  }
  for (let i = 0; i < 10; i++) assert.equal((await addDependent(cookie, { fullName: `Child ${i}` })).status, 201);
  const eleventh = await addDependent(cookie);
  assert.equal(eleventh.status, 400); assert.equal(eleventh.body.error, "You can link up to 10 dependents.");
  assert.equal(await LinkedProfile.countDocuments(), 10);
});

test("another user's linked profiles can't be seen, deleted or changed", async () => {
  const alice = await user("alice@example.test"); const bob = await user("bob@example.test");
  const aliceCookie = token(alice); const bobCookie = token(bob);
  const aliceChild = (await addDependent(aliceCookie, { fullName: "Alice Child" })).body.profile;
  await addDependent(bobCookie, { fullName: "Bob Child" });
  assert.deepEqual((await request("GET", "/profile/linked", { cookie: aliceCookie })).body.profiles.map(p => p.fullName), ["Alice Child"]);
  assert.deepEqual((await request("GET", "/profile/linked", { cookie: bobCookie })).body.profiles.map(p => p.fullName), ["Bob Child"]);
  assert.equal((await request("DELETE", `/profile/linked/${aliceChild.id}`, { cookie: bobCookie })).status, 404);
  assert.equal((await request("PUT", `/profile/linked/${aliceChild.id}/picture`, { cookie: bobCookie, body: { profilePicture: picture("png") } })).status, 404);
  assert.equal((await request("DELETE", `/profile/linked/${aliceChild.id}/picture`, { cookie: bobCookie })).status, 404);
  for (const id of ["not-an-id", "self", "000000000000000000000000", String(bob._id)]) {
    assert.equal((await request("DELETE", `/profile/linked/${id}`, { cookie: aliceCookie })).status, 404, id);
    assert.equal((await request("PUT", `/profile/linked/${id}/picture`, { cookie: aliceCookie, body: { profilePicture: picture("png") } })).status, 404, id);
  }
  const stored = await LinkedProfile.findById(aliceChild.id);
  assert.equal(stored.fullName, "Alice Child"); assert.equal(stored.profilePicture, "");
  assert.equal(await LinkedProfile.countDocuments(), 2);
});

test("sets and removes pictures for me and my linked profiles, PNG or JPEG up to 1 MB only", async () => {
  const cookie = token(await user());
  const child = (await addDependent(cookie)).body.profile;
  const png = picture("png"); const jpeg = picture("jpeg", 1024 * 1024);
  const mine = await request("PUT", "/profile/me/picture", { cookie, body: { profilePicture: png } });
  assert.equal(mine.status, 200); assert.equal(mine.body.profile.profilePicture, png);
  const childs = await request("PUT", `/profile/linked/${child.id}/picture`, { cookie, body: { profilePicture: jpeg } });
  assert.equal(childs.status, 200); assert.equal(childs.body.profile.profilePicture, jpeg);
  assert.equal((await request("DELETE", "/profile/me/picture", { cookie })).body.profile.profilePicture, "");
  assert.equal((await request("DELETE", `/profile/linked/${child.id}/picture`, { cookie })).body.profile.profilePicture, "");
  const gif = "data:image/gif;base64," + Buffer.from("GIF89a").toString("base64");
  const svg = "data:image/svg+xml;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64");
  const fakePng = "data:image/png;base64," + Buffer.from("not really a png").toString("base64");
  for (const profilePicture of [gif, svg, fakePng, "https://example.com/a.png", "", 5, picture("png", 1024 * 1024 + 1)]) {
    assert.equal((await request("PUT", "/profile/me/picture", { cookie, body: { profilePicture } })).status, 400);
  }
  // Bodies above the picture routes' limit, and big bodies anywhere else, are refused before any route runs.
  assert.equal((await request("PUT", "/profile/me/picture", { cookie, body: { profilePicture: picture("png", 1200 * 1024) } })).status, 413);
  assert.equal((await request("PATCH", "/profile/me", { cookie, body: { fullName: "x".repeat(200 * 1024) } })).status, 413);
  assert.equal((await request("GET", "/profile/me", { cookie })).body.profile.profilePicture, "");
});

test("deleting a password account needs DELETE and the right password, then removes all its data", async () => {
  const account = await user("owner@example.test", { emergencyContact: { name: "Mum", phone: "71123456" } });
  const other = await user("other@example.test", { emergencyContact: { name: "Dad", phone: "71123457" } });
  const cookie = token(account); const otherCookie = token(other);
  await addDependent(cookie); await addDependent(cookie, { fullName: "Second" }); await addDependent(otherCookie, { fullName: "Other Child" });
  for (const body of [{ password }, { confirm: "delete", password }, { confirm: "DELETE", password: "wrong password" }, { confirm: "DELETE" }, { confirm: "DELETE", email: "owner@example.test" }]) {
    assert.equal((await request("DELETE", "/profile/me", { cookie, body })).status, 400, JSON.stringify(body));
  }
  assert.ok(await User.findById(account._id)); assert.equal(await LinkedProfile.countDocuments({ owner: account._id }), 2);
  const deleted = await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } });
  assert.equal(deleted.status, 204);
  assert.match(deleted.headers.getSetCookie().at(-1), /^accessToken=;.*Expires=Thu, 01 Jan 1970/);
  assert.equal(await User.findById(account._id), null);
  assert.equal(await LinkedProfile.countDocuments({ owner: account._id }), 0);
  assert.equal((await request("GET", "/profile/me", { cookie })).status, 401);
  assert.equal((await request("GET", "/auth/me", { cookie })).status, 401);
  // The other account is untouched.
  const otherStored = await User.findById(other._id);
  assert.equal(otherStored.emergencyContact.name, "Dad"); assert.equal(await LinkedProfile.countDocuments({ owner: other._id }), 1);
});

test("a Google-only account confirms deletion with its email instead of a password", async () => {
  const account = await user("google.user@example.test", { authProvider: "google", googleId: "google-123" });
  const cookie = token(account);
  await addDependent(cookie);
  for (const body of [{ confirm: "DELETE", email: "someone@example.test" }, { confirm: "DELETE", password }, { email: "google.user@example.test" }]) {
    assert.equal((await request("DELETE", "/profile/me", { cookie, body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await request("GET", "/profile/me", { cookie })).body.profile.authProvider, "google");
  assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", email: " Google.User@example.test " } })).status, 204);
  assert.equal(await User.countDocuments(), 0); assert.equal(await LinkedProfile.countDocuments(), 0);
});

test("account deletion attempts are rate-limited per account", async () => {
  const account = await user(); const cookie = token(account);
  for (let i = 0; i < 10; i++) assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password: "wrong" } })).status, 400);
  const limited = await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } });
  assert.equal(limited.status, 429);
  assert.ok(await User.findById(account._id));
});

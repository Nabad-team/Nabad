const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const Medication = require("../src/models/Medication");
let mongod, server, base;
const password = "Medication test password 123!";
let passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), Medication.init()]);
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
beforeEach(async () => { await User.deleteMany({}); await Medication.deleteMany({}); });

async function user(email = "owner@example.test") { return User.create({ name: "Owner", email, passwordHash }); }
function token(account) { return jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }); }
async function request(method, path, { body, cookie, origin = process.env.CLIENT_ORIGIN } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const paracetamol = { name: "Paracetamol", dose: "500", unit: "mg", form: "tablet", frequency: "twice a day", startDate: "2026-09-01", endDate: "", notes: "After food" };
const add = (cookie, fields = {}) => request("POST", "/medications", { cookie, body: { ...paracetamol, ...fields } });
const MISSING_ID = "000000000000000000000000";

test("every medication route requires sign-in and writes require our Origin", async () => {
  const routes = [["GET", "/medications"], ["POST", "/medications"], ["PUT", `/medications/${MISSING_ID}`],
    ["PATCH", `/medications/${MISSING_ID}/status`], ["DELETE", `/medications/${MISSING_ID}`]];
  for (const [method, path] of routes) assert.equal((await request(method, path, { body: method === "GET" ? undefined : {} })).status, 401, `${method} ${path}`);
  const cookie = token(await user());
  assert.equal((await request("POST", "/medications", { cookie, origin: "https://evil.example", body: paracetamol })).status, 403);
});

test("creates a medication for my own profile, ignoring owner, profile and status in the body", async () => {
  const account = await user(); const cookie = token(account);
  const other = await user("other@example.test");
  const created = await add(cookie, { name: "  Paracetamol ", owner: String(other._id), profileId: String(other._id), status: "discontinued" });
  assert.equal(created.status, 201);
  const { id, createdAt, updatedAt, ...fields } = created.body.medication;
  assert.ok(id && createdAt && updatedAt);
  assert.deepEqual(fields, { profileId: "self", name: "Paracetamol", dose: "500", unit: "mg", form: "tablet", frequency: "twice a day", startDate: "2026-09-01", endDate: "", status: "active", notes: "After food" });
  const stored = await Medication.findById(id);
  assert.equal(String(stored.owner), String(account._id));
  assert.equal(String(stored.profileId), String(account._id));
});

test("only the name and start date are required", async () => {
  const cookie = token(await user());
  const created = await request("POST", "/medications", { cookie, body: { name: "Ventolin", startDate: "2026-01-15" } });
  assert.equal(created.status, 201);
  assert.equal(created.body.medication.form, "tablet");
  assert.equal(created.body.medication.dose, "");
  assert.equal(created.body.medication.endDate, "");
});

test("lists active medications first, then discontinued, newest first within each", async () => {
  const cookie = token(await user());
  const ids = {};
  for (const name of ["Old active", "Old stopped", "New active", "New stopped"]) ids[name] = (await add(cookie, { name })).body.medication.id;
  for (const name of ["Old stopped", "New stopped"]) await request("PATCH", `/medications/${ids[name]}/status`, { cookie, body: { status: "discontinued" } });
  const list = await request("GET", "/medications", { cookie });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.medications.map((m) => m.name), ["New active", "Old active", "New stopped", "Old stopped"]);
});

test("updates every editable field, keeping the status", async () => {
  const cookie = token(await user());
  const { id } = (await add(cookie)).body.medication;
  await request("PATCH", `/medications/${id}/status`, { cookie, body: { status: "discontinued" } });
  const updated = await request("PUT", `/medications/${id}`, { cookie, body: { name: "Ibuprofen", dose: "200", unit: "mg", form: "syrup", frequency: "every 8 hours", startDate: "2026-08-01", endDate: "2026-08-10", notes: "" } });
  assert.equal(updated.status, 200);
  const { name, dose, form, frequency, startDate, endDate, notes, status } = updated.body.medication;
  assert.deepEqual({ name, dose, form, frequency, startDate, endDate, notes, status },
    { name: "Ibuprofen", dose: "200", form: "syrup", frequency: "every 8 hours", startDate: "2026-08-01", endDate: "2026-08-10", notes: "", status: "discontinued" });
  assert.equal((await request("GET", "/medications", { cookie })).body.medications[0].name, "Ibuprofen");
});

test("marks a medication discontinued and active again", async () => {
  const cookie = token(await user());
  const { id } = (await add(cookie)).body.medication;
  const stopped = await request("PATCH", `/medications/${id}/status`, { cookie, body: { status: "discontinued" } });
  assert.equal(stopped.status, 200); assert.equal(stopped.body.medication.status, "discontinued");
  const again = await request("PATCH", `/medications/${id}/status`, { cookie, body: { status: "active" } });
  assert.equal(again.body.medication.status, "active");
  for (const status of ["paused", "", undefined, ["active"]]) {
    const bad = await request("PATCH", `/medications/${id}/status`, { cookie, body: { status } });
    assert.equal(bad.status, 400); assert.equal(bad.body.error, "Status must be active or discontinued.");
  }
});

test("deletes a medication", async () => {
  const cookie = token(await user());
  const { id } = (await add(cookie)).body.medication;
  assert.equal((await request("DELETE", `/medications/${id}`, { cookie })).status, 204);
  assert.equal(await Medication.countDocuments(), 0);
  assert.equal((await request("DELETE", `/medications/${id}`, { cookie })).status, 404);
});

test("rejects invalid medications with a clear message", async () => {
  const cookie = token(await user());
  const cases = [
    [{ name: "" }, "Enter the medication name."],
    [{ name: "   " }, "Enter the medication name."],
    [{ name: undefined }, "Enter the medication name."],
    [{ name: 5 }, "Medication name must be text."],
    [{ name: "x".repeat(101) }, "Medication name must be 100 characters or fewer."],
    [{ dose: "1".repeat(41) }, "Dose must be 40 characters or fewer."],
    [{ unit: "m".repeat(21) }, "Unit must be 20 characters or fewer."],
    [{ frequency: "f".repeat(101) }, "How often must be 100 characters or fewer."],
    [{ notes: "n".repeat(1001) }, "Notes must be 1000 characters or fewer."],
    [{ form: "capsule" }, "Choose a form: tablet, syrup, injection, inhaler, drops or other."],
    [{ startDate: "" }, "Enter a valid start date."],
    [{ startDate: "2026-02-30" }, "Enter a valid start date."],
    [{ startDate: "01/09/2026" }, "Enter a valid start date."],
    [{ startDate: "1850-01-01" }, "Enter a valid start date."],
    [{ endDate: "2026-13-01" }, "Enter a valid end date, or leave it empty."],
    [{ endDate: "2026-08-31" }, "The end date can't be before the start date."],
  ];
  for (const [fields, error] of cases) {
    const response = await add(cookie, fields);
    assert.equal(response.status, 400, JSON.stringify(fields));
    assert.equal(response.body.error, error, JSON.stringify(fields));
  }
  // The same rules apply when editing.
  const { id } = (await add(cookie)).body.medication;
  const badEdit = await request("PUT", `/medications/${id}`, { cookie, body: { ...paracetamol, endDate: "2026-01-01" } });
  assert.equal(badEdit.status, 400); assert.equal(badEdit.body.error, "The end date can't be before the start date.");
  assert.equal(await Medication.countDocuments(), 1);
  // An end date on the start date is fine.
  assert.equal((await add(cookie, { endDate: paracetamol.startDate })).status, 201);
});

test("one user can't see, edit, change or delete another user's medication: it looks like it doesn't exist", async () => {
  const owner = token(await user());
  const intruder = token(await user("intruder@example.test"));
  const { id } = (await add(owner)).body.medication;
  assert.deepEqual((await request("GET", "/medications", { cookie: intruder })).body.medications, []);
  const attempts = [
    ["PUT", `/medications/${id}`, { ...paracetamol, name: "Hacked" }],
    ["PATCH", `/medications/${id}/status`, { status: "discontinued" }],
    ["DELETE", `/medications/${id}`, undefined],
  ];
  for (const [method, path, body] of attempts) {
    const theirs = await request(method, path, { cookie: intruder, body });
    const missing = await request(method, path.replace(id, MISSING_ID), { cookie: intruder, body });
    assert.equal(theirs.status, 404, `${method} ${path}`);
    assert.deepEqual(theirs.body, missing.body, "same answer as a missing id");
  }
  assert.equal((await request("PUT", "/medications/not-an-id", { cookie: intruder, body: paracetamol })).status, 404);
  const stored = await Medication.findById(id);
  assert.equal(stored.name, "Paracetamol"); assert.equal(stored.status, "active");
});

test("never writes medication names, doses or notes to the logs", async () => {
  const cookie = token(await user());
  const secret = { name: "Secretmedicine", dose: "777", unit: "mcg", frequency: "Hiddenfrequency", notes: "Privatenote" };
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { written.push(String(chunk)); return original.call(this, chunk, ...rest); };
  try {
    const { id } = (await add(cookie, secret)).body.medication;
    await request("PUT", `/medications/${id}`, { cookie, body: { ...paracetamol, ...secret } });
    await request("POST", "/medications", { cookie, body: { ...secret, startDate: "bad" } });
    await request("GET", "/medications", { cookie });
  } finally { process.stdout.write = original; }
  const logs = written.join("");
  assert.match(logs, /http_request/);
  for (const value of Object.values(secret)) assert.ok(!logs.includes(value), `log contains ${value}`);
});

test("writes are rate-limited per account", async () => {
  const cookie = token(await user());
  const { id } = (await add(cookie)).body.medication;
  for (let i = 1; i < 100; i++) assert.notEqual((await request("PATCH", `/medications/${id}/status`, { cookie, body: { status: "active" } })).status, 429);
  const limited = await request("PATCH", `/medications/${id}/status`, { cookie, body: { status: "active" } });
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /Too many changes/);
  // Reading the list is not limited, and another account is not affected.
  assert.equal((await request("GET", "/medications", { cookie })).status, 200);
  assert.equal((await add(token(await user("second@example.test")))).status, 201);
});

test("deleting the account also deletes its medications, and only its own", async () => {
  const account = await user(); const cookie = token(account);
  const other = token(await user("other@example.test"));
  await add(cookie); await add(cookie, { name: "Ibuprofen" });
  await add(other);
  assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } })).status, 204);
  assert.equal(await Medication.countDocuments({ owner: account._id }), 0);
  assert.equal(await Medication.countDocuments(), 1);
});

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const Medication = require("../src/models/Medication");
const MedicationAdherence = require("../src/models/MedicationAdherence");
const LinkedProfile = require("../src/models/LinkedProfile");
let mongod, server, base;
const password = "Medication test password 123!";
let passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await createTestMongo();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), Medication.init(), MedicationAdherence.init(), LinkedProfile.init()]);
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
beforeEach(async () => { await User.deleteMany({}); await Medication.deleteMany({}); await MedicationAdherence.deleteMany({}); await LinkedProfile.deleteMany({}); });

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
// A dependent (linked profile) of the signed-in user, created through the profile API. Returns its id.
async function dependent(cookie, fullName = "Child") {
  const created = await request("POST", "/profile/linked", { cookie, body: { fullName, dateOfBirth: "2015-06-01", relationship: "child" } });
  assert.equal(created.status, 201);
  return created.body.profile.id;
}
const forProfile = (path, profileId) => `${path}?profileId=${profileId}`;
const names = async (cookie, profileId = "self") => (await request("GET", forProfile("/medications", profileId), { cookie })).body.medications.map((m) => m.name);

test("every medication route requires sign-in and writes require our Origin", async () => {
  const routes = [["GET", "/medications"], ["POST", "/medications"], ["PUT", `/medications/${MISSING_ID}`],
    ["GET", "/medications/adherence?date=2026-10-19"], ["PUT", `/medications/${MISSING_ID}/adherence`],
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
  // Letters outside 0-9 and a-f, so a value can't turn up by chance inside a timestamp, duration or request id.
  const secret = { name: "Secretmedicine", dose: "Qzdose", unit: "Wxunit", frequency: "Hiddenfrequency", notes: "Privatenote" };
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

test("deleting the account also deletes its own and every dependent's medications, and only those", async () => {
  const account = await user(); const cookie = token(account);
  const other = token(await user("other@example.test"));
  const childId = await dependent(cookie);
  await add(cookie); await add(cookie, { name: "Ibuprofen" });
  await request("POST", forProfile("/medications", childId), { cookie, body: paracetamol });
  await add(other);
  assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } })).status, 204);
  assert.equal(await Medication.countDocuments({ owner: account._id }), 0);
  assert.equal(await Medication.countDocuments({ profileId: childId }), 0);
  assert.equal(await LinkedProfile.countDocuments(), 0);
  assert.equal(await Medication.countDocuments(), 1);
});

test("a caregiver manages a dependent's medications, kept apart from their own", async () => {
  const account = await user(); const cookie = token(account);
  const childId = await dependent(cookie);
  await add(cookie, { name: "My own" });
  // A profileId in the body is ignored: only the query decides whose list it goes on.
  const created = await request("POST", forProfile("/medications", childId), { cookie, body: { ...paracetamol, name: "Child syrup", form: "syrup", profileId: "self" } });
  assert.equal(created.status, 201);
  assert.equal(created.body.medication.profileId, childId);
  const stored = await Medication.findById(created.body.medication.id);
  assert.equal(String(stored.owner), String(account._id)); assert.equal(String(stored.profileId), childId);

  assert.deepEqual(await names(cookie, childId), ["Child syrup"]);
  assert.deepEqual(await names(cookie), ["My own"]);
  assert.deepEqual((await request("GET", "/medications", { cookie })).body.medications.map((m) => m.name), ["My own"], "no profileId means self");

  const id = created.body.medication.id;
  const edited = await request("PUT", forProfile(`/medications/${id}`, childId), { cookie, body: { ...paracetamol, name: "Child drops", form: "drops" } });
  assert.equal(edited.status, 200); assert.equal(edited.body.medication.name, "Child drops");
  const stopped = await request("PATCH", forProfile(`/medications/${id}/status`, childId), { cookie, body: { status: "discontinued" } });
  assert.equal(stopped.body.medication.status, "discontinued");
  assert.equal((await request("DELETE", forProfile(`/medications/${id}`, childId), { cookie })).status, 204);
  assert.deepEqual(await names(cookie, childId), []);
  assert.deepEqual(await names(cookie), ["My own"]);
});

test("a medication is only reachable through the profile it belongs to", async () => {
  const cookie = token(await user());
  const childId = await dependent(cookie);
  const mine = (await add(cookie)).body.medication.id;
  const childs = (await request("POST", forProfile("/medications", childId), { cookie, body: paracetamol })).body.medication.id;
  // The child's medication through my own profile, and mine through the child's: both look missing.
  for (const [id, profileId] of [[childs, "self"], [mine, childId]]) {
    assert.equal((await request("PUT", forProfile(`/medications/${id}`, profileId), { cookie, body: paracetamol })).status, 404);
    assert.equal((await request("PATCH", forProfile(`/medications/${id}/status`, profileId), { cookie, body: { status: "discontinued" } })).status, 404);
    assert.equal((await request("DELETE", forProfile(`/medications/${id}`, profileId), { cookie })).status, 404);
  }
  assert.equal(await Medication.countDocuments({ status: "active" }), 2);
});

test("a caregiver can't reach another user's dependent or that dependent's medications", async () => {
  const parent = token(await user());
  const stranger = token(await user("stranger@example.test"));
  const childId = await dependent(parent);
  const { id } = (await request("POST", forProfile("/medications", childId), { cookie: parent, body: paracetamol })).body.medication;

  const attempts = [
    ["GET", "/medications", undefined],
    ["POST", "/medications", paracetamol],
    ["PUT", `/medications/${id}`, { ...paracetamol, name: "Hacked" }],
    ["PATCH", `/medications/${id}/status`, { status: "discontinued" }],
    ["DELETE", `/medications/${id}`, undefined],
  ];
  for (const [method, path, body] of attempts) {
    for (const profileId of [childId, MISSING_ID, "not-an-id"]) {
      const response = await request(method, forProfile(path, profileId), { cookie: stranger, body });
      assert.equal(response.status, 404, `${method} ${path} as ${profileId}`);
      assert.deepEqual(response.body, { error: "Profile not found." });
    }
  }
  const stored = await Medication.findById(id);
  assert.equal(stored.name, "Paracetamol"); assert.equal(stored.status, "active");
  assert.equal(await Medication.countDocuments(), 1);
});

test("removing a dependent removes their medications, and nobody else's", async () => {
  const cookie = token(await user());
  const other = token(await user("other@example.test"));
  const childId = await dependent(cookie, "Child");
  const siblingId = await dependent(cookie, "Sibling");
  await add(cookie, { name: "Mine" });
  const childMedication = (await request("POST", forProfile("/medications", childId), { cookie, body: { ...paracetamol, name: "Child 1" } })).body.medication;
  await request("POST", forProfile("/medications", childId), { cookie, body: { ...paracetamol, name: "Child 2" } });
  await request("POST", forProfile("/medications", siblingId), { cookie, body: { ...paracetamol, name: "Sibling" } });
  await add(other, { name: "Other user" });

  // Someone else can't remove the dependent (or its medications).
  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie: other })).status, 404);
  assert.equal(await Medication.countDocuments({ profileId: childId }), 2);
  await request("PUT", forProfile(`/medications/${childMedication.id}/adherence`, childId), { cookie, body: { date: "2026-10-19", taken: true } });

  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie })).status, 204);
  assert.equal(await Medication.countDocuments({ profileId: childId }), 0);
  assert.equal(await MedicationAdherence.countDocuments({ profileId: childId }), 0);
  assert.deepEqual(await names(cookie), ["Mine"]);
  assert.deepEqual(await names(cookie, siblingId), ["Sibling"]);
  assert.deepEqual(await names(other), ["Other user"]);
  // The removed profile is gone for medications too.
  assert.equal((await request("GET", forProfile("/medications", childId), { cookie })).status, 404);
});

test("daily medication check-ins are saved per medication, date and profile", async () => {
  const account = await user();
  const cookie = token(account);
  const childId = await dependent(cookie);
  const mine = (await add(cookie)).body.medication.id;
  const childs = (await request("POST", forProfile("/medications", childId), { cookie, body: { ...paracetamol, name: "Child medicine" } })).body.medication.id;
  const date = "2026-10-19";
  const selfPath = `/medications/adherence?profileId=self&date=${date}`;
  const childPath = `/medications/adherence?profileId=${childId}&date=${date}`;

  assert.deepEqual((await request("GET", selfPath, { cookie })).body.medications.map(({ id, taken }) => ({ id, taken })), [{ id: mine, taken: false }]);
  assert.equal((await request("PUT", forProfile(`/medications/${mine}/adherence`, "self"), { cookie, body: { date, taken: true } })).body.taken, true);
  assert.deepEqual((await request("GET", selfPath, { cookie })).body.medications.map(({ id, taken }) => ({ id, taken })), [{ id: mine, taken: true }]);
  assert.deepEqual((await request("GET", childPath, { cookie })).body.medications.map(({ id, taken }) => ({ id, taken })), [{ id: childs, taken: false }]);
  assert.equal(await MedicationAdherence.countDocuments(), 1, "repeating a check-in is idempotent");

  assert.equal((await request("PUT", forProfile(`/medications/${mine}/adherence`, "self"), { cookie, body: { date, taken: false } })).status, 200);
  assert.equal((await request("GET", selfPath, { cookie })).body.medications[0].taken, false);
  assert.equal((await request("PUT", forProfile(`/medications/${mine}/adherence`, "self"), { cookie, body: { date: "2026-02-30", taken: true } })).status, 400);
  assert.equal((await request("GET", `/medications/adherence?profileId=self&date=2026-02-30`, { cookie })).status, 400);
});

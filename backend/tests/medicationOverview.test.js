// SCRUM-150: GET /api/medications/overview, every medication of the user and their linked profiles (residents).
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const Medication = require("../src/models/Medication");
const LinkedProfile = require("../src/models/LinkedProfile");

let mongod, server, base, passwordHash;
const DAY = 24 * 60 * 60 * 1000;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await createTestMongo();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), Medication.init(), LinkedProfile.init()]);
  passwordHash = await bcrypt.hash("Overview test password 123!", 4);
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => { await User.deleteMany({}); await Medication.deleteMany({}); await LinkedProfile.deleteMany({}); });

const user = (name, email) => User.create({ name, email, passwordHash });
const token = (account) => jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
async function request(method, path, { cookie } = {}) {
  const response = await fetch(base + path, { method, headers: { Origin: process.env.CLIENT_ORIGIN, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) } });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}
const resident = (owner, fullName, createdAt = new Date()) =>
  LinkedProfile.create({ owner: owner._id, fullName, dateOfBirth: new Date("1940-01-01"), relationship: "other", createdAt });
// Inserted directly so updatedAt can be set in the past (Mongoose timestamps would overwrite it).
async function medication(owner, profileId, fields = {}) {
  const doc = { owner: owner._id, profileId, name: "Paracetamol", dose: "500", unit: "mg", form: "tablet", frequency: "twice a day", times: [],
    startDate: new Date("2026-09-01"), endDate: null, status: "active", notes: "private note", createdAt: new Date(Date.now() - 30 * DAY), updatedAt: new Date(Date.now() - 30 * DAY), ...fields };
  const { insertedId } = await Medication.collection.insertOne(doc);
  return insertedId;
}

test("requires sign-in", async () => {
  assert.equal((await request("GET", "/medications/overview")).status, 401);
});

test("returns the user and every linked profile with their medications, active first and by name", async () => {
  const layla = await user("Layla", "layla@example.test");
  const amal = await resident(layla, "Amal Haddad", new Date(Date.now() - 2 * DAY));
  const omar = await resident(layla, "Omar Khoury", new Date(Date.now() - DAY));
  await medication(layla, layla._id, { name: "Vitamin D" });
  await medication(layla, amal._id, { name: "warfarin", dose: "5", unit: "mg", times: ["08:00"], frequency: "" });
  await medication(layla, amal._id, { name: "Aspirin", status: "discontinued" });
  await medication(layla, amal._id, { name: "Metformin" });

  const res = await request("GET", "/medications/overview", { cookie: token(layla) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.body.recentChangeDays, 7);
  const profiles = res.body.profiles;
  assert.deepEqual(profiles.map((p) => [p.id, p.name, p.isSelf, p.relationship]), [
    ["self", "Layla", true, null], [String(amal._id), "Amal Haddad", false, "other"], [String(omar._id), "Omar Khoury", false, "other"],
  ]);
  assert.deepEqual(profiles[1].medications.map((m) => `${m.name}:${m.status}`), ["Metformin:active", "warfarin:active", "Aspirin:discontinued"]);
  assert.deepEqual(profiles[1].counts, { active: 2, discontinued: 1 });
  const warfarin = profiles[1].medications[1];
  assert.deepEqual(Object.keys(warfarin).sort(), ["dose", "endDate", "flags", "form", "frequency", "id", "name", "startDate", "status", "times", "unit", "updatedAt"]);
  assert.deepEqual({ dose: warfarin.dose, unit: warfarin.unit, times: warfarin.times, startDate: warfarin.startDate, endDate: warfarin.endDate }, { dose: "5", unit: "mg", times: ["08:00"], startDate: "2026-09-01", endDate: "" });
  // Notes are not needed on the overview, so they are not sent.
  assert.ok(!JSON.stringify(res.body).includes("private note"));
  assert.equal(profiles[2].medications.length, 0);
});

test("computes the shift flags", async () => {
  const layla = await user("Layla", "layla@example.test");
  const amal = await resident(layla, "Amal");
  await resident(layla, "Empty");
  await medication(layla, amal._id, { name: "A complete" });
  await medication(layla, amal._id, { name: "B no dose", dose: "", unit: "" });
  await medication(layla, amal._id, { name: "C no schedule", frequency: "", times: [] });
  await medication(layla, amal._id, { name: "D times only", frequency: "", times: ["08:00", "20:00"] });
  await medication(layla, amal._id, { name: "E changed 2 days ago", updatedAt: new Date(Date.now() - 2 * DAY) });
  await medication(layla, amal._id, { name: "F changed 8 days ago", updatedAt: new Date(Date.now() - 8 * DAY) });
  await medication(layla, amal._id, { name: "G stopped, no dose", dose: "", frequency: "", status: "discontinued" });

  const { body } = await request("GET", "/medications/overview", { cookie: token(layla) });
  const [self, amalView, empty] = body.profiles;
  const flags = Object.fromEntries(amalView.medications.map((m) => [m.name, m.flags]));
  assert.deepEqual(flags["A complete"], { missingDose: false, missingSchedule: false, changedRecently: false });
  assert.deepEqual(flags["B no dose"], { missingDose: true, missingSchedule: false, changedRecently: false });
  assert.deepEqual(flags["C no schedule"], { missingDose: false, missingSchedule: true, changedRecently: false });
  assert.equal(flags["D times only"].missingSchedule, false);
  assert.equal(flags["E changed 2 days ago"].changedRecently, true);
  assert.equal(flags["F changed 8 days ago"].changedRecently, false);
  // Discontinued medications are not given any more, so missing details don't matter.
  assert.deepEqual(flags["G stopped, no dose"], { missingDose: false, missingSchedule: false, changedRecently: false });
  assert.deepEqual(amalView.flags, { noMedications: false, missingDetails: 2, changedRecently: 1 });
  assert.deepEqual(empty.flags, { noMedications: true, missingDetails: 0, changedRecently: 0 });
  assert.equal(self.flags.noMedications, true);

  // A medication added or edited through the API counts as changed now.
  const cookie = token(layla);
  const created = await fetch(`${base}/medications?profileId=${amalView.id}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${cookie}` },
    body: JSON.stringify({ name: "H new", dose: "1", frequency: "daily", startDate: "2026-11-01" }),
  });
  assert.equal(created.status, 201);
  const again = await request("GET", "/medications/overview", { cookie });
  assert.equal(again.body.profiles[1].medications.find((m) => m.name === "H new").flags.changedRecently, true);
});

test("never shows another account's profiles or medications", async () => {
  const layla = await user("Layla", "layla@example.test");
  const other = await user("Other nurse", "other@example.test");
  const mine = await resident(layla, "My resident");
  const theirs = await resident(other, "Their resident");
  await medication(layla, mine._id, { name: "Mine" });
  await medication(other, theirs._id, { name: "Theirs" });
  await medication(other, other._id, { name: "Their own" });
  // A medication stored under my account but pointing at someone else's profile id is not shown either.
  await medication(layla, theirs._id, { name: "Stray" });

  for (const query of ["", `?profileId=${theirs._id}`, `?profileId=${other._id}`]) {
    const { status, body } = await request("GET", `/medications/overview${query}`, { cookie: token(layla) });
    assert.equal(status, 200, query);
    assert.deepEqual(body.profiles.map((p) => p.name), ["Layla", "My resident"], query);
    const text = JSON.stringify(body);
    for (const hidden of ["Theirs", "Their own", "Their resident", "Stray", String(theirs._id), String(other._id)]) assert.ok(!text.includes(hidden), `${query} leaked ${hidden}`);
  }
  const theirsView = await request("GET", "/medications/overview", { cookie: token(other) });
  assert.deepEqual(theirsView.body.profiles.map((p) => p.name), ["Other nurse", "Their resident"]);
});

test("the edit link's profile answers 404 for another account's profile, exactly like a missing one", async () => {
  const layla = await user("Layla", "layla@example.test");
  const other = await user("Other", "other@example.test");
  const theirs = await resident(other, "Their resident");
  const cookie = token(layla);
  const forOther = await request("GET", `/medications?profileId=${theirs._id}`, { cookie });
  const missing = await request("GET", "/medications?profileId=000000000000000000000000", { cookie });
  assert.equal(forOther.status, 404);
  assert.deepEqual(forOther.body, missing.body);
  assert.deepEqual(forOther.body, { error: "Profile not found." });
});

test("works for a nurse with many residents in a fixed number of queries", async () => {
  const layla = await user("Layla", "layla@example.test");
  const residents = await LinkedProfile.insertMany(Array.from({ length: 30 }, (_, i) => ({ owner: layla._id, fullName: `Resident ${String(i).padStart(2, "0")}`, dateOfBirth: new Date("1940-01-01"), relationship: "other" })));
  await Medication.collection.insertMany(residents.flatMap((r) => [1, 2, 3].map((n) => ({ owner: layla._id, profileId: r._id, name: `Med ${n}`, dose: "1", frequency: "daily", times: [], status: "active", startDate: new Date(), createdAt: new Date(), updatedAt: new Date() }))));

  let queries = 0;
  const count = () => { queries++; };
  mongoose.set("debug", count);
  let body;
  try {
    ({ body } = await request("GET", "/medications/overview", { cookie: token(layla) }));
  } finally { mongoose.set("debug", false); }
  assert.equal(body.profiles.length, 31);
  assert.ok(body.profiles.slice(1).every((p) => p.medications.length === 3));
  // requireAuth's user lookup + user + linked profiles + medications; independent of the number of residents.
  assert.ok(queries >= 3 && queries <= 5, `${queries} queries`);
});

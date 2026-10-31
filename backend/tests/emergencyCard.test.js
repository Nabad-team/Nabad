const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const HealthFact = require("../src/models/HealthFact");
const Medication = require("../src/models/Medication");
let mongo, server, base, owner, child, other, foreignChild;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", JWT_SECRET: require("node:crypto").randomBytes(32).toString("hex"), CLIENT_ORIGIN: "http://localhost:3000" });
  mongo = await createTestMongo(); process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  server = require("../src/app").createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/emergency-card`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (mongo) await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([User, LinkedProfile, HealthFact, Medication].map(Model => Model.deleteMany({})));
  owner = await User.create({ name: "Card Patient", email: "patient@example.test", passwordHash: "NEVER-EXPORT-HASH", dateOfBirth: new Date("1990-04-12"), emergencyContact: { name: "Patient Contact", phone: "+96170123456" } });
  other = await User.create({ name: "Other patient", email: "other@example.test", passwordHash: "OTHER-HASH" });
  child = await LinkedProfile.create({ owner: owner._id, fullName: "Child Patient", dateOfBirth: new Date("2020-06-01"), relationship: "child", emergencyContact: { name: "Child Contact", phone: "+96171987654" } });
  foreignChild = await LinkedProfile.create({ owner: other._id, fullName: "FOREIGN-PATIENT", dateOfBirth: new Date("2018-03-01"), relationship: "child" });
});
async function get(profileId = "self", account = owner) {
  const response = await fetch(`${base}?${new URLSearchParams({ profileId })}`, { headers: account ? { Cookie: `accessToken=${jwt.sign({ sub: String(account._id) }, process.env.JWT_SECRET, { expiresIn: "15m" })}` } : {} });
  return { response, body: await response.json() };
}
const fact = (profileId, category, value, fields = {}) => HealthFact.create({ owner: owner._id, profileId, category, value, ...fields });
const medication = (profileId, name, fields = {}) => Medication.create({ owner: owner._id, profileId, name, dose: "5", unit: "mg", form: "tablet", frequency: "Once daily", startDate: new Date("2020-01-01"), ...fields });

test("card returns confirmed conditions, allergy reactions, active medication details and the correct contact", async () => {
  await fact(owner._id, "condition", { code: "asthma" });
  await fact(owner._id, "allergy", { name: "Penicillin", type: "medication", reaction: "Hives" });
  await fact(owner._id, "bloodType", "O+");
  await medication(owner._id, "Test medicine");
  const { response, body } = await get();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(body.profile, { id: "self", fullName: "Card Patient", dateOfBirth: "1990-04-12" });
  assert.deepEqual(body.conditions, [{ code: "asthma" }]);
  assert.deepEqual(body.allergies, [{ name: "Penicillin", type: "medication", reaction: "Hives" }]);
  assert.deepEqual(body.medications, [{ name: "Test medicine", dose: "5", unit: "mg", form: "tablet", frequency: "Once daily" }]);
  assert.equal(body.bloodType, "O+");
  assert.deepEqual(body.emergencyContact, { name: "Patient Contact", phone: "+96170123456" });
  assert.ok(Number.isFinite(Date.parse(body.preparedAt)));
  assert.doesNotMatch(JSON.stringify(body), /HASH|patient@example|authVersion|owner|profileId/);
});
test("suggestions, discontinued medication and other profiles' data are excluded", async () => {
  await fact(owner._id, "condition", { code: "other", text: "UNCONFIRMED" }, { status: "suggested" });
  await fact(child._id, "allergy", { name: "CHILD-ONLY", type: "food" });
  await HealthFact.create({ owner: other._id, profileId: other._id, category: "condition", value: { code: "other", text: "FOREIGN-ONLY" } });
  await medication(owner._id, "DISCONTINUED", { status: "discontinued" });
  await medication(child._id, "CHILD-MEDICINE");
  const { body } = await get();
  assert.deepEqual(body.conditions, []); assert.deepEqual(body.allergies, []); assert.deepEqual(body.medications, []);
  assert.doesNotMatch(JSON.stringify(body), /UNCONFIRMED|CHILD-|FOREIGN-|DISCONTINUED/);
});
test("linked card is scoped to its patient and never inherits the account contact", async () => {
  await fact(child._id, "condition", { code: "other", text: "Child condition" });
  const { body } = await get(String(child._id));
  assert.equal(body.profile.fullName, "Child Patient");
  assert.equal(body.profile.id, String(child._id));
  assert.equal(body.emergencyContact.name, "Child Contact");
  await LinkedProfile.updateOne({ _id: child._id }, { $unset: { emergencyContact: 1 } });
  assert.equal((await get(String(child._id))).body.emergencyContact, null);
});
test("missing values stay explicitly absent and refreshing reflects edits", async () => {
  const empty = (await get()).body;
  assert.deepEqual(empty.conditions, []); assert.deepEqual(empty.allergies, []);
  await fact(owner._id, "condition", { code: "diabetes" });
  assert.deepEqual((await get()).body.conditions, [{ code: "diabetes" }]);
});
test("signed-out, foreign, malformed and repeated profile requests cannot read a card", async () => {
  assert.equal((await get("self", null)).response.status, 401);
  for (const id of [String(foreignChild._id), String(other._id), new mongoose.Types.ObjectId().toString(), "bad-id"]) assert.equal((await get(id)).response.status, 404);
  const cookie = `accessToken=${jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET)}`;
  for (const query of ["profileId=self&profileId=other", "profileId[$ne]=self"]) assert.equal((await fetch(`${base}?${query}`, { headers: { Cookie: cookie } })).status, 404);
});

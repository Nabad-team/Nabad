const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const Medication = require("../src/models/Medication");
const HealthFact = require("../src/models/HealthFact");
const { HydrationEntry, SleepEntry, WellbeingSettings } = require("../src/models/Wellbeing");
const { getHealthSummary } = require("../src/healthProfile");
let mongod, server, base;
const password = "Health profile test password 123!";
let passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), Medication.init(), HealthFact.init()]);
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
beforeEach(async () => {
  await Promise.all([User, LinkedProfile, Medication, HealthFact, HydrationEntry, SleepEntry, WellbeingSettings].map((Model) => Model.deleteMany({})));
});

async function user(email = "owner@example.test", fields = {}) { return User.create({ name: "Owner", email, passwordHash, ...fields }); }
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
const withProfile = (path, profileId) => (profileId ? `${path}?profileId=${profileId}` : path);
const getProfile = (cookie, profileId) => request("GET", withProfile("/health-profile", profileId), { cookie });
const addFact = (cookie, category, value, profileId) => request("POST", withProfile("/health-profile/facts", profileId), { cookie, body: { category, value } });
const editFact = (cookie, id, value, profileId) => request("PUT", withProfile(`/health-profile/facts/${id}`, profileId), { cookie, body: { value } });
const removeFact = (cookie, id, profileId) => request("DELETE", withProfile(`/health-profile/facts/${id}`, profileId), { cookie });
const confirm = (cookie, id, profileId) => request("POST", withProfile(`/health-profile/suggestions/${id}/confirm`, profileId), { cookie });
const dismiss = (cookie, id, profileId) => request("POST", withProfile(`/health-profile/suggestions/${id}/dismiss`, profileId), { cookie });
async function dependent(cookie, fullName = "Child", dateOfBirth = "2015-06-01") {
  const created = await request("POST", "/profile/linked", { cookie, body: { fullName, dateOfBirth, relationship: "child" } });
  assert.equal(created.status, 201);
  return created.body.profile.id;
}
// A suggestion as a future lab-report reader would store it: there is no route that creates one yet.
async function suggest(account, category, value, profileId = account._id) {
  return HealthFact.create({ owner: account._id, profileId, category, value, source: "lab_report", status: "suggested" });
}
// "YYYY-MM-DD", the given number of years and months before today (UTC).
function bornAgo(years, months = 0) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCFullYear(date.getUTCFullYear() - years, date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}
const EMPTY_SUMMARY = "Age: not recorded\nSex assigned at birth: not recorded\nLong-term conditions: none recorded\nAllergies: none recorded\nCurrent medications: none recorded";

test("every route requires sign-in and writes require our Origin", async () => {
  const id = "000000000000000000000000";
  const routes = [["GET", "/health-profile"], ["POST", "/health-profile/facts"], ["PUT", `/health-profile/facts/${id}`],
    ["DELETE", `/health-profile/facts/${id}`], ["POST", `/health-profile/suggestions/${id}/confirm`], ["POST", `/health-profile/suggestions/${id}/dismiss`]];
  for (const [method, path] of routes) assert.equal((await request(method, path, { body: method === "GET" || method === "DELETE" ? undefined : {} })).status, 401, `${method} ${path}`);
  const cookie = token(await user());
  assert.equal((await request("POST", "/health-profile/facts", { cookie, origin: "https://evil.example", body: { category: "sex", value: "female" } })).status, 403);
  assert.equal(await HealthFact.countDocuments(), 0);
});

test("/api/health is still the server's own health check", async () => {
  const response = await request("GET", "/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("an empty profile has no facts, no suggestions, and a summary that says nothing is recorded", async () => {
  const cookie = token(await user());
  const response = await getProfile(cookie);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { dateOfBirth: "", age: null, facts: [], suggestions: [], medications: [], summary: EMPTY_SUMMARY });
});

test("age comes from the date of birth already on the profile, in months for babies", async () => {
  const cookie = token(await user("owner@example.test", { dateOfBirth: new Date(bornAgo(34, 1)) }));
  assert.deepEqual((await getProfile(cookie)).body.age, { years: 34, text: "34 years" });
  const babyId = await dependent(cookie, "Baby", bornAgo(0, 8));
  const baby = (await getProfile(cookie, babyId)).body;
  assert.deepEqual(baby.age, { years: 0, text: "8 months" });
  assert.equal(baby.dateOfBirth, bornAgo(0, 8));
  assert.match(baby.summary, /^Age: 8 months$/m);
});

test("adds, edits and removes a basic, with its source, status and dates", async () => {
  const cookie = token(await user());
  const added = await addFact(cookie, "sex", "female");
  assert.equal(added.status, 201);
  const { fact } = added.body;
  assert.equal(fact.category, "sex"); assert.equal(fact.value, "female");
  assert.equal(fact.source, "user"); assert.equal(fact.status, "confirmed"); assert.equal(fact.profileId, "self");
  assert.ok(Date.parse(fact.recordedAt) && Date.parse(fact.updatedAt));

  const edited = await editFact(cookie, fact.id, "male");
  assert.equal(edited.status, 200);
  assert.equal(edited.body.fact.value, "male");
  assert.equal(edited.body.fact.recordedAt, fact.recordedAt, "the recorded date stays");
  assert.ok(Date.parse(edited.body.fact.updatedAt) >= Date.parse(fact.updatedAt));

  for (const [category, value] of [["height", 172], ["weight", 72.5], ["bloodType", "unknown"], ["pregnancy", "not_applicable"], ["smoking", "former"]]) {
    const response = await addFact(cookie, category, value);
    assert.equal(response.status, 201, category);
    assert.equal(response.body.fact.value, value);
  }
  const profile = (await getProfile(cookie)).body;
  assert.deepEqual(profile.facts.map((f) => [f.category, f.value]), [["sex", "male"], ["height", 172], ["weight", 72.5], ["bloodType", "unknown"], ["pregnancy", "not_applicable"], ["smoking", "former"]]);

  assert.equal((await removeFact(cookie, fact.id)).status, 204);
  assert.equal((await removeFact(cookie, fact.id)).status, 404);
  assert.equal((await getProfile(cookie)).body.facts.some((f) => f.category === "sex"), false);
});

test("a basic is recorded once per profile: a second one is refused, even at the same moment", async () => {
  const cookie = token(await user());
  const results = await Promise.all([addFact(cookie, "bloodType", "A+"), addFact(cookie, "bloodType", "O-"), addFact(cookie, "bloodType", "B+")]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  assert.equal(results.find((r) => r.status === 409).body.error, "This is already recorded. Change or remove it instead.");
  assert.equal(await HealthFact.countDocuments({ category: "bloodType" }), 1);
  // Removing it frees the place.
  await removeFact(cookie, results.find((r) => r.status === 201).body.fact.id);
  assert.equal((await addFact(cookie, "bloodType", "AB-")).status, 201);
});

test("conditions: each listed one once, any number of others in the user's words", async () => {
  const cookie = token(await user());
  const diabetes = await addFact(cookie, "condition", { code: "diabetes", text: "ignored" });
  assert.equal(diabetes.status, 201);
  assert.deepEqual(diabetes.body.fact.value, { code: "diabetes" });
  assert.equal((await addFact(cookie, "condition", { code: "diabetes" })).status, 409);
  assert.equal((await addFact(cookie, "condition", { code: "asthma" })).status, 201);
  const migraine = await addFact(cookie, "condition", { code: "other", text: "  Migraine  " });
  assert.deepEqual(migraine.body.fact.value, { code: "other", text: "Migraine" });
  assert.equal((await addFact(cookie, "condition", { code: "other", text: "Gout" })).status, 201);

  assert.equal((await editFact(cookie, migraine.body.fact.id, { code: "other", text: "Chronic migraine" })).body.fact.value.text, "Chronic migraine");
  // Changing an "other" into a listed condition that is already there is refused.
  assert.equal((await editFact(cookie, migraine.body.fact.id, { code: "asthma" })).status, 409);
  assert.match((await getProfile(cookie)).body.summary, /^Long-term conditions: diabetes; asthma; Chronic migraine; Gout$/m);
});

test("allergies: what to, the kind, and an optional reaction note", async () => {
  const cookie = token(await user());
  const penicillin = await addFact(cookie, "allergy", { type: "medication", name: "Penicillin", reaction: "Rash" });
  assert.equal(penicillin.status, 201);
  assert.deepEqual(penicillin.body.fact.value, { type: "medication", name: "Penicillin", reaction: "Rash" });
  const peanuts = await addFact(cookie, "allergy", { type: "food", name: "Peanuts" });
  assert.deepEqual(peanuts.body.fact.value, { type: "food", name: "Peanuts", reaction: "" });
  assert.equal((await addFact(cookie, "allergy", { type: "food", name: "Peanuts" })).status, 201, "allergies are a list");
  const edited = await editFact(cookie, peanuts.body.fact.id, { type: "food", name: "Peanuts", reaction: "Swollen lips" });
  assert.equal(edited.body.fact.value.reaction, "Swollen lips");
  assert.match((await getProfile(cookie)).body.summary, /^Allergies: Penicillin \(medication, reaction: Rash\); Peanuts \(food, reaction: Swollen lips\); Peanuts \(food\)$/m);
});

test("rejects invalid facts with a clear message", async () => {
  const cookie = token(await user());
  const cases = [
    [undefined, "female", "Choose what kind of health information this is."],
    ["diet", "vegan", "Choose what kind of health information this is."],
    ["sex", "other", "Choose female or male."],
    ["height", 29, "Enter a height in whole centimetres, from 30 to 250."],
    ["height", 170.5, "Enter a height in whole centimetres, from 30 to 250."],
    ["height", "170", "Enter a height in whole centimetres, from 30 to 250."],
    ["weight", 0, "Enter a weight in kilograms, from 1 to 400 (for example 72.5)."],
    ["weight", 72.55, "Enter a weight in kilograms, from 1 to 400 (for example 72.5)."],
    ["weight", null, "Enter a weight in kilograms, from 1 to 400 (for example 72.5)."],
    ["bloodType", "C+", "Choose a blood type, or \"I don't know\"."],
    ["pregnancy", "maybe", "Choose pregnant, not pregnant or not applicable."],
    ["smoking", "sometimes", "Choose never, former or current."],
    ["condition", "diabetes", "Choose a condition from the list, or Other."],
    ["condition", { code: "flu" }, "Choose a condition from the list, or Other."],
    ["condition", { code: "other", text: "  " }, "Enter the condition's name."],
    ["condition", { code: "other", text: "x".repeat(101) }, "Keep the condition to 100 characters or fewer."],
    ["allergy", { type: "pollen", name: "Birch" }, "Choose what the allergy is to: a medication, a food or something else."],
    ["allergy", { type: "other", name: "" }, "Enter what you are allergic to."],
    ["allergy", { type: "other", name: 42 }, "Keep the allergy's name to 100 characters or fewer."],
    ["allergy", { type: "other", name: "Latex", reaction: "x".repeat(201) }, "Keep the reaction note to 200 characters or fewer."],
  ];
  for (const [category, value, error] of cases) {
    const response = await addFact(cookie, category, value);
    assert.equal(response.status, 400, `${category} ${JSON.stringify(value)}`);
    assert.equal(response.body.error, error);
  }
  const height = (await addFact(cookie, "height", 170)).body.fact;
  assert.equal((await editFact(cookie, height.id, 300)).status, 400);
  assert.equal((await request("PUT", `/health-profile/facts/${height.id}`, { cookie, body: { value: 171, category: "weight" } })).body.fact.category, "height", "the category can't change");
  assert.equal(await HealthFact.countDocuments(), 1);
});

test("keeps at most 100 items per profile", async () => {
  const account = await user(); const cookie = token(account);
  await HealthFact.insertMany(Array.from({ length: 100 }, (_, i) => ({ owner: account._id, profileId: account._id, category: "allergy", value: { type: "other", name: `Thing ${i}`, reaction: "" } })));
  const response = await addFact(cookie, "allergy", { type: "food", name: "Eggs" });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "You can keep up to 100 items here. Remove the ones you no longer need first.");
});

test("shows the active medications (read only) and puts them in the summary", async () => {
  const account = await user("owner@example.test", { dateOfBirth: new Date(bornAgo(40)) }); const cookie = token(account);
  const base = { owner: account._id, profileId: account._id, startDate: new Date("2026-01-01") };
  await Medication.create({ ...base, name: "Metformin", dose: "500", unit: "mg", frequency: "Twice a day" });
  await Medication.create({ ...base, name: "Amoxicillin", status: "discontinued" });
  await addFact(cookie, "sex", "female");
  await addFact(cookie, "pregnancy", "pregnant");
  await addFact(cookie, "condition", { code: "high_blood_pressure" });
  const profile = (await getProfile(cookie)).body;
  assert.deepEqual(profile.medications.map((m) => m.name), ["Metformin"]);
  assert.deepEqual(Object.keys(profile.medications[0]).sort(), ["dose", "form", "frequency", "id", "name", "unit"]);
  assert.equal(profile.summary, [
    "Age: 40 years", "Sex assigned at birth: female", "Pregnancy: pregnant", "Long-term conditions: high blood pressure",
    "Allergies: none recorded", "Current medications: Metformin 500 mg, Twice a day",
  ].join("\n"));
  // The function triage will call gives exactly the summary the page shows.
  assert.equal(await getHealthSummary(account._id, account._id), profile.summary);
});

test("adds one factual water and sleep line only when something was logged recently", async () => {
  const account = await user(); const cookie = token(account);
  const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const mine = { owner: account._id, profileId: account._id };
  const drinks = (date, ml) => HydrationEntry.create({ ...mine, date: new Date(date), totalMl: ml, entries: [{ ml, at: new Date() }] });
  const night = (date, hours) => SleepEntry.create({ ...mine, date: new Date(date), hours, quality: 3 });
  const trackingLine = async (path = "/health-profile") => (await request("GET", path, { cookie })).body.summary.split("\n").find((line) => line.startsWith("Water and sleep"));

  // Old data, a goal on its own, and an undone day are not recent data.
  await drinks(day(-1), 1800); await night(day(-8), 4);
  await WellbeingSettings.create({ ...mine, waterGoal: { type: "atMost", ml: 1500 } });
  await HydrationEntry.create({ ...mine, date: new Date(day()), totalMl: 0, entries: [] });
  assert.equal((await getProfile(cookie)).body.summary, EMPTY_SUMMARY);

  await HydrationEntry.updateOne({ ...mine, date: new Date(day()) }, { $set: { totalMl: 1250, entries: [{ ml: 1250, at: new Date() }] } });
  assert.equal(await trackingLine(), "Water and sleep log: fluids today 1.3 L (daily goal set: stay under 1.5 L)");
  await night(day(-6), 6.5); await night(day(-2), 7.33); await night(day(), 8);
  assert.equal(await trackingLine(), "Water and sleep log: fluids today 1.3 L (daily goal set: stay under 1.5 L); average sleep over the last 7 days 7.3 hours (3 nights logged)");
  await WellbeingSettings.updateOne(mine, { $set: { waterGoal: { type: "atLeast", ml: 2000 } } });
  assert.match(await trackingLine(), /^Water and sleep log: fluids today 1\.3 L \(daily goal set: drink at least 2\.0 L\); /);
  await WellbeingSettings.updateOne(mine, { $set: { waterGoal: null } });
  assert.match(await trackingLine(), /^Water and sleep log: fluids today 1\.3 L; average sleep/);
  // The line comes last, after everything else, and the function triage will call gives the same summary.
  const summary = (await getProfile(cookie)).body.summary;
  assert.equal(summary.split("\n").at(-1), await trackingLine());
  assert.equal(await getHealthSummary(account._id, account._id), summary);

  // "Today" is the user's own date when the page sends it: yesterday there, the 1.8 L and 3 nights counted from then.
  assert.equal(await trackingLine(`/health-profile?date=${day(-1)}`), "Water and sleep log: fluids today 1.8 L; average sleep over the last 7 days 6.9 hours (2 nights logged)");
  assert.equal(await getHealthSummary(account._id, account._id, { today: new Date(day(-1)) }), (await request("GET", `/health-profile?date=${day(-1)}`, { cookie })).body.summary);
  // A date that isn't today anywhere is ignored.
  assert.equal(await trackingLine(`/health-profile?date=${day(-5)}`), await trackingLine());

  // Only sleep: just the sleep part. A dependent's data stays out of the owner's summary and vice versa.
  await HydrationEntry.deleteMany({});
  assert.equal(await trackingLine(), "Water and sleep log: average sleep over the last 7 days 7.3 hours (3 nights logged)");
  const childId = await dependent(cookie);
  assert.equal((await getProfile(cookie, childId)).body.summary.includes("Water and sleep"), false);
});

test("suggestions wait for review, are never in the summary, and can be confirmed or dismissed", async () => {
  const account = await user(); const cookie = token(account);
  await addFact(cookie, "bloodType", "unknown");
  await addFact(cookie, "condition", { code: "diabetes" });
  const bloodType = await suggest(account, "bloodType", "O+");
  const diabetes = await suggest(account, "condition", { code: "diabetes" });
  const thyroid = await suggest(account, "condition", { code: "thyroid_disease" });
  const anaemia = await suggest(account, "condition", { code: "other", text: "Anaemia" });

  let profile = (await getProfile(cookie)).body;
  assert.equal(profile.suggestions.length, 4);
  assert.deepEqual(profile.suggestions[0], {
    id: String(bloodType._id), profileId: "self", category: "bloodType", value: "O+", source: "lab_report", status: "suggested",
    recordedAt: bloodType.recordedAt.toISOString(), updatedAt: bloodType.updatedAt.toISOString(),
  });
  assert.equal(profile.facts.length, 2);
  assert.doesNotMatch(profile.summary, /thyroid|Anaemia/);

  // A suggestion is not a fact: it can't be edited or removed as one, only confirmed or dismissed.
  assert.equal((await editFact(cookie, String(thyroid._id), { code: "asthma" })).status, 404);
  assert.equal((await removeFact(cookie, String(thyroid._id))).status, 404);

  // Confirming a blood type replaces "I don't know".
  const confirmed = await confirm(cookie, String(bloodType._id));
  assert.equal(confirmed.status, 200);
  assert.deepEqual([confirmed.body.fact.value, confirmed.body.fact.status, confirmed.body.fact.source], ["O+", "confirmed", "lab_report"]);
  // Diabetes was already on the list: it stays once.
  assert.equal((await confirm(cookie, String(diabetes._id))).status, 200);
  assert.equal((await confirm(cookie, String(thyroid._id))).status, 200);
  assert.equal((await dismiss(cookie, String(anaemia._id))).status, 204);
  assert.equal((await dismiss(cookie, String(anaemia._id))).status, 404);
  assert.equal((await confirm(cookie, String(thyroid._id))).status, 404, "already confirmed");
  assert.equal((await confirm(cookie, confirmed.body.fact.id)).status, 404);

  profile = (await getProfile(cookie)).body;
  assert.deepEqual(profile.suggestions, []);
  assert.deepEqual(profile.facts.filter((f) => f.category === "bloodType").map((f) => f.value), ["O+"]);
  assert.equal(profile.facts.filter((f) => f.category === "condition").length, 2);
  assert.match(profile.summary, /^Long-term conditions: diabetes; thyroid disease$/m);
  assert.equal(await HealthFact.countDocuments({ "value.text": "Anaemia" }), 0);
});

test("a caregiver keeps a dependent's health information apart from their own", async () => {
  const account = await user(); const cookie = token(account);
  const childId = await dependent(cookie);
  await addFact(cookie, "allergy", { type: "food", name: "Milk" }, childId);
  await addFact(cookie, "sex", "female");
  await Medication.create({ owner: account._id, profileId: childId, name: "Ventolin", form: "inhaler", startDate: new Date("2026-01-01") });

  const child = (await getProfile(cookie, childId)).body;
  assert.deepEqual(child.facts.map((f) => [f.profileId, f.category]), [[childId, "allergy"]]);
  assert.deepEqual(child.medications.map((m) => m.name), ["Ventolin"]);
  assert.ok(child.age.years >= 11, "from the dependent's own date of birth (2015)");
  const own = (await getProfile(cookie)).body;
  assert.deepEqual(own.facts.map((f) => f.category), ["sex"]);
  assert.deepEqual(own.medications, []);

  // A fact is only reachable through its own profile.
  const milk = child.facts[0].id;
  assert.equal((await editFact(cookie, milk, { type: "food", name: "Oat" })).status, 404);
  assert.equal((await removeFact(cookie, milk)).status, 404);
  assert.equal((await editFact(cookie, milk, { type: "food", name: "Cow's milk" }, childId)).status, 200);
  assert.equal((await removeFact(cookie, milk, childId)).status, 204);
});

test("nobody can reach another user's health information or dependent", async () => {
  const parentAccount = await user(); const parent = token(parentAccount);
  const strangerAccount = await user("stranger@example.test"); const stranger = token(strangerAccount);
  const childId = await dependent(parent);
  const childFact = (await addFact(parent, "condition", { code: "epilepsy" }, childId)).body.fact.id;
  const ownFact = (await addFact(parent, "sex", "male")).body.fact.id;
  const childSuggestion = String((await suggest(parentAccount, "allergy", { type: "food", name: "Egg", reaction: "" }, childId))._id);
  const ownSuggestion = String((await suggest(parentAccount, "smoking", "never"))._id);

  // Through the parent's dependent (or a made-up profile): the profile itself is not found.
  for (const profileId of [childId, "000000000000000000000000", "not-an-id"]) {
    const attempts = [
      ["GET", "/health-profile", undefined], ["POST", "/health-profile/facts", { category: "sex", value: "male" }],
      ["PUT", `/health-profile/facts/${childFact}`, { value: { code: "asthma" } }], ["DELETE", `/health-profile/facts/${childFact}`, undefined],
      ["POST", `/health-profile/suggestions/${childSuggestion}/confirm`, undefined], ["POST", `/health-profile/suggestions/${childSuggestion}/dismiss`, undefined],
    ];
    for (const [method, path, body] of attempts) {
      const response = await request(method, withProfile(path, profileId), { cookie: stranger, body });
      assert.equal(response.status, 404, `${method} ${path} as ${profileId}`);
      assert.deepEqual(response.body, { error: "Profile not found." });
    }
  }
  // Through the stranger's own profile: the parent's facts and suggestions are not found.
  for (const id of [ownFact, childFact]) {
    assert.deepEqual((await editFact(stranger, id, "female")).body, { error: "Health information not found." });
    assert.equal((await removeFact(stranger, id)).status, 404);
  }
  for (const id of [ownSuggestion, childSuggestion]) {
    assert.deepEqual((await confirm(stranger, id)).body, { error: "Suggestion not found." });
    assert.equal((await dismiss(stranger, id)).status, 404);
  }
  assert.equal((await editFact(stranger, "not-an-id", "female")).status, 404);
  assert.deepEqual((await getProfile(stranger)).body.facts, []);

  assert.equal(await HealthFact.countDocuments({ owner: parentAccount._id }), 4, "nothing changed");
  assert.equal(await HealthFact.countDocuments({ owner: strangerAccount._id }), 0);
  assert.equal((await HealthFact.findById(ownFact)).value, "male");
});

test("never writes health values to the logs", async () => {
  const account = await user(); const cookie = token(account);
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { written.push(String(chunk)); return original.call(this, chunk, ...rest); };
  try {
    await addFact(cookie, "condition", { code: "other", text: "Privatecondition" });
    const allergy = (await addFact(cookie, "allergy", { type: "medication", name: "Privateallergen", reaction: "Privatereaction" })).body.fact;
    await editFact(cookie, allergy.id, { type: "medication", name: "Privateallergen2" });
    await addFact(cookie, "allergy", { type: "medication", name: "x".repeat(150) + "Privateinvalid" });
    await addFact(cookie, "bloodType", "AB-");
    const suggestion = await suggest(account, "condition", { code: "other", text: "Privatesuggestion" });
    await getProfile(cookie);
    await confirm(cookie, String(suggestion._id));
    await getProfile(cookie);
  } finally { process.stdout.write = original; }
  const logs = written.join("");
  assert.match(logs, /http_request/);
  for (const value of ["Private", "AB-", "\"value\"", "\"summary\"", "bloodType", "allergy", "condition"]) {
    assert.ok(!logs.includes(value), `log contains ${value}`);
  }
});

test("writes are rate-limited per account", async () => {
  const cookie = token(await user());
  for (let i = 0; i < 100; i++) assert.notEqual((await addFact(cookie, "sex", "invalid")).status, 429);
  const limited = await addFact(cookie, "sex", "female");
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /Too many changes/);
  assert.equal((await getProfile(cookie)).status, 200, "reading is not limited");
  assert.equal((await addFact(token(await user("second@example.test")), "sex", "female")).status, 201, "another account is not affected");
});

test("removing a dependent deletes their health information and suggestions, and nobody else's", async () => {
  const account = await user(); const cookie = token(account);
  const otherAccount = await user("other@example.test"); const other = token(otherAccount);
  const childId = await dependent(cookie, "Child");
  const siblingId = await dependent(cookie, "Sibling");
  for (const profileId of [childId, siblingId, undefined]) {
    await addFact(cookie, "allergy", { type: "food", name: "Milk" }, profileId);
    await suggest(account, "bloodType", "A+", profileId || account._id);
  }
  await addFact(other, "sex", "male");

  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie: other })).status, 404);
  assert.equal(await HealthFact.countDocuments({ profileId: childId }), 2);
  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie })).status, 204);
  assert.equal(await HealthFact.countDocuments({ profileId: childId }), 0);
  assert.equal(await HealthFact.countDocuments({ profileId: siblingId }), 2);
  assert.equal(await HealthFact.countDocuments({ profileId: account._id }), 2);
  assert.equal(await HealthFact.countDocuments({ owner: otherAccount._id }), 1);
  assert.equal((await getProfile(cookie, childId)).status, 404);
});

test("deleting the account deletes its own and every dependent's health information", async () => {
  const account = await user(); const cookie = token(account);
  const otherAccount = await user("other@example.test"); const other = token(otherAccount);
  const childId = await dependent(cookie);
  for (const profileId of [childId, undefined]) {
    await addFact(cookie, "condition", { code: "asthma" }, profileId);
    await suggest(account, "smoking", "never", profileId || account._id);
  }
  await addFact(other, "condition", { code: "asthma" });
  assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } })).status, 204);
  assert.equal(await HealthFact.countDocuments({ owner: account._id }), 0);
  assert.equal(await HealthFact.countDocuments({ owner: otherAccount._id }), 1);
});

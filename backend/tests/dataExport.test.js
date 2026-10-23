// Download my data (story #72): the export registry, what the file contains and leaves out, confirmation, rate limit,
// email and logs.
const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const CareCircle = require("../src/models/CareCircle");
const Provider = require("../src/models/Provider");
const Medication = require("../src/models/Medication");
const MedicationAdherence = require("../src/models/MedicationAdherence");
const HealthFact = require("../src/models/HealthFact");
const SymptomRecord = require("../src/models/SymptomRecord");
const Appointment = require("../src/models/Appointment");
const ReportConversation = require("../src/models/ReportConversation");
const Notification = require("../src/models/Notification");
const { HydrationEntry, SleepEntry, WellbeingSettings } = require("../src/models/Wellbeing");
const { PROFILE_MODELS } = require("../src/profileData");
const { EXPORTED, PROFILE_COLLECTIONS, EXCLUDED_MODELS, COMMON_OMIT, FORMAT_VERSION } = require("../src/dataExport");
const { EXPORTS_PER_HOUR, CONFIRM_COOKIE } = require("../src/routes/account");

let mongod, server, base, passwordHash;
const password = "Data export test password 123!";
const sent = [];
const logs = [];
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  Object.assign(process.env, { SMTP_HOST: "smtp.example.test", SMTP_USER: "nabad", SMTP_PASS: "smtp-password", EMAIL_FROM: "nabad@example.test" });
  mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => { sent.push(message); } }));
  const write = process.stdout.write.bind(process.stdout);
  mock.method(process.stdout, "write", (chunk, ...rest) => {
    if (typeof chunk === "string" && chunk.startsWith("{\"time\"")) { logs.push(chunk); return true; }
    return write(chunk, ...rest);
  });
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  passwordHash = await bcrypt.hash(password, 12);
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => {
  mock.restoreAll();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => {
  sent.length = 0;
  logs.length = 0;
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).deleteMany({})));
});

let counter = 0;
async function account(name, fields = {}) {
  counter += 1;
  const user = await User.create({ name, email: `${name.toLowerCase()}-${counter}@example.test`, passwordHash, ...fields });
  return session(user);
}
// A signed-in session. sessionStart tells sessions apart.
function session(user, sessionStart = Date.now()) {
  return { user, cookies: { accessToken: jwt.sign({ sub: String(user._id), ver: 0, sst: Math.floor(sessionStart / 1000) }, process.env.JWT_SECRET, { expiresIn: "15m" }) } };
}
async function request(method, url, who, body) {
  const cookie = who ? Object.entries(who.cookies).map(([name, value]) => `${name}=${value}`).join("; ") : undefined;
  const response = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Keeps the cookies the server sets, like a browser.
  for (const header of response.headers.getSetCookie()) {
    const [, name, value] = /^([^=]+)=([^;]*)/.exec(header);
    if (who && value) who.cookies[name] = value;
    else if (who) delete who.cookies[name];
  }
  const text = await response.text();
  return { status: response.status, headers: response.headers, text, body: text ? JSON.parse(text) : null };
}
const confirm = (who, body = { password }) => request("POST", "/account/export/confirm", who, body);
async function download(who) {
  assert.equal((await confirm(who)).status, 204);
  const res = await request("GET", "/account/export", who);
  assert.equal(res.status, 200, res.text);
  return res;
}

// One record in every per-profile collection, with text that names the profile.
async function fillProfile(owner, profileId, label) {
  const ids = { owner, profileId };
  const medication = await Medication.create({ ...ids, name: `${label} medication`, dose: "5", unit: "mg", startDate: new Date("2026-01-02") });
  await MedicationAdherence.create({ ...ids, medicationId: medication._id, date: "2026-10-20" });
  await HealthFact.create({ ...ids, category: "allergy", value: { name: `${label} allergy` } });
  await HydrationEntry.create({ ...ids, date: new Date("2026-10-20T00:00:00Z"), totalMl: 250, entries: [{ ml: 250, at: new Date() }] });
  await SleepEntry.create({ ...ids, date: new Date("2026-10-21T00:00:00Z"), hours: 7.5, quality: 4, note: `${label} sleep` });
  await WellbeingSettings.create({ ...ids, waterGoal: { type: "atLeast", ml: 2000 } });
  await SymptomRecord.create({ ...ids, description: `${label} symptoms`, urgencyResult: { level: "routine" }, conversation: [{ role: "patient", content: `${label} said` }] });
  await Appointment.create({ ...ids, title: `${label} appointment`, hospital: "AUBMC", appointmentDate: "2026-11-01", appointmentTime: "09:30" });
  await ReportConversation.create({ ...ids, title: `${label} chat`, messages: [{ role: "user", content: `${label} question` }] });
  await Notification.create({ ...ids, type: "system", title: `${label} notice`, message: "Hello", dedupeKey: `dedupe-${label}-${crypto.randomUUID()}` });
}

// --- The registry ---

test("every model is in the export registry or excluded with a reason", () => {
  const modelsDir = path.join(__dirname, "../src/models");
  for (const file of fs.readdirSync(modelsDir)) require(path.join(modelsDir, file));
  const exported = new Set(EXPORTED.map(({ model }) => model.modelName));
  for (const name of mongoose.modelNames()) {
    const reason = EXCLUDED_MODELS[name];
    assert.ok(exported.has(name) || (typeof reason === "string" && reason.length > 10), `Model ${name} stores data but is neither in the export registry (src/dataExport.js) nor in EXCLUDED_MODELS with a reason.`);
    assert.ok(!(exported.has(name) && reason), `Model ${name} is both exported and excluded.`);
  }
  // An excluded model must not hold anything about an account.
  for (const name of Object.keys(EXCLUDED_MODELS)) {
    const schema = mongoose.model(name).schema;
    for (const [field, type] of Object.entries(schema.paths)) {
      assert.ok(!["owner", "profileId", "user", "userId"].includes(field) && type.options?.ref !== "User", `Excluded model ${name} has ${field}, which belongs to an account: export it instead.`);
    }
  }
});

test("every field of an exported model is exported or omitted with a reason", () => {
  for (const entry of EXPORTED) {
    const name = entry.model.modelName;
    const fields = new Set(Object.keys(entry.model.schema.paths).map((field) => field.split(".")[0]));
    const omit = { ...COMMON_OMIT, ...entry.omit };
    for (const field of fields) {
      assert.ok(field in entry.fields || field in omit, `${name}.${field} is neither exported nor omitted with a reason in src/dataExport.js.`);
      assert.ok(!(field in entry.fields && field in omit), `${name}.${field} is both exported and omitted.`);
    }
    for (const field of [...Object.keys(entry.fields), ...Object.keys(entry.omit || {})]) assert.ok(fields.has(field), `${name}.${field} is in the registry but not in the model.`);
    for (const reason of Object.values(entry.omit || {})) assert.ok(typeof reason === "string" && reason.length > 5);
  }
});

test("every kind of per-profile health data is exported", () => {
  const exported = PROFILE_COLLECTIONS.map(({ model }) => model);
  for (const Model of PROFILE_MODELS) assert.ok(exported.includes(Model), `${Model.modelName} is deleted with a profile but not exported.`);
});

// --- What the file contains ---

test("the file has every registered collection for the user's own and linked profiles", async () => {
  const provider = await Provider.create({ slug: "aubmc", name: "AUBMC", type: "hospital", sources: ["test"], verifiedAt: new Date() });
  const rana = await account("Rana", { phone: "+96171123456", dateOfBirth: new Date("1990-05-04"), emergencyContact: { name: "Sami", phone: "71123456" }, favoriteProviders: [provider.slug], mutedNotificationTypes: ["system"] });
  const child = await LinkedProfile.create({ owner: rana.user._id, fullName: "Lina", dateOfBirth: new Date("2018-03-02"), relationship: "child", emergencyContact: { name: "Rana", phone: "71123456" } });
  await fillProfile(rana.user._id, rana.user._id, "Own");
  await fillProfile(rana.user._id, child._id, "Child");

  const { body: data } = await download(rana);
  assert.equal(data.formatVersion, FORMAT_VERSION);
  assert.ok(!Number.isNaN(Date.parse(data.exportedAt)));
  // Confirming with the password can upgrade its hash, which changes updatedAt.
  const { updatedAt, ...details } = data.account;
  assert.ok(!Number.isNaN(Date.parse(updatedAt)));
  assert.deepEqual(details, {
    name: "Rana", email: rana.user.email, phone: "+96171123456", dateOfBirth: "1990-05-04", signInMethod: "password", emailVerified: false,
    profilePicture: "", createdAt: rana.user.createdAt.toISOString(),
  });
  assert.deepEqual(data.emergencyContact, { name: "Sami", phone: "71123456" });
  assert.deepEqual(data.favoriteProviders, [{ id: "aubmc", name: "AUBMC" }]);
  assert.deepEqual(data.notificationPreferences.find(({ type }) => type === "system"), { type: "system", enabled: false });

  assert.deepEqual(data.profiles.map(({ profile }) => profile.id), ["self", String(child._id)]);
  const [own, linked] = data.profiles;
  assert.equal(own.profile.fullName, "Rana");
  assert.equal(linked.profile.fullName, "Lina");
  assert.equal(linked.profile.dateOfBirth, "2018-03-02");
  assert.deepEqual(linked.profile.emergencyContact, { name: "Rana", phone: "71123456" });
  for (const [entry, label] of [[own, "Own"], [linked, "Child"]]) {
    for (const { key, single } of PROFILE_COLLECTIONS) {
      if (single) assert.ok(entry[key], `${label}: ${key} is missing`);
      else assert.equal(entry[key].length, 1, `${label}: ${key} should have one record`);
    }
    assert.equal(entry.medications[0].name, `${label} medication`);
    assert.equal(entry.medicationCheckIns[0].medicationId, entry.medications[0].id);
    assert.deepEqual(entry.myHealthFacts[0].value, { name: `${label} allergy` });
    assert.equal(entry.waterEntries[0].date, "2026-10-20");
    assert.equal(entry.waterEntries[0].drinks[0].ml, 250);
    assert.equal(entry.sleepEntries[0].note, `${label} sleep`);
    assert.deepEqual(entry.waterAndSleepGoals.waterGoal, { type: "atLeast", ml: 2000 });
    assert.equal(entry.symptomRecords[0].description, `${label} symptoms`);
    assert.equal(entry.symptomRecords[0].conversation[0].content, `${label} said`);
    assert.equal(entry.appointments[0].date, "2026-11-01");
    assert.equal(entry.healthAssistantConversations[0].messages[0].content, `${label} question`);
    assert.equal(entry.notifications[0].title, `${label} notice`);
  }
});

test("the care circle lists the people invited with names and emails, and the circles joined with the inviter's name only", async () => {
  const rana = await account("Rana");
  const karim = await account("Karim");
  const nour = await account("Nour", { phone: "+96170999888" });
  await CareCircle.create({ inviter: rana.user._id, member: karim.user._id, status: "active", inviteEmail: karim.user.email, acceptedAt: new Date() });
  await CareCircle.create({ inviter: rana.user._id, status: "pending", inviteEmail: "friend@example.test", inviteTokenHash: "a".repeat(64), expiresAt: new Date(Date.now() + 60000) });
  await CareCircle.create({ inviter: nour.user._id, member: rana.user._id, status: "active", inviteEmail: rana.user.email, acceptedAt: new Date() });

  const { body: data, text } = await download(rana);
  const [member, pending] = data.careCircle.peopleIInvited;
  assert.equal(member.status, "active");
  assert.deepEqual(member.member, { name: "Karim", email: karim.user.email });
  assert.ok(member.joinedAt);
  assert.equal(pending.status, "pending");
  assert.equal(pending.invitedEmail, "friend@example.test");
  assert.equal(pending.member, null);
  assert.deepEqual(Object.keys(data.careCircle.circlesIBelongTo[0]), ["invitedBy", "joinedAt"]);
  assert.equal(data.careCircle.circlesIBelongTo[0].invitedBy, "Nour");
  assert.ok(!text.includes(nour.user.email) && !text.includes("+96170999888"), "nothing of the inviter's but their name");
});

test("other users' data never appears", async () => {
  const rana = await account("Rana");
  const other = await account("Other", { phone: "+96176555444", emergencyContact: { name: "OtherContact", phone: "76555444" } });
  const otherChild = await LinkedProfile.create({ owner: other.user._id, fullName: "OtherChild", dateOfBirth: new Date("2015-01-01"), relationship: "child" });
  await fillProfile(other.user._id, other.user._id, "OTHERUSER");
  await fillProfile(other.user._id, otherChild._id, "OTHERCHILD");
  // Even a record of another account filed under Rana's profile id is never hers.
  await Medication.create({ owner: other.user._id, profileId: rana.user._id, name: "OTHERMISFILED", startDate: new Date() });
  // Rana is in Other's care circle.
  await CareCircle.create({ inviter: other.user._id, member: rana.user._id, status: "active", inviteEmail: rana.user.email, acceptedAt: new Date() });
  await fillProfile(rana.user._id, rana.user._id, "Rana");

  const { body: data, text } = await download(rana);
  for (const marker of ["OTHERUSER", "OTHERCHILD", "OtherChild", "OTHERMISFILED", "OtherContact", other.user.email, "+96176555444", String(other.user._id), String(otherChild._id)]) {
    assert.ok(!text.includes(marker), `the export contains ${marker}`);
  }
  assert.equal(data.profiles.length, 1);
  assert.equal(data.careCircle.circlesIBelongTo[0].invitedBy, "Other");
});

test("secrets and internals never appear", async () => {
  const secrets = {
    googleId: "google-subject-1234567890",
    emailVerifyTokenHash: crypto.randomBytes(32).toString("hex"),
    resetPasswordTokenHash: crypto.randomBytes(32).toString("hex"),
    twoFactorEnabled: true,
    twoFactorCodeHash: crypto.randomBytes(32).toString("hex"),
    trustedDevices: [{ tokenHash: crypto.randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 86400000) }],
  };
  const rana = await account("Rana", secrets);
  const inviteTokenHash = crypto.randomBytes(32).toString("hex");
  await CareCircle.create({ inviter: rana.user._id, status: "pending", inviteEmail: "friend@example.test", inviteTokenHash, expiresAt: new Date(Date.now() + 60000) });
  await Notification.create({ owner: rana.user._id, profileId: rana.user._id, type: "system", title: "Hi", message: "Hello", dedupeKey: "dedupe-secret-key-123" });

  const { text } = await download(rana);
  for (const value of [passwordHash, secrets.googleId, secrets.emailVerifyTokenHash, secrets.resetPasswordTokenHash, secrets.twoFactorCodeHash, secrets.trustedDevices[0].tokenHash, inviteTokenHash, "dedupe-secret-key-123", rana.cookies.accessToken]) {
    assert.ok(!text.includes(value), "a secret is in the export");
  }
  for (const key of ["passwordHash", "googleId", "authVersion", "twoFactor", "trustedDevices", "TokenHash", "tokenHash", "failedLoginAttempts", "lockUntil", "dedupeKey", "__v", "\"owner\""]) {
    assert.ok(!text.includes(key), `the export contains ${key}`);
  }
});

// --- Confirmation, headers, rate limit, email and logs ---

test("the download needs a fresh confirmation from this session, used once", async () => {
  const rana = await account("Rana");
  assert.equal((await request("GET", "/account/export", null)).status, 401);
  const missing = await request("GET", "/account/export", rana);
  assert.equal(missing.status, 403);
  assert.equal(missing.body.confirmRequired, true);

  assert.equal((await confirm(rana, { password: "wrong password" })).status, 400);
  assert.equal((await confirm(rana, {})).status, 400);
  assert.ok(!rana.cookies[CONFIRM_COOKIE]);
  assert.equal((await request("GET", "/account/export", rana)).status, 403);

  const confirmed = await confirm(rana);
  assert.equal(confirmed.status, 204);
  const setCookie = confirmed.headers.getSetCookie().find((cookie) => cookie.startsWith(CONFIRM_COOKIE));
  assert.match(setCookie, /; HttpOnly/i);
  assert.match(setCookie, /; Path=\/api\/account\/export/i);
  // The confirmation is for this session only.
  const otherSession = session(rana.user, Date.now() - 60 * 60 * 1000);
  otherSession.cookies[CONFIRM_COOKIE] = rana.cookies[CONFIRM_COOKIE];
  assert.equal((await request("GET", "/account/export", otherSession)).status, 403);

  const res = await request("GET", "/account/export", rana);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition"), /^attachment; filename="nabad-data-\d{4}-\d{2}-\d{2}\.json"$/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("content-type"), /^application\/json/);
  // One download per confirmation.
  assert.ok(!rana.cookies[CONFIRM_COOKIE]);
  assert.equal((await request("GET", "/account/export", rana)).status, 403);
});

test("an expired confirmation or one for another account is refused", async () => {
  const rana = await account("Rana");
  const karim = await account("Karim");
  const sst = Math.floor(jwt.decode(rana.cookies.accessToken).sst);
  rana.cookies[CONFIRM_COOKIE] = jwt.sign({ sub: String(rana.user._id), purpose: "data_export", ver: 0, sst, exp: Math.floor(Date.now() / 1000) - 1 }, process.env.JWT_SECRET);
  assert.equal((await request("GET", "/account/export", rana)).status, 403);
  await confirm(karim);
  rana.cookies[CONFIRM_COOKIE] = karim.cookies[CONFIRM_COOKIE];
  assert.equal((await request("GET", "/account/export", rana)).status, 403);
  // A confirmation is not a session.
  assert.equal((await request("GET", "/profile/me", { cookies: { accessToken: karim.cookies[CONFIRM_COOKIE] } })).status, 401);
});

test("Google-only accounts confirm with their email", async () => {
  const google = await account("Maya", { authProvider: "google", googleId: "google-maya" });
  assert.equal((await confirm(google, { email: "someone@example.test" })).status, 400);
  assert.equal((await confirm(google, { password })).status, 400);
  assert.equal((await confirm(google, { email: ` ${google.user.email.toUpperCase()} ` })).status, 204);
  const res = await request("GET", "/account/export", google);
  assert.equal(res.status, 200);
  assert.equal(res.body.account.signInMethod, "google");
});

test(`at most ${EXPORTS_PER_HOUR} downloads an hour per account`, async () => {
  const rana = await account("Rana");
  for (let i = 0; i < EXPORTS_PER_HOUR; i += 1) await download(rana);
  assert.equal((await confirm(rana)).status, 204);
  const limited = await request("GET", "/account/export", rana);
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /3 times an hour/);
  // Another account is not affected.
  await download(await account("Karim"));
});

test("the user is emailed after a download, and only the event and its size are logged", async () => {
  const rana = await account("Rana");
  await fillProfile(rana.user._id, rana.user._id, "LOGMARKER");
  const res = await download(rana);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, rana.user.email);
  assert.match(sent[0].text, /^A copy of your Nabad data was downloaded\. If this wasn't you, change your password\./);
  assert.ok(!sent[0].text.includes("LOGMARKER"));

  const exported = logs.map((line) => JSON.parse(line)).filter((entry) => entry.event === "data_exported");
  assert.equal(exported.length, 1);
  assert.equal(exported[0].bytes, Buffer.byteLength(res.text, "utf8"));
  assert.ok(logs.every((line) => !line.includes("LOGMARKER") && !line.includes(rana.user.email)));
  // A refused download sends nothing.
  sent.length = 0;
  await request("GET", "/account/export", rana);
  assert.equal(sent.length, 0);
});

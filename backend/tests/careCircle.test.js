// Care circle (story #76): invitations, membership, account deletion and the alerts after urgent symptom checks.
const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const Notification = require("../src/models/Notification");
const CareCircle = require("../src/models/CareCircle");
const { alertCareCircle } = require("../src/careCircle");

let mongod, server, base, passwordHash;
const password = "Care circle test password 123!";
const sent = [];
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  Object.assign(process.env, { SMTP_HOST: "smtp.example.test", SMTP_USER: "nabad", SMTP_PASS: "smtp-password", EMAIL_FROM: "nabad@example.test" });
  for (const key of ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"]) delete process.env[key];
  mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => { sent.push(message); } }));
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), Notification.init(), CareCircle.init()]);
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
  await Promise.all([User.deleteMany({}), LinkedProfile.deleteMany({}), Notification.deleteMany({}), CareCircle.deleteMany({})]);
});

let counter = 0;
async function account(name, fields = {}) {
  counter += 1;
  const user = await User.create({ name, email: `${name.toLowerCase()}-${counter}@example.test`, passwordHash, ...fields });
  return { user, cookie: jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }) };
}
async function request(method, path, { body, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const lastToken = () => /accept\?token=([a-f0-9]{64})/.exec(sent.at(-1).text)[1];
async function invite(from, email) {
  const res = await request("POST", "/care-circle/invites", { cookie: from.cookie, body: { email } });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  return lastToken();
}
// Rana invites Karim, and Karim accepts.
async function circle({ inviterFields } = {}) {
  const rana = await account("Rana", inviterFields);
  const karim = await account("Karim");
  const token = await invite(rana, karim.user.email);
  assert.equal((await request("POST", "/care-circle/invites/accept", { cookie: karim.cookie, body: { token } })).status, 200);
  sent.length = 0;
  return { rana, karim };
}
const check = (who, body, profileId = "self") => request("POST", `/triage/ai-assess?profileId=${profileId}`, { cookie: who.cookie, body });
const EMERGENCY = "my father can't breathe";
const URGENT = "I fell and hit my head";
async function eventually(condition) {
  for (let i = 0; i < 100; i += 1) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("condition was never met");
}
async function settle() { await new Promise((resolve) => setTimeout(resolve, 300)); }
function captureLogs() {
  const lines = [];
  const write = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { lines.push(String(chunk)); return write.call(this, chunk, ...rest); };
  return { output: () => lines.join(""), stop: () => { process.stdout.write = write; } };
}

test("every care circle route needs sign-in, except looking up an invitation", async () => {
  const id = "000000000000000000000000";
  for (const [method, path] of [["GET", ""], ["POST", "/invites"], ["POST", "/invites/accept"], ["DELETE", `/invites/${id}`], ["DELETE", `/members/${id}`], ["DELETE", `/circles/${id}`]]) {
    assert.equal((await request(method, `/care-circle${path}`, { body: method === "POST" ? {} : undefined })).status, 401, `${method} ${path}`);
  }
  assert.equal((await request("POST", "/care-circle/invites/lookup", { body: { token: "f".repeat(64) } })).status, 400);
});

test("an invitation emails a one-time link and stores only a hash of its token, with a 7-day expiry", async () => {
  const rana = await account("Rana");
  const before = Date.now();
  const res = await request("POST", "/care-circle/invites", { cookie: rana.cookie, body: { email: "  Karim@Example.TEST " } });
  assert.equal(res.status, 202);
  assert.equal(res.body.invite.email, "karim@example.test");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "karim@example.test");
  assert.match(sent[0].subject, /Rana invited you/);
  assert.match(sent[0].text, /never see symptoms or health details/);
  const token = lastToken();
  const stored = await CareCircle.findOne({ inviter: rana.user._id }).lean();
  assert.equal(stored.status, "pending");
  assert.notEqual(stored.inviteTokenHash, token);
  assert.equal(stored.inviteTokenHash, crypto.createHash("sha256").update(token).digest("hex"));
  const days = (stored.expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
  assert.ok(days > 6.99 && days < 7.01, `expires in ${days} days`);
  const lookup = await request("POST", "/care-circle/invites/lookup", { body: { token } });
  assert.deepEqual([lookup.status, lookup.body.invite.inviterName, lookup.body.invite.email], [200, "Rana", "karim@example.test"]);
  const indexes = await CareCircle.collection.indexes();
  assert.equal(indexes.find((index) => index.key.expiresAt).expireAfterSeconds, 0);
});

test("the invite answer is the same whether or not the email has a Nabad account", async () => {
  const rana = await account("Rana");
  const karim = await account("Karim");
  const known = await request("POST", "/care-circle/invites", { cookie: rana.cookie, body: { email: karim.user.email } });
  const unknown = await request("POST", "/care-circle/invites", { cookie: rana.cookie, body: { email: "nobody-here@example.test" } });
  assert.equal(known.status, unknown.status);
  assert.deepEqual(Object.keys(known.body).sort(), Object.keys(unknown.body).sort());
  assert.deepEqual(Object.keys(known.body.invite).sort(), Object.keys(unknown.body.invite).sort());
  assert.equal(known.body.message.replace(karim.user.email, "EMAIL"), unknown.body.message.replace("nobody-here@example.test", "EMAIL"));
  assert.equal(sent.length, 2, "an email is sent either way");
});

test("only the invited email can accept, and each link works once", async () => {
  const rana = await account("Rana");
  const karim = await account("Karim");
  const stranger = await account("Stranger");
  const token = await invite(rana, karim.user.email);

  const wrong = await request("POST", "/care-circle/invites/accept", { cookie: stranger.cookie, body: { token } });
  assert.equal(wrong.status, 403);
  assert.match(wrong.body.error, /Sign in with that email/);
  assert.equal((await request("POST", "/care-circle/invites/accept", { cookie: rana.cookie, body: { token } })).status, 400, "not your own invitation");
  assert.equal((await request("POST", "/care-circle/invites/accept", { body: { token } })).status, 401);

  const ok = await request("POST", "/care-circle/invites/accept", { cookie: karim.cookie, body: { token } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.circle.name, "Rana");
  const stored = await CareCircle.findOne({ inviter: rana.user._id }).lean();
  assert.deepEqual([stored.status, String(stored.member), stored.inviteTokenHash, stored.expiresAt], ["active", String(karim.user._id), undefined, undefined]);

  const reused = await request("POST", "/care-circle/invites/accept", { cookie: karim.cookie, body: { token } });
  assert.equal(reused.status, 400);
  assert.match(reused.body.error, /already been used/);
  assert.equal((await request("POST", "/care-circle/invites/lookup", { body: { token } })).status, 400);
  // Rana is told that Karim joined.
  const joined = await Notification.findOne({ owner: rana.user._id });
  assert.deepEqual([joined.type, joined.message], ["system", "Karim joined your care circle."]);
});

test("an expired invitation can't be accepted, and inviting again sends a new link that replaces the old one", async () => {
  const rana = await account("Rana");
  const karim = await account("Karim");
  const first = await invite(rana, karim.user.email);
  await CareCircle.updateOne({ inviter: rana.user._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const expired = await request("POST", "/care-circle/invites/accept", { cookie: karim.cookie, body: { token: first } });
  assert.equal(expired.status, 400);
  assert.match(expired.body.error, /expired/);
  assert.equal((await request("GET", "/care-circle", { cookie: rana.cookie })).body.pending.length, 0, "expired invitations aren't listed");

  const second = await invite(rana, karim.user.email);
  assert.equal(await CareCircle.countDocuments({ inviter: rana.user._id }), 1);
  assert.equal((await request("POST", "/care-circle/invites/accept", { cookie: karim.cookie, body: { token: first } })).status, 400, "the old link no longer works");
  assert.equal((await request("POST", "/care-circle/invites/accept", { cookie: karim.cookie, body: { token: second } })).status, 200);
});

test("invitations are validated, limited to 5 people per circle, and rate limited", async () => {
  const rana = await account("Rana");
  assert.equal((await request("POST", "/care-circle/invites", { cookie: rana.cookie, body: { email: "not-an-email" } })).status, 400);
  assert.equal((await request("POST", "/care-circle/invites", { cookie: rana.cookie, body: { email: rana.user.email } })).status, 400);
  for (let i = 1; i <= 5; i += 1) await invite(rana, `person${i}@example.test`);
  const full = await request("POST", "/care-circle/invites", { cookie: rana.cookie, body: { email: "person6@example.test" } });
  assert.equal(full.status, 400);
  assert.match(full.body.error, /up to 5 people/);
  // Re-sending to someone already invited is still allowed.
  await invite(rana, "person1@example.test");

  const other = await account("Other");
  const statuses = [];
  for (let i = 0; i < 11; i += 1) {
    statuses.push((await request("POST", "/care-circle/invites", { cookie: other.cookie, body: { email: "same-person@example.test" } })).status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(202));
  assert.equal(statuses[10], 429);
});

test("the inviter lists, cancels and removes; a member lists and leaves; nobody touches another's circle", async () => {
  const { rana, karim } = await circle();
  await invite(rana, "pending@example.test");
  const ranaView = (await request("GET", "/care-circle", { cookie: rana.cookie })).body;
  assert.deepEqual(ranaView.members.map((m) => [m.name, m.email]), [["Karim", karim.user.email]]);
  assert.deepEqual(ranaView.pending.map((p) => p.email), ["pending@example.test"]);
  assert.equal(ranaView.maxMembers, 5);
  const karimView = (await request("GET", "/care-circle", { cookie: karim.cookie })).body;
  assert.deepEqual(karimView.circles.map((c) => c.name), ["Rana"]);
  assert.deepEqual([karimView.members, karimView.pending], [[], []]);

  // Wrong kind or wrong person: 404.
  const outsider = await account("Outsider");
  const memberId = ranaView.members[0].id;
  const inviteId = ranaView.pending[0].id;
  assert.equal((await request("DELETE", `/care-circle/members/${memberId}`, { cookie: outsider.cookie })).status, 404);
  assert.equal((await request("DELETE", `/care-circle/circles/${memberId}`, { cookie: outsider.cookie })).status, 404);
  assert.equal((await request("DELETE", `/care-circle/invites/${inviteId}`, { cookie: karim.cookie })).status, 404);
  assert.equal((await request("DELETE", `/care-circle/invites/${memberId}`, { cookie: rana.cookie })).status, 404, "a member isn't an invitation");
  assert.equal((await request("DELETE", "/care-circle/members/not-an-id", { cookie: rana.cookie })).status, 404);

  assert.equal((await request("DELETE", `/care-circle/invites/${inviteId}`, { cookie: rana.cookie })).status, 204);
  assert.equal((await request("DELETE", `/care-circle/circles/${memberId}`, { cookie: karim.cookie })).status, 204);
  assert.equal(await CareCircle.countDocuments({}), 0);

  const again = await circle();
  const id = (await request("GET", "/care-circle", { cookie: again.rana.cookie })).body.members[0].id;
  assert.equal((await request("DELETE", `/care-circle/members/${id}`, { cookie: again.rana.cookie })).status, 204);
  assert.deepEqual((await request("GET", "/care-circle", { cookie: again.karim.cookie })).body.circles, []);
});

test("deleting either account removes its care circle relationships", async () => {
  const { rana, karim } = await circle();
  const nour = await account("Nour");
  const token = await invite(nour, karim.user.email);
  await request("POST", "/care-circle/invites/accept", { cookie: karim.cookie, body: { token } });
  await invite(karim, "someone@example.test");
  assert.equal(await CareCircle.countDocuments({}), 3);

  const deleted = await request("DELETE", "/profile/me", { cookie: karim.cookie, body: { confirm: "DELETE", password } });
  assert.equal(deleted.status, 204);
  assert.equal(await CareCircle.countDocuments({}), 0);

  const second = await circle();
  assert.equal((await request("DELETE", "/profile/me", { cookie: second.rana.cookie, body: { confirm: "DELETE", password } })).status, 204);
  assert.equal(await CareCircle.countDocuments({}), 0);
});

test("an emergency check alerts every active member in the app and by email, with only the name, level and phone", async () => {
  const { rana, karim } = await circle({ inviterFields: { phone: "+96170123456" } });
  const layla = await account("Layla");
  await request("POST", "/care-circle/invites/accept", { cookie: layla.cookie, body: { token: await invite(rana, layla.user.email) } });
  await invite(rana, "pending-member@example.test");
  sent.length = 0;

  const res = await check(rana, { symptoms: EMERGENCY, checkId: "check-emergency-1" });
  assert.equal(res.body.level, "emergency");
  await eventually(async () => (await Notification.countDocuments({ type: "caregiver_urgent" })) === 2 && sent.length === 2);
  const alerts = await Notification.find({ type: "caregiver_urgent" }).lean();
  assert.deepEqual(alerts.map((a) => String(a.owner)).sort(), [String(karim.user._id), String(layla.user._id)].sort());
  for (const alert of alerts) {
    assert.equal(alert.title, "Care circle alert");
    assert.equal(alert.message, "Rana's symptom check needs attention (emergency).");
    assert.equal(alert.phone, "+96170123456");
    assert.equal(String(alert.profileId), String(alert.owner));
  }
  assert.deepEqual(sent.map((m) => m.to).sort(), [karim.user.email, layla.user.email].sort());
  assert.match(sent[0].text, /Rana's symptom check needs attention \(emergency\)/);
  assert.match(sent[0].text, /call Rana on \+96170123456/);
  assert.match(sent[0].text, /http:\/\/localhost:3000\/notifications/);
  // Karim's bell shows it, with the number to call.
  const list = await request("GET", "/notifications", { cookie: karim.cookie });
  assert.equal(list.body.notifications[0].phone, "+96170123456");
  assert.equal(list.body.notifications[0].type, "caregiver_urgent");
});

test("urgent checks alert too, and a linked profile's check names that person", async () => {
  const { rana, karim } = await circle();
  const sami = await request("POST", "/profile/linked", { cookie: rana.cookie, body: { fullName: "Sami", dateOfBirth: "2015-06-01", relationship: "child" } });
  const res = await check(rana, { symptoms: URGENT, checkId: "check-urgent-sami" }, sami.body.profile.id);
  assert.equal(res.body.level, "urgent");
  await eventually(async () => (await Notification.countDocuments({ owner: karim.user._id, type: "caregiver_urgent" })) === 1);
  const alert = await Notification.findOne({ owner: karim.user._id, type: "caregiver_urgent" });
  assert.equal(alert.message, "Sami's symptom check needs attention (urgent), from Rana's account.");
  assert.equal(alert.phone, "", "no phone saved, so no Call button");
  await eventually(async () => sent.length === 1);
  assert.doesNotMatch(sent[0].text, /call Rana on/);
});

test("routine and soon results alert nobody, and only active members are alerted", async () => {
  const { rana } = await circle();
  const pendingOnly = await account("Pending");
  await invite(rana, pendingOnly.user.email);
  for (const symptoms of ["a rash on my arm", "runny nose", "a headache today"]) {
    const res = await check(rana, { symptoms, checkId: `check-${symptoms.length}-calm` });
    assert.ok(["routine", "soon"].includes(res.body.level), `${symptoms}: ${res.body.level}`);
  }
  await settle();
  assert.equal(await Notification.countDocuments({ type: "caregiver_urgent" }), 0);

  await check(rana, { symptoms: EMERGENCY, checkId: "check-active-only" });
  await eventually(async () => (await Notification.countDocuments({ type: "caregiver_urgent" })) === 1);
  assert.equal(await Notification.countDocuments({ owner: pendingOnly.user._id }), 0, "a pending invitee is never alerted");

  // A member of someone else's circle (here Rana is Karim's caregiver, not the other way) isn't alerted about Rana.
  const other = await circle();
  await check(other.karim, { symptoms: EMERGENCY, checkId: "check-reverse" });
  await settle();
  assert.equal(await Notification.countDocuments({ owner: other.rana.user._id, type: "caregiver_urgent" }), 0);
});

test("one alert per check: the same check and its follow-up answers alert once", async () => {
  const { rana, karim } = await circle();
  await check(rana, { symptoms: EMERGENCY, checkId: "check-dedupe-1" });
  await eventually(async () => (await Notification.countDocuments({ owner: karim.user._id })) === 1);
  await check(rana, { symptoms: EMERGENCY, checkId: "check-dedupe-1" });
  await check(rana, { symptoms: "I have a fever", answers: { "fever-temperature": "39.5-plus" }, checkId: "check-dedupe-1" });
  await settle();
  assert.equal(await Notification.countDocuments({ owner: karim.user._id }), 1);
  assert.equal(sent.length, 1, "and one email");

  await check(rana, { symptoms: EMERGENCY, checkId: "check-dedupe-2" });
  await eventually(async () => (await Notification.countDocuments({ owner: karim.user._id })) === 2);

  // Called directly at the same time: still once.
  const now = Date.now();
  const results = await Promise.all([1, 2, 3].map(() => alertCareCircle({ owner: rana.user._id, profileId: rana.user._id, level: "urgent", checkId: "check-race", now })));
  assert.equal(results.reduce((a, b) => a + b, 0), 1);
});

test("no symptoms, answers or health details reach alerts, emails or logs", async () => {
  const { rana, karim } = await circle({ inviterFields: { phone: "+96170123456" } });
  const logs = captureLogs();
  try {
    await check(rana, { symptoms: "SECRET-SYMPTOM-WORDS my father can't breathe", checkId: "check-private" });
    await eventually(async () => (await Notification.countDocuments({ owner: karim.user._id })) === 1 && sent.length === 1);
  } finally {
    logs.stop();
  }
  const alert = await Notification.findOne({ owner: karim.user._id }).lean();
  const everything = JSON.stringify(alert) + JSON.stringify(sent) + logs.output();
  for (const secret of ["SECRET-SYMPTOM-WORDS", "breathe", "father"]) assert.doesNotMatch(everything, new RegExp(secret, "i"));
  const output = logs.output();
  assert.match(output, /"event":"care_circle_alerted"/);
  assert.match(output, /"reason":"members:1"/);
  for (const secret of ["emergency\\)", "Rana", karim.user.email, "\\+96170123456"]) assert.doesNotMatch(output, new RegExp(secret));
});

test("caregiver alerts stay on whatever the member's preferences say", async () => {
  const { rana, karim } = await circle();
  const off = await request("PUT", "/notifications/preferences", { cookie: karim.cookie, body: { caregiver_urgent: false } });
  assert.equal(off.status, 400);
  await User.updateOne({ _id: karim.user._id }, { $set: { mutedNotificationTypes: ["system", "appointment_reminder", "document_ready"] } });
  await check(rana, { symptoms: EMERGENCY, checkId: "check-prefs" });
  await eventually(async () => (await Notification.countDocuments({ owner: karim.user._id, type: "caregiver_urgent" })) === 1);
});

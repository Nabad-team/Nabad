const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const Notification = require("../src/models/Notification");
const Appointment = require("../src/models/Appointment");
const { notify } = require("../src/notifications");
const reminders = require("../src/appointmentReminders");
let mongod, server, base;
const password = "Notification test password 123!";
let passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), Notification.init(), Appointment.init()]);
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
beforeEach(async () => { await Promise.all([User.deleteMany({}), LinkedProfile.deleteMany({}), Notification.deleteMany({}), Appointment.deleteMany({})]); });

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
const MISSING_ID = "000000000000000000000000";
async function dependent(cookie, fullName = "Sami") {
  const created = await request("POST", "/profile/linked", { cookie, body: { fullName, dateOfBirth: "2015-06-01", relationship: "child" } });
  assert.equal(created.status, 201);
  return created.body.profile.id;
}
let counter = 0;
const note = (fields = {}) => ({ title: "Reminder", message: "Your appointment is in 1 hour.", link: "/appointments", dedupeKey: `test:${++counter}`, ...fields });

test("every notification route requires sign-in and writes require our Origin", async () => {
  const routes = [["GET", "/notifications"], ["GET", "/notifications/unread-count"], ["GET", "/notifications/preferences"],
    ["PUT", "/notifications/preferences"], ["POST", "/notifications/read-all"], ["POST", `/notifications/${MISSING_ID}/read`],
    ["DELETE", `/notifications/${MISSING_ID}`]];
  for (const [method, path] of routes) assert.equal((await request(method, path, { body: method === "GET" ? undefined : {} })).status, 401, `${method} ${path}`);
  const cookie = token(await user());
  assert.equal((await request("POST", "/notifications/read-all", { cookie, origin: "https://evil.example" })).status, 403);
});

test("the model keeps 90 days of notifications (TTL index) and one per dedupe key per account", async () => {
  const indexes = await Notification.collection.indexes();
  const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);
  assert.deepEqual(ttl.key, { createdAt: 1 });
  assert.equal(ttl.expireAfterSeconds, 90 * 24 * 60 * 60);
  const unique = indexes.find((index) => index.unique && index.key.dedupeKey);
  assert.deepEqual(unique.key, { owner: 1, dedupeKey: 1 });
});

test("notify creates a minimal notification once per dedupe key, even when called at the same time", async () => {
  const account = await user();
  const created = await notify(account._id, "self", "appointment_reminder", note({ dedupeKey: "same" }));
  assert.equal(created.type, "appointment_reminder");
  assert.equal(String(created.profileId), String(account._id));
  assert.equal(await notify(account._id, "self", "appointment_reminder", note({ dedupeKey: "same" })), null);
  const racing = await Promise.all(Array.from({ length: 5 }, () => notify(account._id, account._id, "system", note({ dedupeKey: "race" }))));
  assert.equal(racing.filter(Boolean).length, 1);
  assert.equal(await Notification.countDocuments({ owner: account._id }), 2);
  // Another account can use the same key.
  const other = await user("other@example.test");
  assert.ok(await notify(other._id, "self", "system", note({ dedupeKey: "same" })));
});

test("notify rejects unknown types, missing keys, outside links and over-long text", async () => {
  const account = await user();
  await assert.rejects(notify(account._id, "self", "marketing", note()), TypeError);
  await assert.rejects(notify(account._id, "self", "system", note({ dedupeKey: "" })), TypeError);
  await assert.rejects(notify(account._id, "self", "system", note({ link: "https://evil.example" })), { name: "ValidationError" });
  await assert.rejects(notify(account._id, "self", "system", note({ link: "//evil.example" })), { name: "ValidationError" });
  await assert.rejects(notify(account._id, "self", "system", note({ message: "x".repeat(201) })), { name: "ValidationError" });
  assert.equal(await Notification.countDocuments({}), 0);
});

test("notify only creates notifications for the owner's own profiles", async () => {
  const account = await user(); const cookie = token(account);
  const sami = await dependent(cookie);
  const other = await user("other@example.test");
  const otherChild = await dependent(token(other), "Other child");
  assert.ok(await notify(account._id, sami, "caregiver_urgent", note({ message: "Sami's symptom check needs attention." })));
  assert.equal(await notify(account._id, otherChild, "caregiver_urgent", note()), null);
  assert.equal(await notify(account._id, "not-an-id", "system", note()), null);
  assert.equal(await notify(new mongoose.Types.ObjectId(), "self", "system", note()), null);
  assert.equal(await Notification.countDocuments({ profileId: otherChild }), 0);
});

test("preferences are respected, and safety-critical types are always on", async () => {
  const account = await user(); const cookie = token(account);
  const initial = await request("GET", "/notifications/preferences", { cookie });
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body.preferences.map(({ type, enabled, alwaysOn }) => [type, enabled, alwaysOn]), [
    ["appointment_reminder", true, false], ["emergency_alert", true, true], ["caregiver_urgent", true, true],
    ["document_ready", true, false], ["system", true, false],
  ]);
  const off = await request("PUT", "/notifications/preferences", { cookie, body: { appointment_reminder: false, system: false } });
  assert.equal(off.status, 200);
  assert.equal(off.body.preferences.find((item) => item.type === "appointment_reminder").enabled, false);
  assert.equal(await notify(account._id, "self", "appointment_reminder", note()), null);
  assert.equal(await notify(account._id, "self", "system", note()), null);
  assert.ok(await notify(account._id, "self", "document_ready", note()));

  // Safety types can't be turned off, by the API or by writing the setting directly.
  const refused = await request("PUT", "/notifications/preferences", { cookie, body: { emergency_alert: false } });
  assert.equal(refused.status, 400);
  assert.equal((await request("PUT", "/notifications/preferences", { cookie, body: { caregiver_urgent: true } })).status, 200);
  await assert.rejects(User.updateOne({ _id: account._id }, { $push: { mutedNotificationTypes: "emergency_alert" } }, { runValidators: true }));
  assert.ok(await notify(account._id, "self", "emergency_alert", note()));
  assert.ok(await notify(account._id, "self", "caregiver_urgent", note()));

  const on = await request("PUT", "/notifications/preferences", { cookie, body: { appointment_reminder: true } });
  assert.equal(on.body.preferences.find((item) => item.type === "appointment_reminder").enabled, true);
  assert.equal(on.body.preferences.find((item) => item.type === "system").enabled, false);
  assert.ok(await notify(account._id, "self", "appointment_reminder", note()));

  for (const body of [{}, [], { marketing: true }, { system: "no" }]) {
    assert.equal((await request("PUT", "/notifications/preferences", { cookie, body })).status, 400, JSON.stringify(body));
  }
});

test("lists newest first with paging and filters by profile and unread", async () => {
  const account = await user(); const cookie = token(account);
  const sami = await dependent(cookie);
  for (let index = 0; index < 4; index += 1) await notify(account._id, "self", "system", note({ title: `Mine ${index}` }));
  await notify(account._id, sami, "appointment_reminder", note({ title: "Sami's" }));
  const first = await request("GET", "/notifications?limit=3", { cookie });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.notifications.map((item) => item.title), ["Sami's", "Mine 3", "Mine 2"]);
  assert.equal(first.body.total, 5);
  assert.equal(first.body.hasMore, true);
  const second = await request("GET", "/notifications?limit=3&page=2", { cookie });
  assert.deepEqual(second.body.notifications.map((item) => item.title), ["Mine 1", "Mine 0"]);
  assert.equal(second.body.hasMore, false);
  const item = first.body.notifications[0];
  assert.deepEqual(Object.keys(item).sort(), ["createdAt", "id", "link", "message", "phone", "profileId", "read", "readAt", "title", "type"]);
  assert.equal(item.profileId, sami);

  const forSami = await request("GET", `/notifications?profileId=${sami}`, { cookie });
  assert.deepEqual(forSami.body.notifications.map((n) => n.title), ["Sami's"]);
  const forSelf = await request("GET", "/notifications?profileId=self", { cookie });
  assert.equal(forSelf.body.total, 4);

  await request("POST", `/notifications/${item.id}/read`, { cookie });
  const unread = await request("GET", "/notifications?unread=true", { cookie });
  assert.equal(unread.body.total, 4);
  assert.ok(unread.body.notifications.every((n) => !n.read));

  for (const query of ["limit=0", "limit=51", "page=-1", "page=abc", "unread=yes"]) {
    assert.equal((await request("GET", `/notifications?${query}`, { cookie })).status, 400, query);
  }
});

test("another user's notifications and dependents answer 404", async () => {
  const account = await user(); const cookie = token(account);
  const other = await user("other@example.test"); const otherCookie = token(other);
  const otherChild = await dependent(otherCookie, "Other child");
  const theirs = await notify(other._id, otherChild, "caregiver_urgent", note());
  assert.equal((await request("GET", `/notifications?profileId=${otherChild}`, { cookie })).status, 404);
  assert.equal((await request("GET", "/notifications?profileId=not-an-id", { cookie })).status, 404);
  assert.equal((await request("GET", `/notifications?profileId=${other._id}`, { cookie })).status, 404);
  assert.equal((await request("POST", `/notifications/${theirs._id}/read`, { cookie })).status, 404);
  assert.equal((await request("DELETE", `/notifications/${theirs._id}`, { cookie })).status, 404);
  assert.equal((await request("POST", "/notifications/not-an-id/read", { cookie })).status, 404);
  assert.equal((await request("GET", "/notifications", { cookie })).body.total, 0);
  await request("POST", "/notifications/read-all", { cookie });
  const stored = await Notification.findById(theirs._id);
  assert.equal(stored.readAt, null);
  assert.equal((await request("GET", "/notifications/unread-count", { cookie: otherCookie })).body.count, 1);
});

test("counts unread, marks one or all as read, and deletes one", async () => {
  const account = await user(); const cookie = token(account);
  const [a, b] = [await notify(account._id, "self", "system", note()), await notify(account._id, "self", "system", note())];
  await notify(account._id, "self", "system", note());
  assert.equal((await request("GET", "/notifications/unread-count", { cookie })).body.count, 3);
  const read = await request("POST", `/notifications/${a._id}/read`, { cookie });
  assert.equal(read.status, 200);
  assert.equal(read.body.notification.read, true);
  const firstRead = read.body.notification.readAt;
  const again = await request("POST", `/notifications/${a._id}/read`, { cookie });
  assert.equal(again.body.notification.readAt, firstRead);
  assert.equal((await request("GET", "/notifications/unread-count", { cookie })).body.count, 2);
  const all = await request("POST", "/notifications/read-all", { cookie });
  assert.equal(all.body.updated, 2);
  assert.equal((await request("GET", "/notifications/unread-count", { cookie })).body.count, 0);
  assert.equal((await request("DELETE", `/notifications/${b._id}`, { cookie })).status, 204);
  assert.equal((await request("DELETE", `/notifications/${b._id}`, { cookie })).status, 404);
  assert.equal((await request("GET", "/notifications", { cookie })).body.total, 2);
});

test("removing a linked profile or the account removes their notifications", async () => {
  const account = await user(); const cookie = token(account);
  const sami = await dependent(cookie);
  const other = await user("other@example.test");
  await notify(account._id, "self", "system", note());
  await notify(account._id, sami, "caregiver_urgent", note());
  await notify(other._id, "self", "system", note());
  assert.equal((await request("DELETE", `/profile/linked/${sami}`, { cookie })).status, 204);
  assert.equal(await Notification.countDocuments({ profileId: sami }), 0);
  assert.equal(await Notification.countDocuments({ owner: account._id }), 1);
  assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } })).status, 204);
  assert.equal(await Notification.countDocuments({ owner: account._id }), 0);
  assert.equal(await Notification.countDocuments({ owner: other._id }), 1);
});

test("local appointment times are converted with the time zone, including across a DST change", () => {
  assert.equal(reminders.localTime("2026-01-15", "14:30", "Asia/Beirut").toISOString(), "2026-01-15T12:30:00.000Z");
  assert.equal(reminders.localTime("2026-07-15", "14:30", "Asia/Beirut").toISOString(), "2026-07-15T11:30:00.000Z");
  assert.equal(reminders.localTime("2026-03-08", "09:00", "America/New_York").toISOString(), "2026-03-08T13:00:00.000Z");
  assert.equal(reminders.localTime("2026-03-07", "09:00", "America/New_York").toISOString(), "2026-03-07T14:00:00.000Z");
  assert.equal(reminders.localTime("2026-10-22", "00:15", "UTC").toISOString(), "2026-10-22T00:15:00.000Z");
  assert.equal(reminders.validTimeZone("Asia/Beirut"), true);
  assert.equal(reminders.validTimeZone("Mars/Olympus"), false);
});

// An appointment through the API, `minutesAway` from now in UTC, with a reminder `reminderMinutes` before.
const isoParts = (date) => ({ appointmentDate: date.toISOString().slice(0, 10), appointmentTime: date.toISOString().slice(11, 16) });
async function appointmentIn(cookie, minutesAway, { reminderMinutes = 60, profileId = "self", ...fields } = {}) {
  const at = new Date(Math.ceil((Date.now() + minutesAway * 60000) / 60000) * 60000);
  const created = await request("POST", `/appointments?profileId=${profileId}`, { cookie, body: {
    title: "Oncology follow-up", hospital: "AUBMC", notes: "Bring the biopsy results", ...isoParts(at), reminderMinutes, timeZone: "UTC", ...fields,
  } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body.appointment;
}

test("the reminder job notifies due appointments once, with no health details, and is safe to run repeatedly", async () => {
  const account = await user(); const cookie = token(account);
  const sami = await dependent(cookie);
  await appointmentIn(cookie, 30, { reminderMinutes: 60 }); // due now
  await appointmentIn(cookie, 30, { reminderMinutes: 60, profileId: sami }); // due now, for Sami
  await appointmentIn(cookie, 180, { reminderMinutes: 60 }); // not yet
  await appointmentIn(cookie, -30, { reminderMinutes: 60 }); // already started

  assert.equal(await reminders.sendDueReminders(), 2);
  await Promise.all([reminders.sendDueReminders(), reminders.sendDueReminders()]);
  assert.equal(await reminders.sendDueReminders(), 0);
  const stored = await Notification.find({ owner: account._id }).sort({ message: 1 });
  assert.equal(stored.length, 2);
  assert.deepEqual(stored.map((n) => [n.type, n.title, n.link]), [["appointment_reminder", "Appointment reminder", "/appointments"], ["appointment_reminder", "Appointment reminder", "/appointments"]]);
  assert.match(stored[0].message, /^Sami's appointment at AUBMC is in (29|30|31) minutes \(\d{2}:\d{2}\)\.$/);
  assert.match(stored[1].message, /^Your appointment at AUBMC is in (29|30|31) minutes/);
  for (const n of stored) assert.doesNotMatch(n.message, /Oncology|biopsy/);

  // Even if the handled flag is lost, the dedupe key stops a second notification.
  await Appointment.updateMany({}, { $set: { reminderNotified: false } });
  assert.equal(await reminders.sendDueReminders(), 0);
  assert.equal(await Notification.countDocuments({}), 2);
});

test("rescheduling an appointment arms its reminder again; turning reminders off stops them", async () => {
  const account = await user(); const cookie = token(account);
  const appointment = await appointmentIn(cookie, 20, { reminderMinutes: 30 });
  assert.equal(await reminders.sendDueReminders(), 1);
  // Saving it unchanged doesn't repeat the reminder.
  const { id, profileId, createdAt, updatedAt, ...fields } = appointment;
  await request("PUT", `/appointments/${id}`, { cookie, body: fields });
  assert.equal(await reminders.sendDueReminders(), 0);
  const later = new Date(Math.ceil((Date.now() + 40 * 60000) / 60000) * 60000);
  await request("PUT", `/appointments/${id}`, { cookie, body: { ...fields, ...isoParts(later), reminderMinutes: 60 } });
  assert.equal(await reminders.sendDueReminders(), 1);

  await request("PUT", "/notifications/preferences", { cookie, body: { appointment_reminder: false } });
  await appointmentIn(cookie, 10, { reminderMinutes: 15 });
  assert.equal(await reminders.sendDueReminders(), 0);
  assert.equal(await Notification.countDocuments({ owner: account._id }), 2);
});

test("appointments keep their time zone, reject invalid ones, and older ones are backfilled in Lebanon time", async () => {
  const account = await user(); const cookie = token(account);
  const bad = await request("POST", "/appointments", { cookie, body: { title: "Visit", hospital: "AUBMC", appointmentDate: "2026-12-01", appointmentTime: "10:00", timeZone: "Mars/Olympus" } });
  assert.equal(bad.status, 400);
  const created = await appointmentIn(cookie, 600, { timeZone: "Asia/Beirut" });
  const { id, profileId, createdAt, updatedAt, ...fields } = created;
  assert.equal("timeZone" in created, false);
  await request("PUT", `/appointments/${id}`, { cookie, body: { ...fields, appointmentDate: "2026-12-01", appointmentTime: "10:00" } });
  const stored = await Appointment.findById(id);
  assert.equal(stored.timeZone, "Asia/Beirut");
  assert.equal(stored.startsAt.toISOString(), "2026-12-01T08:00:00.000Z");
  assert.equal(stored.remindAt.toISOString(), "2026-12-01T07:00:00.000Z");

  const legacy = await Appointment.collection.insertOne({ owner: account._id, profileId: account._id, title: "Old", hospital: "AUBMC", location: "", notes: "", appointmentDate: "2026-07-01", appointmentTime: "09:00", reminderMinutes: 15 });
  assert.equal(await reminders.backfillReminderSchedules(), 1);
  assert.equal(await reminders.backfillReminderSchedules(), 0);
  const backfilled = await Appointment.findById(legacy.insertedId);
  assert.equal(backfilled.timeZone, "Asia/Beirut");
  assert.equal(backfilled.startsAt.toISOString(), "2026-07-01T06:00:00.000Z");
  assert.equal(backfilled.remindAt.toISOString(), "2026-07-01T05:45:00.000Z");
});

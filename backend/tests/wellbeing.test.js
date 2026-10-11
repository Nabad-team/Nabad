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
const { HydrationEntry, SleepEntry, WellbeingSettings } = require("../src/models/Wellbeing");
let mongod, server, base;
const password = "Wellbeing test password 123!";
let passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), Medication.init(), HydrationEntry.init(), SleepEntry.init(), WellbeingSettings.init()]);
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
  await Promise.all([User, LinkedProfile, Medication, HydrationEntry, SleepEntry, WellbeingSettings].map((Model) => Model.deleteMany({})));
});

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
// Dates relative to today in UTC, as "YYYY-MM-DD".
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const TODAY = day();
const withProfile = (path, profileId) => (profileId ? `${path}${path.includes("?") ? "&" : "?"}profileId=${profileId}` : path);
const addGlass = (cookie, profileId, date = TODAY) => request("POST", withProfile("/wellbeing/water/glass", profileId), { cookie, body: { date } });
const removeGlass = (cookie, profileId, date = TODAY) => request("DELETE", withProfile(`/wellbeing/water/glass?date=${date}`, profileId), { cookie });
const today = (cookie, profileId) => request("GET", withProfile(`/wellbeing/today?date=${TODAY}`, profileId), { cookie });
const logSleep = (cookie, body, { date = TODAY, profileId } = {}) => request("PUT", withProfile(`/wellbeing/sleep/${date}`, profileId), { cookie, body });
const history = (cookie, days = 7, profileId) => request("GET", withProfile(`/wellbeing/history?days=${days}&end=${TODAY}`, profileId), { cookie });
async function dependent(cookie, fullName = "Child") {
  const created = await request("POST", "/profile/linked", { cookie, body: { fullName, dateOfBirth: "2015-06-01", relationship: "child" } });
  assert.equal(created.status, 201);
  return created.body.profile.id;
}
const sleep7 = { hours: 7.5, quality: 4, note: "Woke once" };

test("every wellbeing route requires sign-in and writes require our Origin", async () => {
  const routes = [["GET", `/wellbeing/today?date=${TODAY}`], ["POST", "/wellbeing/water/glass"], ["DELETE", `/wellbeing/water/glass?date=${TODAY}`],
    ["PUT", "/wellbeing/water/target"], ["DELETE", "/wellbeing/water/target"], ["PUT", `/wellbeing/sleep/${TODAY}`],
    ["DELETE", `/wellbeing/sleep/${TODAY}`], ["GET", `/wellbeing/history?end=${TODAY}`]];
  for (const [method, path] of routes) assert.equal((await request(method, path, { body: method === "GET" || method === "DELETE" ? undefined : {} })).status, 401, `${method} ${path}`);
  const cookie = token(await user());
  assert.equal((await request("POST", "/wellbeing/water/glass", { cookie, origin: "https://evil.example", body: { date: TODAY } })).status, 403);
});

test("today starts empty, with no water target", async () => {
  const cookie = token(await user());
  const response = await today(cookie);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { date: TODAY, water: { date: TODAY, glasses: 0, target: null }, sleep: null });
});

test("adding and removing glasses updates one entry for the day, never below 0", async () => {
  const cookie = token(await user());
  assert.equal((await addGlass(cookie)).body.water.glasses, 1);
  assert.equal((await addGlass(cookie)).body.water.glasses, 2);
  assert.equal((await addGlass(cookie)).body.water.glasses, 3);
  assert.equal((await removeGlass(cookie)).body.water.glasses, 2);
  assert.equal(await HydrationEntry.countDocuments(), 1, "one entry per profile per day");
  assert.equal((await today(cookie)).body.water.glasses, 2);
  await removeGlass(cookie); await removeGlass(cookie);
  const empty = await removeGlass(cookie);
  assert.equal(empty.status, 200); assert.equal(empty.body.water.glasses, 0);
  assert.equal((await HydrationEntry.findOne()).glasses, 0);
});

test("glasses added at the same moment are all counted, in a single entry", async () => {
  const cookie = token(await user());
  const results = await Promise.all(Array.from({ length: 5 }, () => addGlass(cookie)));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(await HydrationEntry.countDocuments(), 1);
  assert.equal((await today(cookie)).body.water.glasses, 5);
});

test("stops at 30 glasses a day with a clear message", async () => {
  const cookie = token(await user());
  const account = await User.findOne();
  await HydrationEntry.create({ owner: account._id, profileId: account._id, date: new Date(TODAY), glasses: 29 });
  assert.equal((await addGlass(cookie)).body.water.glasses, 30);
  const full = await addGlass(cookie);
  assert.equal(full.status, 400);
  assert.equal(full.body.error, "30 glasses is the most this tracker records for one day.");
  assert.equal((await today(cookie)).body.water.glasses, 30);
});

test("water can only be logged for today (allowing for time zones)", async (t) => {
  // The server (in this process) and the test read the same frozen clock: at noon UTC, so a run that
  // crosses midnight can't turn "yesterday" into "two days ago" between computing a date and sending it.
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(`${day()}T12:00:00Z`) });
  const cookie = token(await user());
  assert.equal((await addGlass(cookie, undefined, day(1))).status, 200, "already tomorrow in some time zones");
  assert.equal((await addGlass(cookie, undefined, day(-1))).status, 200, "still yesterday in some time zones");
  for (const date of [day(-3), day(3), "2026-02-30", "today", null, 20261012]) {
    const response = await request("POST", "/wellbeing/water/glass", { cookie, body: { date } });
    assert.equal(response.status, 400, String(date));
    assert.equal(response.body.error, "Send today's date as YYYY-MM-DD. Water can only be logged for today.");
  }
  assert.equal((await removeGlass(cookie, undefined, day(-5))).status, 400);
  assert.equal((await request("GET", "/wellbeing/today?date=nope", { cookie })).status, 400);
});

test("sets, changes and clears the daily water target, with no default", async () => {
  const cookie = token(await user());
  const set = await request("PUT", "/wellbeing/water/target", { cookie, body: { target: 8 } });
  assert.equal(set.status, 200); assert.deepEqual(set.body, { target: 8 });
  assert.equal((await addGlass(cookie)).body.water.target, 8);
  await request("PUT", "/wellbeing/water/target", { cookie, body: { target: 6 } });
  assert.equal((await today(cookie)).body.water.target, 6);
  assert.equal(await WellbeingSettings.countDocuments(), 1);

  assert.deepEqual((await request("DELETE", "/wellbeing/water/target", { cookie })).body, { target: null });
  assert.equal((await today(cookie)).body.water.target, null);
  await request("PUT", "/wellbeing/water/target", { cookie, body: { target: 5 } });
  assert.deepEqual((await request("PUT", "/wellbeing/water/target", { cookie, body: { target: null } })).body, { target: null }, "null also clears it");
  assert.equal((await history(cookie)).body.target, null);
});

test("rejects an invalid water target", async () => {
  const cookie = token(await user());
  for (const target of [0, 31, 2.5, "8", -1, undefined, [8]]) {
    const response = await request("PUT", "/wellbeing/water/target", { cookie, body: { target } });
    assert.equal(response.status, 400, JSON.stringify(target));
    assert.equal(response.body.error, "Enter a daily goal from 1 to 30 glasses, or remove the goal.");
  }
  assert.equal(await WellbeingSettings.countDocuments(), 0);
});

test("logs, updates and deletes the sleep entry for a morning, one per day", async () => {
  const cookie = token(await user());
  const created = await logSleep(cookie, sleep7);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.sleep, { date: TODAY, ...sleep7 });
  assert.deepEqual((await today(cookie)).body.sleep, { date: TODAY, ...sleep7 });

  const updated = await logSleep(cookie, { hours: 6, quality: 2 });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.sleep, { date: TODAY, hours: 6, quality: 2, note: "" });
  assert.equal(await SleepEntry.countDocuments(), 1, "one entry per profile per day");

  // Another morning is a separate entry.
  assert.equal((await logSleep(cookie, sleep7, { date: day(-2) })).status, 201);
  assert.equal(await SleepEntry.countDocuments(), 2);

  assert.equal((await request("DELETE", `/wellbeing/sleep/${TODAY}`, { cookie })).status, 204);
  assert.equal((await today(cookie)).body.sleep, null);
  const again = await request("DELETE", `/wellbeing/sleep/${TODAY}`, { cookie });
  assert.equal(again.status, 404); assert.equal(again.body.error, "There is no sleep entry for that morning.");
});

test("rejects invalid sleep entries with a clear message", async () => {
  const cookie = token(await user());
  const HOURS = "Enter the hours slept, from 0 to 24, in half hours (for example 7.5).";
  const QUALITY = "Choose how well you slept, from 1 (very poorly) to 5 (very well).";
  const cases = [
    [{ ...sleep7, hours: -1 }, HOURS], [{ ...sleep7, hours: 24.5 }, HOURS], [{ ...sleep7, hours: 7.25 }, HOURS],
    [{ ...sleep7, hours: "7" }, HOURS], [{ quality: 3 }, HOURS],
    [{ ...sleep7, quality: 0 }, QUALITY], [{ ...sleep7, quality: 6 }, QUALITY], [{ ...sleep7, quality: 3.5 }, QUALITY], [{ hours: 7 }, QUALITY],
    [{ ...sleep7, note: 5 }, "The note must be text."],
    [{ ...sleep7, note: "n".repeat(201) }, "Keep the note to 200 characters or fewer."],
  ];
  for (const [body, error] of cases) {
    const response = await logSleep(cookie, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.body.error, error, JSON.stringify(body));
  }
  for (const date of [day(3), "2020-01-01", "2026-02-30", "yesterday"]) {
    const response = await logSleep(cookie, sleep7, { date });
    assert.equal(response.status, 400, date);
    assert.equal(response.body.error, "Choose a morning from the past year, up to today.");
  }
  // The edges are fine: 0 and 24 hours, and a morning a few weeks ago.
  assert.equal((await logSleep(cookie, { hours: 0, quality: 1 })).status, 201);
  assert.equal((await logSleep(cookie, { hours: 24, quality: 5 }, { date: day(-20) })).status, 201);
  assert.equal(await SleepEntry.countDocuments(), 2);
});

test("history lists the last 7 or 30 days, oldest first, with gaps as null", async () => {
  const cookie = token(await user());
  await request("PUT", "/wellbeing/water/target", { cookie, body: { target: 8 } });
  await addGlass(cookie); await addGlass(cookie);
  const account = await User.findOne();
  await HydrationEntry.create({ owner: account._id, profileId: account._id, date: new Date(day(-3)), glasses: 6 });
  await HydrationEntry.create({ owner: account._id, profileId: account._id, date: new Date(day(-9)), glasses: 4 });
  await logSleep(cookie, sleep7, { date: day(-1) });
  await logSleep(cookie, { hours: 5, quality: 2 }, { date: day(-20) });

  const week = await history(cookie);
  assert.equal(week.status, 200);
  assert.equal(week.body.target, 8);
  assert.deepEqual(week.body.days.map((d) => d.date), [-6, -5, -4, -3, -2, -1, 0].map(day));
  assert.deepEqual(week.body.days.map((d) => d.glasses), [null, null, null, 6, null, null, 2]);
  assert.deepEqual(week.body.days.map((d) => d.sleep && d.sleep.hours), [null, null, null, null, null, 7.5, null]);

  const month = await history(cookie, 30);
  assert.equal(month.body.days.length, 30);
  assert.equal(month.body.days[0].date, day(-29));
  assert.equal(month.body.days.filter((d) => d.glasses !== null).length, 3);
  assert.equal(month.body.days.filter((d) => d.sleep).length, 2);

  assert.equal((await request("GET", `/wellbeing/history?days=14&end=${TODAY}`, { cookie })).status, 400);
  assert.equal((await request("GET", `/wellbeing/history?days=7&end=${day(-10)}`, { cookie })).status, 400);
});

test("a caregiver tracks a dependent's water and sleep, kept apart from their own", async () => {
  const cookie = token(await user());
  const childId = await dependent(cookie);
  await addGlass(cookie, childId); await addGlass(cookie, childId);
  await addGlass(cookie);
  await request("PUT", withProfile("/wellbeing/water/target", childId), { cookie, body: { target: 5 } });
  await logSleep(cookie, { hours: 10, quality: 5 }, { profileId: childId });

  const child = (await today(cookie, childId)).body;
  assert.deepEqual(child.water, { date: TODAY, glasses: 2, target: 5 });
  assert.equal(child.sleep.hours, 10);
  const own = (await today(cookie)).body;
  assert.deepEqual(own.water, { date: TODAY, glasses: 1, target: null });
  assert.equal(own.sleep, null);

  assert.equal((await removeGlass(cookie, childId)).body.water.glasses, 1);
  assert.equal((await request("DELETE", withProfile(`/wellbeing/sleep/${TODAY}`, childId), { cookie })).status, 204);
  assert.equal((await history(cookie, 7, childId)).body.days.at(-1).glasses, 1);
});

test("nobody can reach another user's water, sleep or dependent", async () => {
  const parent = token(await user());
  const stranger = token(await user("stranger@example.test"));
  const childId = await dependent(parent);
  await addGlass(parent, childId);
  await logSleep(parent, sleep7, { profileId: childId });
  await addGlass(parent);

  const attempts = [
    ["GET", `/wellbeing/today?date=${TODAY}`, undefined], ["POST", "/wellbeing/water/glass", { date: TODAY }],
    ["DELETE", `/wellbeing/water/glass?date=${TODAY}`, undefined], ["PUT", "/wellbeing/water/target", { target: 3 }],
    ["DELETE", "/wellbeing/water/target", undefined], ["PUT", `/wellbeing/sleep/${TODAY}`, sleep7],
    ["DELETE", `/wellbeing/sleep/${TODAY}`, undefined], ["GET", `/wellbeing/history?end=${TODAY}`, undefined],
  ];
  for (const [method, path, body] of attempts) {
    for (const profileId of [childId, "000000000000000000000000", "not-an-id"]) {
      const response = await request(method, withProfile(path, profileId), { cookie: stranger, body });
      assert.equal(response.status, 404, `${method} ${path} as ${profileId}`);
      assert.deepEqual(response.body, { error: "Profile not found." });
    }
  }
  // The stranger's own "self" is their own, empty data.
  assert.deepEqual((await today(stranger)).body.water.glasses, 0);
  assert.equal((await today(parent, childId)).body.water.glasses, 1);
  assert.equal((await today(parent, childId)).body.sleep.hours, 7.5);
  assert.equal((await today(parent)).body.water.glasses, 1);
});

test("never writes glasses, hours, quality or notes to the logs", async () => {
  const cookie = token(await user());
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { written.push(String(chunk)); return original.call(this, chunk, ...rest); };
  try {
    await request("PUT", "/wellbeing/water/target", { cookie, body: { target: 17 } });
    await addGlass(cookie);
    await logSleep(cookie, { hours: 13.5, quality: 4, note: "Privatesleepnote" });
    await logSleep(cookie, { hours: 99, quality: 4, note: "Privatesleepnote" });
    await today(cookie);
    await history(cookie);
  } finally { process.stdout.write = original; }
  const logs = written.join("");
  assert.match(logs, /http_request/);
  // Numbers can't be checked: any number may turn up by chance in a timestamp ("10:13:13.512Z"), a duration
  // or a request id. So look for the note and for the field names, which only appear if the data is logged.
  for (const value of ["Privatesleepnote", "\"glasses\"", "\"hours\"", "\"quality\"", "\"target\"", "waterTarget"]) {
    assert.ok(!logs.includes(value), `log contains ${value}`);
  }
});

test("writes are rate-limited per account", async () => {
  const cookie = token(await user());
  for (let i = 0; i < 300; i++) assert.notEqual((await removeGlass(cookie)).status, 429);
  const limited = await addGlass(cookie);
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /Too many changes/);
  assert.equal((await today(cookie)).status, 200, "reading is not limited");
  assert.equal((await addGlass(token(await user("second@example.test")))).status, 200, "another account is not affected");
});

test("removing a dependent deletes their water, sleep and target, and nobody else's", async () => {
  const cookie = token(await user());
  const other = token(await user("other@example.test"));
  const childId = await dependent(cookie, "Child");
  const siblingId = await dependent(cookie, "Sibling");
  for (const profileId of [childId, siblingId, undefined]) {
    await addGlass(cookie, profileId);
    await logSleep(cookie, sleep7, { profileId });
    await request("PUT", withProfile("/wellbeing/water/target", profileId), { cookie, body: { target: 4 } });
  }
  await addGlass(other); await logSleep(other, sleep7);

  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie: other })).status, 404);
  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie })).status, 204);
  for (const Model of [HydrationEntry, SleepEntry, WellbeingSettings]) {
    assert.equal(await Model.countDocuments({ profileId: childId }), 0, Model.modelName);
    assert.equal(await Model.countDocuments({ profileId: siblingId }), 1, Model.modelName);
  }
  assert.equal((await today(cookie)).body.water.glasses, 1);
  assert.equal((await today(other)).body.water.glasses, 1);
  assert.equal((await today(cookie, childId)).status, 404);
});

test("deleting the account deletes its own and every dependent's water, sleep and targets", async () => {
  const account = await user(); const cookie = token(account);
  const other = token(await user("other@example.test"));
  const childId = await dependent(cookie);
  for (const profileId of [childId, undefined]) {
    await addGlass(cookie, profileId);
    await logSleep(cookie, sleep7, { profileId });
    await request("PUT", withProfile("/wellbeing/water/target", profileId), { cookie, body: { target: 4 } });
  }
  await addGlass(other); await logSleep(other, sleep7);
  assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } })).status, 204);
  for (const Model of [HydrationEntry, SleepEntry, WellbeingSettings]) {
    assert.equal(await Model.countDocuments({ owner: account._id }), 0, Model.modelName);
  }
  assert.equal(await HydrationEntry.countDocuments(), 1);
  assert.equal(await SleepEntry.countDocuments(), 1);
});

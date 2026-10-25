const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
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
  mongod = await createTestMongo();
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
const addDrink = (cookie, ml = 250, { profileId, date = TODAY } = {}) => request("POST", withProfile("/wellbeing/water/entries", profileId), { cookie, body: { date, ml } });
const undoDrink = (cookie, profileId, date = TODAY) => request("DELETE", withProfile(`/wellbeing/water/entries/last?date=${date}`, profileId), { cookie });
const setGoal = (cookie, goal, profileId) => request("PUT", withProfile("/wellbeing/water/goal", profileId), { cookie, body: goal });
const today = (cookie, profileId) => request("GET", withProfile(`/wellbeing/today?date=${TODAY}`, profileId), { cookie });
const logSleep = (cookie, body, { date = TODAY, profileId } = {}) => request("PUT", withProfile(`/wellbeing/sleep/${date}`, profileId), { cookie, body });
const history = (cookie, days = 7, profileId) => request("GET", withProfile(`/wellbeing/history?days=${days}&end=${TODAY}`, profileId), { cookie });
const amounts = (water) => water.entries.map((entry) => entry.ml);
async function dependent(cookie, fullName = "Child") {
  const created = await request("POST", "/profile/linked", { cookie, body: { fullName, dateOfBirth: "2015-06-01", relationship: "child" } });
  assert.equal(created.status, 201);
  return created.body.profile.id;
}
const sleep7 = { hours: 7.5, quality: 4, note: "Woke once" };
const sleep7View = { ...sleep7, bedtime: null, wakeTime: null };
const drinkMore = { type: "atLeast", ml: 2000 };
const limit = { type: "atMost", ml: 1500 };

test("every wellbeing route requires sign-in and writes require our Origin", async () => {
  const routes = [["GET", `/wellbeing/today?date=${TODAY}`], ["POST", "/wellbeing/water/entries"], ["DELETE", `/wellbeing/water/entries/last?date=${TODAY}`],
    ["PUT", "/wellbeing/water/goal"], ["DELETE", "/wellbeing/water/goal"], ["PUT", `/wellbeing/sleep/${TODAY}`],
    ["DELETE", `/wellbeing/sleep/${TODAY}`], ["GET", `/wellbeing/history?end=${TODAY}`]];
  for (const [method, path] of routes) assert.equal((await request(method, path, { body: method === "GET" || method === "DELETE" ? undefined : {} })).status, 401, `${method} ${path}`);
  const cookie = token(await user());
  assert.equal((await request("POST", "/wellbeing/water/entries", { cookie, origin: "https://evil.example", body: { date: TODAY, ml: 250 } })).status, 403);
});

test("today starts empty, with no water goal", async () => {
  const cookie = token(await user());
  const response = await today(cookie);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { date: TODAY, water: { date: TODAY, totalMl: 0, entries: [], goal: null }, sleep: null });
});

test("logs drinks in millilitres with their time, in one entry for the day", async () => {
  const cookie = token(await user());
  const before = Date.now();
  const glass = await addDrink(cookie, 250);
  assert.equal(glass.status, 200);
  assert.equal(glass.body.water.totalMl, 250);
  const [entry] = glass.body.water.entries;
  assert.equal(entry.ml, 250);
  assert.ok(Date.parse(entry.at) >= before - 1000 && Date.parse(entry.at) <= Date.now() + 1000, "logged at the current time");

  assert.equal((await addDrink(cookie, 500)).body.water.totalMl, 750);
  const custom = await addDrink(cookie, 330);
  assert.equal(custom.body.water.totalMl, 1080);
  assert.deepEqual(amounts(custom.body.water), [250, 500, 330], "oldest first");
  assert.equal(await HydrationEntry.countDocuments(), 1, "one entry per profile per day");
  assert.equal((await today(cookie)).body.water.totalMl, 1080);
});

test("undo removes only the last drink, and does nothing when there is none", async () => {
  const cookie = token(await user());
  await addDrink(cookie, 250); await addDrink(cookie, 500); await addDrink(cookie, 120);
  const undone = await undoDrink(cookie);
  assert.equal(undone.status, 200);
  assert.equal(undone.body.water.totalMl, 750);
  assert.deepEqual(amounts(undone.body.water), [250, 500]);
  await undoDrink(cookie); await undoDrink(cookie);
  const empty = await undoDrink(cookie);
  assert.equal(empty.status, 200);
  assert.deepEqual([empty.body.water.totalMl, empty.body.water.entries], [0, []]);
  const stored = await HydrationEntry.findOne();
  assert.deepEqual([stored.totalMl, stored.entries.length], [0, 0]);
  // Undo on a day with nothing ever logged is harmless too.
  assert.equal((await undoDrink(token(await user("fresh@example.test")))).body.water.totalMl, 0);
});

test("drinks logged at the same moment are all counted, in a single entry", async () => {
  const cookie = token(await user());
  const results = await Promise.all(Array.from({ length: 5 }, () => addDrink(cookie, 200)));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(await HydrationEntry.countDocuments(), 1);
  const water = (await today(cookie)).body.water;
  assert.equal(water.totalMl, 1000);
  assert.equal(water.entries.length, 5);
});

test("rejects amounts outside 10 to 2000 whole millilitres", async () => {
  const cookie = token(await user());
  for (const ml of [0, 9, 2001, 250.5, "250", -250, null]) {
    const response = await addDrink(cookie, ml);
    assert.equal(response.status, 400, JSON.stringify(ml));
    assert.equal(response.body.error, "Enter an amount from 10 to 2000 ml, in whole millilitres.");
  }
  assert.equal((await request("POST", "/wellbeing/water/entries", { cookie, body: { date: TODAY } })).status, 400, "no amount");
  assert.equal(await HydrationEntry.countDocuments(), 0);
  assert.equal((await addDrink(cookie, 10)).status, 200);
  assert.equal((await addDrink(cookie, 2000)).status, 200);
});

test("stops at 10 litres or 60 drinks a day with a clear message", async () => {
  const cookie = token(await user());
  for (let i = 0; i < 5; i++) assert.equal((await addDrink(cookie, 2000)).status, 200);
  const full = await addDrink(cookie, 10);
  assert.equal(full.status, 400);
  assert.equal(full.body.error, "10 litres is the most this tracker records for one day.");
  assert.equal((await today(cookie)).body.water.totalMl, 10000);

  const other = token(await user("many@example.test"));
  for (let i = 0; i < 60; i++) assert.equal((await addDrink(other, 10)).status, 200);
  const many = await addDrink(other, 10);
  assert.equal(many.status, 400);
  assert.equal(many.body.error, "60 drinks is the most this tracker records for one day.");
});

test("water can only be logged for today (allowing for time zones)", async (t) => {
  // The server (in this process) and the test read the same frozen clock: at noon UTC, so a run that
  // crosses midnight can't turn "yesterday" into "two days ago" between computing a date and sending it.
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(`${day()}T12:00:00Z`) });
  const cookie = token(await user());
  assert.equal((await addDrink(cookie, 250, { date: day(1) })).status, 200, "already tomorrow in some time zones");
  assert.equal((await addDrink(cookie, 250, { date: day(-1) })).status, 200, "still yesterday in some time zones");
  for (const date of [day(-3), day(3), "2026-02-30", "today", null, 20261012]) {
    const response = await request("POST", "/wellbeing/water/entries", { cookie, body: { date, ml: 250 } });
    assert.equal(response.status, 400, String(date));
    assert.equal(response.body.error, "Send today's date as YYYY-MM-DD. Water can only be logged for today.");
  }
  assert.equal((await undoDrink(cookie, undefined, day(-5))).status, 400);
  assert.equal((await request("GET", "/wellbeing/today?date=nope", { cookie })).status, 400);
});

test("sets a \"drink at least\" goal, changes it to a \"stay under\" limit, and clears it, with no default", async () => {
  const cookie = token(await user());
  const set = await setGoal(cookie, drinkMore);
  assert.equal(set.status, 200); assert.deepEqual(set.body, { goal: drinkMore });
  assert.deepEqual((await addDrink(cookie)).body.water.goal, drinkMore);

  assert.deepEqual((await setGoal(cookie, limit)).body, { goal: limit });
  assert.deepEqual((await today(cookie)).body.water.goal, limit);
  assert.deepEqual((await history(cookie)).body.goal, limit);
  assert.equal(await WellbeingSettings.countDocuments(), 1);

  assert.deepEqual((await request("DELETE", "/wellbeing/water/goal", { cookie })).body, { goal: null });
  assert.equal((await today(cookie)).body.water.goal, null);
  await setGoal(cookie, limit);
  assert.deepEqual((await setGoal(cookie, { goal: null })).body, { goal: null }, "goal: null also clears it");
  assert.equal((await history(cookie)).body.goal, null);
});

test("rejects an invalid water goal", async () => {
  const cookie = token(await user());
  const TYPE = "Choose \"Drink at least\" or \"Stay under\".";
  const AMOUNT = "Enter a daily amount from 100 ml to 10 litres, or remove the goal.";
  const cases = [
    [{ ml: 1500 }, TYPE], [{ type: "atLeastish", ml: 1500 }, TYPE], [{ type: "glasses", ml: 8 }, TYPE], [{}, TYPE], [{ target: 8 }, TYPE],
    [{ type: "atMost", ml: 99 }, AMOUNT], [{ type: "atMost", ml: 10001 }, AMOUNT], [{ type: "atLeast", ml: 1500.5 }, AMOUNT],
    [{ type: "atLeast", ml: "1500" }, AMOUNT], [{ type: "atLeast" }, AMOUNT],
  ];
  for (const [body, error] of cases) {
    const response = await setGoal(cookie, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.body.error, error, JSON.stringify(body));
  }
  assert.equal(await WellbeingSettings.countDocuments(), 0);
});

test("logs, updates and deletes the sleep entry for a morning, one per day", async () => {
  const cookie = token(await user());
  const created = await logSleep(cookie, sleep7);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.sleep, { date: TODAY, ...sleep7View });
  assert.deepEqual((await today(cookie)).body.sleep, { date: TODAY, ...sleep7View });

  const updated = await logSleep(cookie, { hours: 6, quality: 2 });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.sleep, { date: TODAY, hours: 6, bedtime: null, wakeTime: null, quality: 2, note: "" });
  assert.equal(await SleepEntry.countDocuments(), 1, "one entry per profile per day");

  // Another morning is a separate entry.
  assert.equal((await logSleep(cookie, sleep7, { date: day(-2) })).status, 201);
  assert.equal(await SleepEntry.countDocuments(), 2);

  assert.equal((await request("DELETE", `/wellbeing/sleep/${TODAY}`, { cookie })).status, 204);
  assert.equal((await today(cookie)).body.sleep, null);
  const again = await request("DELETE", `/wellbeing/sleep/${TODAY}`, { cookie });
  assert.equal(again.status, 404); assert.equal(again.body.error, "There is no sleep entry for that morning.");
});

test("works out hours slept from bedtime and wake-up time, across midnight", async () => {
  const cookie = token(await user());
  const cases = [
    ["23:30", "07:00", 7.5], ["22:00", "06:15", 8.25], ["01:00", "08:00", 7], ["13:00", "15:30", 2.5],
    ["23:40", "07:00", 7.33], ["00:00", "23:59", 23.98], ["23:59", "00:00", 0.02], ["21:00", "21:30", 0.5],
  ];
  for (const [bedtime, wakeTime, hours] of cases) {
    const saved = await logSleep(cookie, { bedtime, wakeTime, quality: 3 });
    assert.ok([200, 201].includes(saved.status), `${bedtime}-${wakeTime}`);
    assert.deepEqual(saved.body.sleep, { date: TODAY, hours, bedtime, wakeTime, quality: 3, note: "" }, `${bedtime}-${wakeTime}`);
  }
  // The times win over hours sent at the same time; the stored entry keeps both times.
  await logSleep(cookie, { hours: 3, bedtime: "22:30", wakeTime: "06:30", quality: 4 });
  const stored = await SleepEntry.findOne();
  assert.deepEqual([stored.hours, stored.bedtime, stored.wakeTime], [8, "22:30", "06:30"]);
  // Entering hours directly afterwards clears the times.
  assert.deepEqual((await logSleep(cookie, { hours: 6.5, quality: 4 })).body.sleep, { date: TODAY, hours: 6.5, bedtime: null, wakeTime: null, quality: 4, note: "" });
  assert.deepEqual([(await SleepEntry.findOne()).bedtime, (await SleepEntry.findOne()).wakeTime], [null, null]);
});

test("rejects invalid sleep entries with a clear message", async () => {
  const cookie = token(await user());
  const HOURS = "Enter the hours slept, from 0 to 24, in half hours (for example 7.5).";
  const QUALITY = "Choose how well you slept, from 1 (very poorly) to 5 (very well).";
  const BOTH = "Enter both bedtime and wake-up time, or neither.";
  const TIME = "Enter times as HH:MM, for example 23:30.";
  const cases = [
    [{ ...sleep7, hours: -1 }, HOURS], [{ ...sleep7, hours: 24.5 }, HOURS], [{ ...sleep7, hours: 7.25 }, HOURS],
    [{ ...sleep7, hours: "7" }, HOURS], [{ quality: 3 }, HOURS],
    [{ ...sleep7, quality: 0 }, QUALITY], [{ ...sleep7, quality: 6 }, QUALITY], [{ ...sleep7, quality: 3.5 }, QUALITY], [{ hours: 7 }, QUALITY],
    [{ bedtime: "23:00", quality: 3 }, BOTH], [{ wakeTime: "07:00", hours: 8, quality: 3 }, BOTH], [{ bedtime: "", wakeTime: "07:00", quality: 3 }, BOTH],
    [{ bedtime: "24:00", wakeTime: "07:00", quality: 3 }, TIME], [{ bedtime: "23:60", wakeTime: "07:00", quality: 3 }, TIME],
    [{ bedtime: "11pm", wakeTime: "07:00", quality: 3 }, TIME], [{ bedtime: "7:00", wakeTime: "23:00", quality: 3 }, TIME],
    [{ bedtime: 2300, wakeTime: "07:00", quality: 3 }, TIME],
    [{ bedtime: "23:00", wakeTime: "23:00", quality: 3 }, "Bedtime and wake-up time can't be the same. Enter the hours slept instead."],
    [{ bedtime: "23:00", wakeTime: "07:00" }, QUALITY],
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

test("history lists the last 7, 14 or 30 days, oldest first, with gaps as null", async () => {
  const cookie = token(await user());
  await setGoal(cookie, limit);
  await addDrink(cookie, 250); await addDrink(cookie, 500);
  const account = await User.findOne();
  const drinks = (ml) => ({ totalMl: ml, entries: [{ ml, at: new Date() }] });
  await HydrationEntry.create({ owner: account._id, profileId: account._id, date: new Date(day(-3)), ...drinks(1500) });
  await HydrationEntry.create({ owner: account._id, profileId: account._id, date: new Date(day(-9)), ...drinks(1000) });
  // Every drink undone: nothing logged that day.
  await HydrationEntry.create({ owner: account._id, profileId: account._id, date: new Date(day(-2)), totalMl: 0, entries: [] });
  await logSleep(cookie, sleep7, { date: day(-1) });
  await logSleep(cookie, { bedtime: "23:00", wakeTime: "06:00", quality: 2 }, { date: day(-12) });
  await logSleep(cookie, { hours: 5, quality: 2 }, { date: day(-20) });

  const week = await history(cookie);
  assert.equal(week.status, 200);
  assert.deepEqual(week.body.goal, limit);
  assert.deepEqual(week.body.days.map((d) => d.date), [-6, -5, -4, -3, -2, -1, 0].map(day));
  assert.deepEqual(week.body.days.map((d) => d.totalMl), [null, null, null, 1500, null, null, 750]);
  assert.deepEqual(week.body.days.map((d) => d.sleep && d.sleep.hours), [null, null, null, null, null, 7.5, null]);

  const fortnight = await history(cookie, 14);
  assert.equal(fortnight.body.days.length, 14);
  assert.equal(fortnight.body.days[0].date, day(-13));
  assert.deepEqual(fortnight.body.days.filter((d) => d.totalMl !== null).map((d) => d.totalMl), [1000, 1500, 750]);
  assert.deepEqual(fortnight.body.days[1].sleep, { date: day(-12), hours: 7, bedtime: "23:00", wakeTime: "06:00", quality: 2, note: "" });

  const month = await history(cookie, 30);
  assert.equal(month.body.days.length, 30);
  assert.equal(month.body.days[0].date, day(-29));
  assert.equal(month.body.days.filter((d) => d.sleep).length, 3);

  assert.equal((await request("GET", `/wellbeing/history?days=10&end=${TODAY}`, { cookie })).status, 400);
  assert.equal((await request("GET", `/wellbeing/history?days=7&end=${day(-10)}`, { cookie })).status, 400);
});

test("a caregiver tracks a dependent's water and sleep, kept apart from their own", async () => {
  const cookie = token(await user());
  const childId = await dependent(cookie);
  await addDrink(cookie, 250, { profileId: childId }); await addDrink(cookie, 200, { profileId: childId });
  await addDrink(cookie, 500);
  await setGoal(cookie, { type: "atLeast", ml: 1200 }, childId);
  await logSleep(cookie, { hours: 10, quality: 5 }, { profileId: childId });

  const child = (await today(cookie, childId)).body;
  assert.equal(child.water.totalMl, 450);
  assert.deepEqual(child.water.goal, { type: "atLeast", ml: 1200 });
  assert.equal(child.sleep.hours, 10);
  const own = (await today(cookie)).body;
  assert.equal(own.water.totalMl, 500);
  assert.equal(own.water.goal, null);
  assert.equal(own.sleep, null);

  assert.equal((await undoDrink(cookie, childId)).body.water.totalMl, 250);
  assert.equal((await today(cookie)).body.water.totalMl, 500, "undo only touches the profile it names");
  assert.equal((await request("DELETE", withProfile(`/wellbeing/sleep/${TODAY}`, childId), { cookie })).status, 204);
  assert.equal((await history(cookie, 7, childId)).body.days.at(-1).totalMl, 250);
});

test("nobody can reach another user's water, sleep or dependent", async () => {
  const parent = token(await user());
  const stranger = token(await user("stranger@example.test"));
  const childId = await dependent(parent);
  await addDrink(parent, 250, { profileId: childId });
  await logSleep(parent, sleep7, { profileId: childId });
  await addDrink(parent, 250);

  const attempts = [
    ["GET", `/wellbeing/today?date=${TODAY}`, undefined], ["POST", "/wellbeing/water/entries", { date: TODAY, ml: 250 }],
    ["DELETE", `/wellbeing/water/entries/last?date=${TODAY}`, undefined], ["PUT", "/wellbeing/water/goal", limit],
    ["DELETE", "/wellbeing/water/goal", undefined], ["PUT", `/wellbeing/sleep/${TODAY}`, sleep7],
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
  assert.equal((await today(stranger)).body.water.totalMl, 0);
  assert.equal((await today(parent, childId)).body.water.totalMl, 250);
  assert.equal((await today(parent, childId)).body.sleep.hours, 7.5);
  assert.equal((await today(parent)).body.water.totalMl, 250);
});

test("never writes amounts, goals, hours, times, quality or notes to the logs", async () => {
  const cookie = token(await user());
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = function (chunk, ...rest) { written.push(String(chunk)); return original.call(this, chunk, ...rest); };
  try {
    await setGoal(cookie, { type: "atMost", ml: 1700 });
    await setGoal(cookie, { type: "atMost", ml: 99999 });
    await addDrink(cookie, 330);
    await addDrink(cookie, 99999);
    await undoDrink(cookie);
    await logSleep(cookie, { hours: 13.5, quality: 4, note: "Privatesleepnote" });
    await logSleep(cookie, { bedtime: "22:17", wakeTime: "06:43", quality: 4, note: "Privatesleepnote" });
    await logSleep(cookie, { hours: 99, quality: 4, note: "Privatesleepnote" });
    await today(cookie);
    await history(cookie);
  } finally { process.stdout.write = original; }
  const logs = written.join("");
  assert.match(logs, /http_request/);
  // Numbers can't be checked: any number may turn up by chance in a timestamp ("10:13:13.512Z"), a duration
  // or a request id. So look for the note, the goal type and the field names, which only appear if the data is logged.
  for (const value of ["Privatesleepnote", "atMost", "\"ml\"", "totalMl", "\"hours\"", "bedtime", "wakeTime", "\"quality\"", "\"goal\"", "waterGoal"]) {
    assert.ok(!logs.includes(value), `log contains ${value}`);
  }
});

test("writes are rate-limited per account", async () => {
  const cookie = token(await user());
  for (let i = 0; i < 300; i++) assert.notEqual((await undoDrink(cookie)).status, 429);
  const limited = await addDrink(cookie);
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /Too many changes/);
  assert.equal((await today(cookie)).status, 200, "reading is not limited");
  assert.equal((await addDrink(token(await user("second@example.test")))).status, 200, "another account is not affected");
});

test("removing a dependent deletes their water, sleep and goal, and nobody else's", async () => {
  const cookie = token(await user());
  const other = token(await user("other@example.test"));
  const childId = await dependent(cookie, "Child");
  const siblingId = await dependent(cookie, "Sibling");
  for (const profileId of [childId, siblingId, undefined]) {
    await addDrink(cookie, 250, { profileId });
    await logSleep(cookie, sleep7, { profileId });
    await setGoal(cookie, limit, profileId);
  }
  await addDrink(other); await logSleep(other, sleep7);

  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie: other })).status, 404);
  assert.equal((await request("DELETE", `/profile/linked/${childId}`, { cookie })).status, 204);
  for (const Model of [HydrationEntry, SleepEntry, WellbeingSettings]) {
    assert.equal(await Model.countDocuments({ profileId: childId }), 0, Model.modelName);
    assert.equal(await Model.countDocuments({ profileId: siblingId }), 1, Model.modelName);
  }
  assert.equal((await today(cookie)).body.water.totalMl, 250);
  assert.equal((await today(other)).body.water.totalMl, 250);
  assert.equal((await today(cookie, childId)).status, 404);
});

test("deleting the account deletes its own and every dependent's water, sleep and goals", async () => {
  const account = await user(); const cookie = token(account);
  const other = token(await user("other@example.test"));
  const childId = await dependent(cookie);
  for (const profileId of [childId, undefined]) {
    await addDrink(cookie, 250, { profileId });
    await logSleep(cookie, sleep7, { profileId });
    await setGoal(cookie, limit, profileId);
  }
  await addDrink(other); await logSleep(other, sleep7);
  assert.equal((await request("DELETE", "/profile/me", { cookie, body: { confirm: "DELETE", password } })).status, 204);
  for (const Model of [HydrationEntry, SleepEntry, WellbeingSettings]) {
    assert.equal(await Model.countDocuments({ owner: account._id }), 0, Model.modelName);
  }
  assert.equal(await HydrationEntry.countDocuments(), 1);
  assert.equal(await SleepEntry.countDocuments(), 1);
});

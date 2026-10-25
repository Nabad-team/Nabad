const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const { HydrationEntry, WellbeingSettings } = require("../src/models/Wellbeing");
const { migrateFluidsToMl } = require("../src/migrations/fluidsInMl");

// Water counted in glasses becomes millilitres (one glass = 250 ml), and a goal in glasses becomes
// "Drink at least" in millilitres. The old documents are written straight to the collections, as they are in production.
let mongod;
before(async () => {
  mongod = await createTestMongo();
  await mongoose.connect(mongod.getUri());
  await Promise.all([HydrationEntry.init(), WellbeingSettings.init()]);
}, { timeout: 240000 });
after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => {
  await Promise.all([HydrationEntry.collection.deleteMany({}), WellbeingSettings.collection.deleteMany({})]);
});

const owner = new mongoose.Types.ObjectId();
const child = new mongoose.Types.ObjectId();
const changedAt = new Date("2026-10-12T18:45:00Z");
const day = (date, fields) => ({ owner, profileId: owner, date: new Date(date), createdAt: changedAt, updatedAt: changedAt, ...fields });
const plain = (doc) => doc.toObject({ versionKey: false });

test("converts each day's glasses into one drink of glasses × 250 ml, at the time the day was last changed", async () => {
  await HydrationEntry.collection.insertMany([
    day("2026-10-12", { glasses: 6 }),
    day("2026-10-11", { glasses: 1, profileId: child }),
    day("2026-10-10", { glasses: 0 }),
    day("2026-10-09", { glasses: 30, updatedAt: undefined }),
  ]);
  assert.deepEqual(await migrateFluidsToMl(), { days: 4, goals: 0 });

  const days = await HydrationEntry.find().sort({ date: -1 });
  assert.deepEqual(days.map((d) => d.totalMl), [1500, 250, 0, 7500]);
  assert.deepEqual(plain(days[0]).entries, [{ ml: 1500, at: changedAt }]);
  assert.equal(String(days[1].profileId), String(child), "stays on its own profile");
  assert.deepEqual(plain(days[2]).entries, [], "a day of 0 glasses has no drinks");
  assert.deepEqual(plain(days[3]).entries, [{ ml: 7500, at: new Date("2026-10-09") }], "without updatedAt, the day itself");
  assert.equal(await HydrationEntry.collection.countDocuments({ glasses: { $exists: true } }), 0, "the old field is gone");
});

test("adds to drinks already logged in millilitres on the same day", async () => {
  const at = new Date("2026-10-12T08:00:00Z");
  await HydrationEntry.collection.insertOne(day("2026-10-12", { glasses: 2, totalMl: 330, entries: [{ ml: 330, at }] }));
  await migrateFluidsToMl();
  const entry = plain(await HydrationEntry.findOne());
  assert.equal(entry.totalMl, 830);
  assert.deepEqual(entry.entries, [{ ml: 500, at: changedAt }, { ml: 330, at }]);
});

test("converts a goal in glasses into \"Drink at least\" glasses × 250 ml, and no goal stays no goal", async () => {
  await WellbeingSettings.collection.insertMany([
    { owner, profileId: owner, waterTarget: 8 },
    { owner, profileId: child, waterTarget: null },
    { owner: child, profileId: child },
  ]);
  assert.deepEqual(await migrateFluidsToMl(), { days: 0, goals: 2 });
  const settings = await WellbeingSettings.find().sort({ _id: 1 });
  assert.deepEqual(settings.map((s) => s.waterGoal && plain(s).waterGoal), [{ type: "atLeast", ml: 2000 }, null, null]);
  assert.equal(await WellbeingSettings.collection.countDocuments({ waterTarget: { $exists: true } }), 0);
});

test("is idempotent: running it again, or after it stopped halfway, changes nothing more", async () => {
  await HydrationEntry.collection.insertMany([day("2026-10-12", { glasses: 4 }), day("2026-10-11", { glasses: 3 })]);
  await WellbeingSettings.collection.insertOne({ owner, profileId: owner, waterTarget: 6 });
  await migrateFluidsToMl();
  const once = (await HydrationEntry.find().sort({ date: 1 })).map(plain);
  const goal = plain(await WellbeingSettings.findOne()).waterGoal;

  assert.deepEqual(await migrateFluidsToMl(), { days: 0, goals: 0 });
  assert.deepEqual(await migrateFluidsToMl(), { days: 0, goals: 0 });
  assert.deepEqual((await HydrationEntry.find().sort({ date: 1 })).map(plain), once);
  assert.deepEqual(plain(await WellbeingSettings.findOne()).waterGoal, goal);
  assert.deepEqual(once.map((d) => d.totalMl), [750, 1000]);

  // A day that was still in glasses (a run that stopped halfway) is converted; the others stay as they are.
  await HydrationEntry.collection.insertOne(day("2026-10-10", { glasses: 2 }));
  assert.deepEqual(await migrateFluidsToMl(), { days: 1, goals: 0 });
  assert.deepEqual((await HydrationEntry.find().sort({ date: 1 })).map((d) => d.totalMl), [500, 750, 1000]);
});

test("does nothing on a database with no old data", async () => {
  assert.deepEqual(await migrateFluidsToMl(), { days: 0, goals: 0 });
  await HydrationEntry.create({ owner, profileId: owner, date: new Date("2026-10-12"), totalMl: 250, entries: [{ ml: 250, at: changedAt }] });
  assert.deepEqual(await migrateFluidsToMl(), { days: 0, goals: 0 });
  assert.equal((await HydrationEntry.findOne()).totalMl, 250);
});

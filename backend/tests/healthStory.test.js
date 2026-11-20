// SCRUM-332: "My health story": a month-by-month timeline on /my-history of symptom checks, appointments, medication
// changes, documents and vitals, with links (extends SCRUM-156).
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const { buildHealthStory, readStoryQuery, shiftMonth } = require("../src/healthStory");

describe("reading the query", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  test("defaults: 6 months up to this month, in Beirut time", () => {
    assert.deepEqual(readStoryQuery({}, now).value, { timeZone: "Asia/Beirut", months: 6, until: "2026-11" });
  });
  test("this month is the person's own month: late on 31 October in UTC is already November in Beirut", () => {
    assert.equal(readStoryQuery({}, new Date("2026-10-31T23:30:00Z")).value.until, "2026-11");
    assert.equal(readStoryQuery({ timeZone: "UTC" }, new Date("2026-10-31T23:30:00Z")).value.until, "2026-10");
  });
  test("checks months, until and the time zone; a future month becomes this month", () => {
    assert.deepEqual(readStoryQuery({ months: "3", until: "2026-02", timeZone: "Europe/Paris" }, now).value, { timeZone: "Europe/Paris", months: 3, until: "2026-02" });
    assert.equal(readStoryQuery({ until: "2030-01" }, now).value.until, "2026-11");
    for (const query of [{ months: "0" }, { months: "13" }, { months: "2.5" }, { months: "abc" }, { until: "2026-13" }, { until: "2026-1" }, { until: "1999-12" }, { until: ["2026-01"] }, { timeZone: "Mars/Olympus" }]) {
      assert.ok(readStoryQuery(query, now).error, JSON.stringify(query));
    }
  });
  test("months shift across years", () => {
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(shiftMonth("2026-06", -5), "2026-01");
    assert.equal(shiftMonth("2025-12", 1), "2026-01");
  });
});

describe("building the story", () => {
  let mongo, models, owner, profileId, child;
  const now = new Date("2026-11-20T10:00:00Z");
  before(async () => {
    mongo = await createTestMongo();
    await mongoose.connect(mongo.getUri());
    models = {
      SymptomRecord: require("../src/models/SymptomRecord"), Appointment: require("../src/models/Appointment"),
      Medication: require("../src/models/Medication"), MedicalDocument: require("../src/models/MedicalDocument"),
      VitalReading: require("../src/models/VitalReading"),
    };
  }, { timeout: 240000 });
  after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
  beforeEach(async () => {
    await Promise.all(Object.values(models).map((Model) => Model.deleteMany({})));
    owner = new mongoose.Types.ObjectId();
    profileId = owner;
    child = new mongoose.Types.ObjectId();
    const mine = { owner, profileId };
    await models.SymptomRecord.create([
      { ...mine, description: "bad headache behind my eyes", urgencyResult: { level: "soon", label: "See a doctor soon" }, createdAt: new Date("2026-11-03T09:00:00Z") },
      // 23:30 on 31 October in UTC is 1 November in Beirut.
      { ...mine, description: "chest pain when climbing stairs", urgencyResult: { level: "urgent", label: "Urgent" }, createdAt: new Date("2026-10-31T23:30:00Z") },
      { ...mine, description: "sore throat", urgencyResult: { level: "routine", label: "Routine / self-care" }, createdAt: new Date("2026-09-10T08:00:00Z") },
      { ...mine, description: "a very old cough", urgencyResult: { level: "routine", label: "Routine / self-care" }, createdAt: new Date("2026-02-01T08:00:00Z") },
    ]);
    await models.Appointment.create([
      { ...mine, title: "Cardiology follow-up", hospital: "AUBMC", location: "Hamra", appointmentDate: "2026-11-25", appointmentTime: "10:30" },
      { ...mine, title: "GP visit", hospital: "Clinic", appointmentDate: "2026-10-05", appointmentTime: "09:00" },
    ]);
    await models.Medication.create([
      { ...mine, name: "Amoxicillin", dose: "500", unit: "mg", frequency: "3 times a day", startDate: new Date("2026-09-10T00:00:00Z"), endDate: new Date("2026-09-17T00:00:00Z"), status: "discontinued" },
      { ...mine, name: "Atorvastatin", dose: "20", unit: "mg", startDate: new Date("2026-10-06T00:00:00Z") },
      // Started long ago, nothing in the window.
      { ...mine, name: "Ventolin", startDate: new Date("2025-01-01T00:00:00Z") },
    ]);
    await models.MedicalDocument.create([
      { ...mine, filename: "lipids.pdf", mimeType: "application/pdf", documentType: "lab", documentDate: new Date("2026-10-04T00:00:00Z"), size: 3, data: Buffer.from("PDF") },
      { ...mine, filename: "letter.pdf", mimeType: "application/pdf", documentType: "letter", documentDate: null, size: 3, data: Buffer.from("PDF"), createdAt: new Date("2026-11-02T12:00:00Z") },
    ]);
    await models.VitalReading.create([
      { ...mine, recordedAt: new Date("2026-11-04T06:00:00Z"), systolic: 150, diastolic: 95, heartRate: 88 },
      { ...mine, recordedAt: new Date("2026-11-04T16:00:00Z"), systolic: 138, diastolic: 88 },
      { ...mine, recordedAt: new Date("2026-11-04T17:00:00Z"), temperature: 37.9 },
      { ...mine, recordedAt: new Date("2026-10-20T06:00:00Z"), heartRate: 70 },
    ]);
    // Another profile's records never appear.
    await models.SymptomRecord.create({ owner, profileId: child, description: "child's fever", urgencyResult: { level: "soon", label: "See a doctor soon" }, createdAt: new Date("2026-11-05T09:00:00Z") });
    await models.VitalReading.create({ owner: new mongoose.Types.ObjectId(), profileId: owner, recordedAt: new Date("2026-11-06T09:00:00Z"), heartRate: 99 });
  });

  test("lists the months that have something, newest first, each with its events newest first", async () => {
    const story = await buildHealthStory({ owner, profileId, timeZone: "Asia/Beirut", now });
    assert.equal(story.from, "2026-06");
    assert.equal(story.until, "2026-11");
    assert.deepEqual(story.months.map((month) => month.label), ["November 2026", "October 2026", "September 2026"]);
    const november = story.months[0];
    assert.deepEqual(november.events.map((event) => [event.day, event.type, event.title]), [
      ["2026-11-25", "appointment", "Cardiology follow-up"],
      ["2026-11-04", "vitals", "3 vitals readings"],
      ["2026-11-03", "symptom-check", "Symptom check"],
      ["2026-11-02", "document", "letter.pdf"],
      ["2026-11-01", "symptom-check", "Symptom check"],
    ]);
    assert.deepEqual(november.counts, { "symptom-check": 2, appointment: 1, medication: 0, document: 1, vitals: 1 });
    assert.deepEqual(story.counts, { "symptom-check": 3, appointment: 2, medication: 3, document: 2, vitals: 2 });
  });

  test("each event says what it was and links to where it lives", async () => {
    const story = await buildHealthStory({ owner, profileId, timeZone: "Asia/Beirut", now });
    const events = story.months.flatMap((month) => month.events);
    const find = (title) => events.find((event) => event.title === title);

    const visit = find("Cardiology follow-up");
    assert.equal(visit.badge, "Upcoming");
    assert.equal(visit.detail, "AUBMC, Hamra");
    assert.equal(visit.time, "10:30");
    assert.match(visit.href, /^\/appointments#appointment-[a-f0-9]{24}$/);

    const chest = events.find((event) => event.detail === "chest pain when climbing stairs");
    assert.equal(chest.day, "2026-11-01");
    assert.equal(chest.time, "01:30");
    assert.equal(chest.badge, "Urgent");
    assert.equal(chest.attention, true);
    assert.equal(chest.href, "/symptoms");
    assert.equal(events.find((event) => event.detail === "bad headache behind my eyes").attention, false);

    assert.deepEqual(events.filter((event) => event.type === "medication").map((event) => [event.day, event.title, event.detail]), [
      ["2026-10-06", "Started Atorvastatin", "20 mg"],
      ["2026-09-17", "Stopped Amoxicillin", "500 mg, 3 times a day"],
      ["2026-09-10", "Started Amoxicillin", "500 mg, 3 times a day"],
    ]);
    assert.match(find("Started Atorvastatin").href, /^\/medications#medication-[a-f0-9]{24}$/);

    assert.equal(find("lipids.pdf").detail, "Lab result");
    assert.equal(find("letter.pdf").detail, "Letter, date not given (day uploaded)");
    assert.match(find("lipids.pdf").href, /^\/medical-documents#document-[a-f0-9]{24}$/);

    // A day of vitals: the latest of each value, one event.
    const vitals = find("3 vitals readings");
    assert.equal(vitals.detail, "Latest: Blood pressure 138/88, heart rate 88, temperature 37.9 °C");
    assert.equal(vitals.href, "/vitals");
    assert.equal(find("Vitals recorded").detail, "heart rate 70");
  });

  test("an end date still to come is planned, not stopped", async () => {
    await models.Medication.create({ owner, profileId, name: "Prednisolone", dose: "5", unit: "mg", startDate: new Date("2026-11-15T00:00:00Z"), endDate: new Date("2026-11-28T00:00:00Z") });
    const story = await buildHealthStory({ owner, profileId, timeZone: "Asia/Beirut", now });
    const events = story.months[0].events.filter((event) => event.type === "medication");
    assert.deepEqual(events.map((event) => [event.day, event.title, event.badge]), [
      ["2026-11-28", "Stops Prednisolone", "Planned"],
      ["2026-11-15", "Started Prednisolone", ""],
    ]);
  });

  test("only this profile of this account: a family member's and another account's records stay out", async () => {
    const story = await buildHealthStory({ owner, profileId, timeZone: "Asia/Beirut", now });
    const text = JSON.stringify(story);
    assert.doesNotMatch(text, /child's fever/);
    assert.doesNotMatch(text, /heart rate 99/);
    const childStory = await buildHealthStory({ owner, profileId: child, timeZone: "Asia/Beirut", now });
    assert.deepEqual(childStory.months.flatMap((month) => month.events).map((event) => event.detail), ["child's fever"]);
    assert.equal(childStory.hasEarlier, false);
  });

  test("says when there is more before the window, and where to continue", async () => {
    const story = await buildHealthStory({ owner, profileId, timeZone: "Asia/Beirut", now });
    assert.equal(story.hasEarlier, true);
    assert.equal(story.earlierUntil, "2026-05");
    const earlier = await buildHealthStory({ owner, profileId, timeZone: "Asia/Beirut", now, until: "2026-05", months: 6 });
    assert.deepEqual(earlier.months.map((month) => month.label), ["February 2026"]);
    // Ventolin's start in January 2025 is still earlier.
    assert.equal(earlier.hasEarlier, true);
    const earliest = await buildHealthStory({ owner, profileId, timeZone: "Asia/Beirut", now, until: "2025-01", months: 1 });
    assert.deepEqual(earliest.months[0].events.map((event) => event.title), ["Started Ventolin"]);
    assert.equal(earliest.hasEarlier, false);
    assert.equal(earliest.earlierUntil, null);
  });

  test("an empty profile has an empty story", async () => {
    const story = await buildHealthStory({ owner: new mongoose.Types.ObjectId(), profileId: new mongoose.Types.ObjectId(), now });
    assert.deepEqual(story.months, []);
    assert.equal(story.hasEarlier, false);
    assert.equal(story.truncated, false);
  });
});

describe("GET /api/history/timeline", () => {
  let mongo, server, base, user, cookie, otherCookie, child;
  before(async () => {
    process.env.NODE_ENV = "test"; process.env.APP_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    mongo = await createTestMongo();
    process.env.MONGO_URI = mongo.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    const User = require("../src/models/User");
    const LinkedProfile = require("../src/models/LinkedProfile");
    user = await User.create({ name: "Rana", email: "story@example.test", passwordHash: "x" });
    const other = await User.create({ name: "Sami", email: "other-story@example.test", passwordHash: "x" });
    child = await LinkedProfile.create({ owner: user._id, fullName: "Lina", dateOfBirth: new Date("2018-03-02"), relationship: "child" });
    cookie = `accessToken=${jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" })}`;
    otherCookie = `accessToken=${jwt.sign({ sub: String(other._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" })}`;
    await require("../src/models/SymptomRecord").create({ owner: user._id, profileId: child._id, description: "Lina's rash", urgencyResult: { level: "soon", label: "See a doctor soon" } });
    server = require("../src/app").createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/history/timeline`;
  }, { timeout: 240000 });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });
  const get = (query, who = cookie) => fetch(`${base}${query}`, { headers: who ? { Cookie: who } : {} });

  test("answers for the chosen profile", async () => {
    const response = await get(`?profileId=${child._id}&timeZone=Asia/Beirut`);
    assert.equal(response.status, 200);
    const story = await response.json();
    assert.equal(story.months[0].events[0].detail, "Lina's rash");
    const own = await (await get("?profileId=self")).json();
    assert.deepEqual(own.months, []);
  });

  test("needs sign-in, checks the query, and hides other accounts' profiles", async () => {
    assert.equal((await get("", null)).status, 401);
    assert.equal((await get("?months=40")).status, 400);
    assert.equal((await get("?until=nope")).status, 400);
    assert.equal((await get("?timeZone=Nowhere/Land")).status, 400);
    assert.equal((await get(`?profileId=${child._id}`, otherCookie)).status, 404);
  });
});

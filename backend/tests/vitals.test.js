const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { createTestMongo } = require("./helpers/testMongo");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const VitalReading = require("../src/models/VitalReading");

let mongod, server, base, passwordHash;
before(async () => {
  process.env.NODE_ENV = "test"; process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex"); process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await createTestMongo(); process.env.MONGO_URI = mongod.getUri(); await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), VitalReading.init()]); passwordHash = await bcrypt.hash("Vitals test password 123!", 12);
  server = require("../src/app").createApp().listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/vitals`;
}, { timeout: 240000 });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (mongod) await mongod.stop(); });
beforeEach(async () => Promise.all([User, LinkedProfile, VitalReading].map(Model => Model.deleteMany({}))));

async function account(email) { return User.create({ name: "Owner", email, passwordHash }); }
const token = user => jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
async function call(method, path, cookie, body) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${cookie}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); return { status: response.status, body: text ? JSON.parse(text) : null };
}
const reading = overrides => ({ heartRate: 72, recordedAt: new Date(Date.now() - 60000).toISOString(), ...overrides });

test("creates, lists by range and deletes a reading", async () => {
  const cookie = token(await account("vitals@example.test"));
  const created = await call("POST", "?profileId=self", cookie, reading({ systolic: 120, diastolic: 80, temperature: 36.7 }));
  assert.equal(created.status, 201); assert.equal(created.body.reading.systolic, 120);
  const listed = await call("GET", "?profileId=self&range=7", cookie);
  assert.equal(listed.status, 200); assert.equal(listed.body.readings.length, 1);
  assert.equal((await call("DELETE", `/${created.body.reading.id}?profileId=self`, cookie)).status, 204);
  assert.deepEqual((await call("GET", "?profileId=self&range=all", cookie)).body.readings, []);
});

test("keeps the account owner and linked profiles separate", async () => {
  const owner = await account("family@example.test"), cookie = token(owner);
  const child = await LinkedProfile.create({ owner: owner._id, fullName: "Child", relationship: "child", dateOfBirth: new Date("2015-01-01") });
  await call("POST", "?profileId=self", cookie, reading({ heartRate: 70 }));
  await call("POST", `?profileId=${child._id}`, cookie, reading({ heartRate: 90 }));
  assert.deepEqual((await call("GET", "?profileId=self&range=all", cookie)).body.readings.map(item => item.heartRate), [70]);
  assert.deepEqual((await call("GET", `?profileId=${child._id}&range=all`, cookie)).body.readings.map(item => item.heartRate), [90]);
  const stranger = token(await account("stranger@example.test"));
  assert.equal((await call("GET", `?profileId=${child._id}&range=all`, stranger)).status, 404);
});

test("validates range, values and authentication", async () => {
  const cookie = token(await account("validation@example.test"));
  assert.equal((await call("GET", "?profileId=self&range=365", cookie)).status, 400);
  assert.equal((await call("POST", "?profileId=self", cookie, reading({ heartRate: 500 }))).status, 400);
  const response = await fetch(base + "?profileId=self&range=7");
  assert.equal(response.status, 401);
});

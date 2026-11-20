// SCRUM-333: "Questions for my doctor": save a question at any time and see it in visit preparation, the shared
// doctor link and the printout. The link and the printout are built in the browser from the visit sheet
// (frontend/__tests__/visit-prep.test.js); here: saving, editing, removing, limits, profiles and the data export.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createTestMongo } = require("./helpers/testMongo");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const VisitPrep = require("../src/models/VisitPrep");

let mongod, server, base, passwordHash;
before(async () => {
  process.env.NODE_ENV = "test"; process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex"); process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await createTestMongo(); process.env.MONGO_URI = mongod.getUri(); await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), VisitPrep.init()]);
  passwordHash = await bcrypt.hash("Doctor questions password 123!", 12);
  const { createApp } = require("../src/app"); server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve)); base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); if (mongod) await mongod.stop(); });
beforeEach(async () => { await Promise.all([User, LinkedProfile, VisitPrep].map((Model) => Model.deleteMany({}))); });

async function account(email) {
  const user = await User.create({ name: "Rana", email, passwordHash });
  return { user, cookie: jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }) };
}
async function request(method, path, { cookie, body, origin = process.env.CLIENT_ORIGIN } = {}) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let parsed = text; try { parsed = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, body: parsed };
}

test("saves a question at any time, before any visit sheet exists, and lists it with the sheet", async () => {
  const rana = await account("rana@example.test");
  const empty = await request("GET", "/visit-prep?profileId=self", { cookie: rana.cookie });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.questions, []);

  const saved = await request("POST", "/visit-prep/questions?profileId=self", { cookie: rana.cookie, body: { text: "  Should I keep taking   ibuprofen\nwith my inhaler?  " } });
  assert.equal(saved.status, 201);
  // Extra spaces and line breaks are folded into one line.
  assert.equal(saved.body.question.text, "Should I keep taking ibuprofen with my inhaler?");
  assert.match(saved.body.question.id, /^[a-f0-9]{24}$/);
  assert.ok(Date.parse(saved.body.question.createdAt));

  await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "Do I need a blood test?" } });
  const sheet = await request("GET", "/visit-prep?profileId=self", { cookie: rana.cookie });
  // Oldest first: the order they were thought of.
  assert.deepEqual(sheet.body.questions.map((question) => question.text), ["Should I keep taking ibuprofen with my inhaler?", "Do I need a blood test?"]);
  assert.deepEqual(sheet.body.notes, "");
  assert.deepEqual(sheet.body.documentIds, []);
});

test("saving the rest of the visit sheet keeps the questions", async () => {
  const rana = await account("sheet@example.test");
  await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "Is my cough related to the new medicine?" } });
  const put = await request("PUT", "/visit-prep", { cookie: rana.cookie, body: { overrides: { symptoms: "Cough for 2 weeks" }, notes: "Bring the inhaler", documentIds: [] } });
  assert.equal(put.status, 200);
  assert.deepEqual(put.body.questions.map((question) => question.text), ["Is my cough related to the new medicine?"]);
  assert.equal(put.body.notes, "Bring the inhaler");
});

test("edits and removes a question", async () => {
  const rana = await account("edit@example.test");
  const first = await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "Whta about my sleep?" } });
  await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "Can I travel next month?" } });
  const id = first.body.question.id;

  const edited = await request("PATCH", `/visit-prep/questions/${id}`, { cookie: rana.cookie, body: { text: "What about my sleep?" } });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.question.text, "What about my sleep?");
  assert.deepEqual(edited.body.questions.map((question) => question.text), ["What about my sleep?", "Can I travel next month?"]);

  const removed = await request("DELETE", `/visit-prep/questions/${id}`, { cookie: rana.cookie });
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.questions.map((question) => question.text), ["Can I travel next month?"]);
  assert.equal((await request("DELETE", `/visit-prep/questions/${id}`, { cookie: rana.cookie })).status, 404);
  assert.equal((await request("PATCH", "/visit-prep/questions/not-an-id", { cookie: rana.cookie, body: { text: "Hello?" } })).status, 404);
});

test("rejects empty, too long and malformed questions", async () => {
  const rana = await account("limits@example.test");
  for (const body of [{}, { text: "" }, { text: "    " }, { text: 42 }, { text: "x".repeat(301) }, { text: ["a"] }]) {
    const response = await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.body.error, "Write a question of up to 300 characters.");
  }
  assert.equal((await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "x".repeat(300) } })).status, 201);
  const saved = await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "ok?" } });
  const badEdit = await request("PATCH", `/visit-prep/questions/${saved.body.question.id}`, { cookie: rana.cookie, body: { text: " " } });
  assert.equal(badEdit.status, 400);
});

test("keeps at most 30 questions per profile, even when saved at the same moment", async () => {
  const rana = await account("thirty@example.test");
  const responses = await Promise.all(Array.from({ length: 34 }, (_, index) => request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: `Question ${index + 1}?` } })));
  assert.equal(responses.filter((response) => response.status === 201).length, 30);
  const refused = responses.find((response) => response.status === 400);
  assert.match(refused.body.error, /up to 30 questions/);
  assert.equal((await VisitPrep.findOne({ owner: rana.user._id })).questions.length, 30);
});

test("questions belong to one profile of one account: others answer 404 or see nothing", async () => {
  const rana = await account("owner@example.test");
  const other = await account("other@example.test");
  const child = await LinkedProfile.create({ owner: rana.user._id, fullName: "Lina", dateOfBirth: new Date("2018-03-02"), relationship: "child" });

  const own = await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "My own question?" } });
  const forChild = await request("POST", `/visit-prep/questions?profileId=${child._id}`, { cookie: rana.cookie, body: { text: "Is Lina's rash normal?" } });
  assert.equal(forChild.status, 201);

  assert.deepEqual((await request("GET", "/visit-prep", { cookie: rana.cookie })).body.questions.map((question) => question.text), ["My own question?"]);
  assert.deepEqual((await request("GET", `/visit-prep?profileId=${child._id}`, { cookie: rana.cookie })).body.questions.map((question) => question.text), ["Is Lina's rash normal?"]);

  // Another account can't reach Rana's child, or Rana's own questions by id.
  assert.equal((await request("POST", `/visit-prep/questions?profileId=${child._id}`, { cookie: other.cookie, body: { text: "Hi?" } })).status, 404);
  assert.equal((await request("DELETE", `/visit-prep/questions/${own.body.question.id}`, { cookie: other.cookie })).status, 404);
  assert.equal((await request("PATCH", `/visit-prep/questions/${own.body.question.id}`, { cookie: other.cookie, body: { text: "Changed?" } })).status, 404);
  // Nor from the wrong profile of the same account.
  assert.equal((await request("DELETE", `/visit-prep/questions/${own.body.question.id}?profileId=${child._id}`, { cookie: rana.cookie })).status, 404);
  assert.deepEqual((await request("GET", "/visit-prep", { cookie: other.cookie })).body.questions, []);
});

test("needs sign-in and the site's origin", async () => {
  const rana = await account("auth@example.test");
  assert.equal((await request("POST", "/visit-prep/questions", { body: { text: "Hello?" } })).status, 401);
  assert.equal((await request("POST", "/visit-prep/questions", { cookie: rana.cookie, origin: "https://evil.test", body: { text: "Hello?" } })).status, 403);
  assert.equal(await VisitPrep.countDocuments(), 0);
});

test("questions are in Download my data", async () => {
  const rana = await account("export@example.test");
  await request("POST", "/visit-prep/questions", { cookie: rana.cookie, body: { text: "What does my lab result mean?" } });
  const { buildExport } = require("../src/dataExport");
  const exported = await buildExport(rana.user._id);
  const self = exported.profiles[0];
  const questions = self.visitPreparation.questionsForMyDoctor;
  assert.equal(questions.length, 1);
  assert.equal(questions[0].text, "What does my lab result mean?");
  assert.deepEqual(Object.keys(questions[0]).sort(), ["createdAt", "id", "text", "updatedAt"]);
});

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createTestMongo } = require("./helpers/testMongo");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const MedicalDocument = require("../src/models/MedicalDocument");
const VisitPrepShare = require("../src/models/VisitPrepShare");

let mongod, server, base, passwordHash;
before(async () => {
  process.env.NODE_ENV = "test"; process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex"); process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await createTestMongo(); process.env.MONGO_URI = mongod.getUri(); await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), MedicalDocument.init(), VisitPrepShare.init()]);
  passwordHash = await bcrypt.hash("Visit prep sharing password 123!", 12);
  const { createApp } = require("../src/app"); server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve)); base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); if (mongod) await mongod.stop(); });
beforeEach(async () => { await Promise.all([User, LinkedProfile, MedicalDocument, VisitPrepShare].map((Model) => Model.deleteMany({}))); });

async function account(email) { const user = await User.create({ name: "Rana", email, passwordHash }); return { user, cookie: jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }) }; }
async function request(method, path, { cookie, body, origin = process.env.CLIENT_ORIGIN } = {}) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let parsed = text; try { parsed = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, body: parsed, headers: response.headers };
}
const snapshot = (documentIds = []) => ({ patientName: "Rana Haddad", expiresInDays: 7, documentIds, sections: [{ title: "Patient and health background", text: "Asthma" }, { title: "Current medications", text: "Inhaler as needed" }] });

test("creates only hashed, profile-scoped links and lists audit status without returning the token again", async () => {
  const owner = await account("owner@example.test");
  const created = await request("POST", "/visit-prep-shares?profileId=self", { cookie: owner.cookie, body: snapshot() });
  assert.equal(created.status, 201); assert.match(created.body.token, /^[A-Za-z0-9_-]{43}$/);
  const stored = await VisitPrepShare.findById(created.body.share.id).select("+tokenHash");
  assert.notEqual(stored.tokenHash, created.body.token); assert.equal(stored.tokenHash, crypto.createHash("sha256").update(created.body.token).digest("hex"));
  const list = await request("GET", "/visit-prep-shares?profileId=self", { cookie: owner.cookie });
  assert.equal(list.status, 200); assert.equal(list.body.shares.length, 1); assert.equal("token" in list.body.shares[0], false);
});

test("public link serves its frozen snapshot and only its selected attachment", async () => {
  const owner = await account("documents@example.test");
  const selected = await MedicalDocument.create({ owner: owner.user._id, profileId: owner.user._id, filename: "lab.pdf", mimeType: "application/pdf", size: 4, data: Buffer.from("PDF!") });
  const other = await MedicalDocument.create({ owner: owner.user._id, profileId: owner.user._id, filename: "private.pdf", mimeType: "application/pdf", size: 7, data: Buffer.from("PRIVATE") });
  const created = await request("POST", "/visit-prep-shares", { cookie: owner.cookie, body: snapshot([String(selected._id)]) });
  const token = created.body.token;
  const opened = await request("GET", `/visit-prep-shares/public/${token}`);
  assert.equal(opened.status, 200); assert.equal(opened.body.sheet.sections[0].text, "Asthma"); assert.deepEqual(opened.body.sheet.documents.map((item) => item.filename), ["lab.pdf"]);
  const download = await fetch(`${base}/visit-prep-shares/public/${token}/documents/${selected._id}`);
  assert.equal(download.status, 200); assert.equal(await download.text(), "PDF!");
  assert.equal((await request("GET", `/visit-prep-shares/public/${token}/documents/${other._id}`)).status, 404);
  assert.equal((await VisitPrepShare.findById(created.body.share.id)).viewCount, 1);
});

test("clinician confirmation is validated and immutable", async () => {
  const owner = await account("confirm@example.test");
  const created = await request("POST", "/visit-prep-shares", { cookie: owner.cookie, body: snapshot() }); const token = created.body.token;
  assert.equal((await request("POST", `/visit-prep-shares/public/${token}/confirm`, { body: { clinicianName: "", accurate: true } })).status, 400);
  const confirmed = await request("POST", `/visit-prep-shares/public/${token}/confirm`, { body: { clinicianName: "Dr Layla Khoury", accurate: true } });
  assert.equal(confirmed.status, 200); assert.equal(confirmed.body.confirmedBy, "Dr Layla Khoury");
  assert.equal((await request("POST", `/visit-prep-shares/public/${token}/confirm`, { body: { clinicianName: "Someone else", accurate: true } })).status, 409);
  const list = await request("GET", "/visit-prep-shares", { cookie: owner.cookie }); assert.equal(list.body.shares[0].confirmedBy, "Dr Layla Khoury");
});

test("revocation, expiry, ownership and cross-origin protections are enforced", async () => {
  const owner = await account("revoke@example.test"); const other = await account("other@example.test");
  assert.equal((await request("POST", "/visit-prep-shares", { cookie: owner.cookie, body: snapshot(), origin: "https://evil.test" })).status, 403);
  const created = await request("POST", "/visit-prep-shares", { cookie: owner.cookie, body: snapshot() }); const token = created.body.token;
  assert.equal((await request("DELETE", `/visit-prep-shares/${created.body.share.id}`, { cookie: other.cookie })).status, 404);
  assert.equal((await request("DELETE", `/visit-prep-shares/${created.body.share.id}`, { cookie: owner.cookie })).status, 200);
  assert.equal((await request("GET", `/visit-prep-shares/public/${token}`)).status, 410);
  const expiredToken = crypto.randomBytes(32).toString("base64url");
  await VisitPrepShare.create({ owner: owner.user._id, profileId: owner.user._id, tokenHash: crypto.createHash("sha256").update(expiredToken).digest("hex"), patientName: "Rana", sections: [{ title: "History", text: "Snapshot" }], expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await request("GET", `/visit-prep-shares/public/${expiredToken}`)).status, 410);
  assert.equal((await request("GET", "/visit-prep-shares/public/not-a-token")).status, 404);
});

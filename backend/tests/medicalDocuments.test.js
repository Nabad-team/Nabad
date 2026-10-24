const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../src/models/User");
const LinkedProfile = require("../src/models/LinkedProfile");
const MedicalDocument = require("../src/models/MedicalDocument");

let mongod, server, base, passwordHash;
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), LinkedProfile.init(), MedicalDocument.init()]);
  passwordHash = await bcrypt.hash("Medical documents test password 123!", 12);
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => { await Promise.all([User, LinkedProfile, MedicalDocument].map((Model) => Model.deleteMany({}))); });

async function user(email = "owner@example.test") { return User.create({ name: "Owner", email, passwordHash }); }
function token(account) { return jwt.sign({ sub: String(account._id), ver: account.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }); }
async function request(method, path, { body, cookie, origin = process.env.CLIENT_ORIGIN } = {}) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: `accessToken=${cookie}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, body: parsed, headers: response.headers };
}
const PDF = Buffer.from("%PDF-1.4\nmedical test\n%%EOF").toString("base64");
const upload = (cookie, file = { filename: "lab-result.pdf", mimeType: "application/pdf", data: PDF }, profileId = "self", metadata = {}) => request("POST", `/medical-documents?profileId=${profileId}`, { cookie, body: { file, ...metadata } });
async function dependent(cookie, fullName = "Child") {
  const result = await request("POST", "/profile/linked", { cookie, body: { fullName, dateOfBirth: "2015-06-01", relationship: "child" } });
  assert.equal(result.status, 201);
  return result.body.profile.id;
}

test("medical document endpoints require authentication and reject cross-origin writes", async () => {
  assert.equal((await request("GET", "/medical-documents")).status, 401);
  assert.equal((await request("POST", "/medical-documents", { body: { file: {} } })).status, 401);
  const cookie = token(await user());
  assert.equal((await request("POST", "/medical-documents", { cookie, origin: "https://evil.example", body: { file: { filename: "lab.pdf", mimeType: "application/pdf", data: PDF } } })).status, 403);
  assert.equal(await MedicalDocument.countDocuments(), 0);
});

test("uploads and stores a valid medical document with profile metadata", async () => {
  const account = await user(); const cookie = token(account);
  const response = await upload(cookie);
  assert.equal(response.status, 201);
  assert.equal(response.body.document.filename, "lab-result.pdf");
  assert.equal(response.body.document.mimeType, "application/pdf");
  assert.equal(response.body.document.size, Buffer.from(PDF, "base64").length);
  assert.ok(response.body.document.uploadedAt);
  const stored = await MedicalDocument.findById(response.body.document.id).select("+data");
  assert.equal(String(stored.owner), String(account._id));
  assert.equal(String(stored.profileId), String(account._id));
  assert.deepEqual(Buffer.from(stored.data), Buffer.from(PDF, "base64"));
});

test("stores and validates document type and clinical date", async () => {
  const cookie = token(await user());
  const response = await upload(cookie, undefined, "self", { documentType: "imaging", documentDate: "2026-09-18" });
  assert.equal(response.status, 201);
  assert.equal(response.body.document.documentType, "imaging");
  assert.equal(response.body.document.documentDate, "2026-09-18");
  const stored = await MedicalDocument.findById(response.body.document.id);
  assert.equal(stored.documentType, "imaging");
  assert.equal(stored.documentDate.toISOString().slice(0, 10), "2026-09-18");
  assert.equal((await upload(cookie, undefined, "self", { documentType: "unknown" })).status, 400);
  assert.equal((await upload(cookie, undefined, "self", { documentDate: "2026-02-30" })).status, 400);
});

test("updates categorization only for the owner and selected profile", async () => {
  const ownerCookie = token(await user());
  const otherCookie = token(await user("other@example.test"));
  const childId = await dependent(ownerCookie);
  const uploaded = await upload(ownerCookie);
  const metadata = { documentType: "letter", documentDate: "2025-11-03" };
  const updated = await request("PATCH", `/medical-documents/${uploaded.body.document.id}?profileId=self`, { cookie: ownerCookie, body: metadata });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.document.documentType, "letter");
  assert.equal(updated.body.document.documentDate, "2025-11-03");
  assert.equal((await request("PATCH", `/medical-documents/${uploaded.body.document.id}?profileId=self`, { cookie: otherCookie, body: metadata })).status, 404);
  assert.equal((await request("PATCH", `/medical-documents/${uploaded.body.document.id}?profileId=${childId}`, { cookie: ownerCookie, body: metadata })).status, 404);
});

test("accepts arbitrary document formats, falls back to a safe MIME type, and rejects malformed or oversize uploads", async () => {
  const cookie = token(await user());
  const dcm = Buffer.from("medical image data").toString("base64");
  const accepted = await upload(cookie, { filename: "scan.dcm", mimeType: "application/dicom", data: dcm });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.document.mimeType, "application/dicom");
  const fallback = await upload(cookie, { filename: "referral.unknown", mimeType: "not a mime type", data: dcm });
  assert.equal(fallback.status, 201);
  assert.equal(fallback.body.document.mimeType, "application/octet-stream");
  assert.equal((await upload(cookie, { filename: "lab.pdf", mimeType: "application/pdf", data: "%%not-base64%%" })).status, 400);
  const large = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(10 * 1024 * 1024)]).toString("base64");
  assert.equal((await upload(cookie, { filename: "large.pdf", mimeType: "application/pdf", data: large })).status, 413);
  assert.equal(await MedicalDocument.countDocuments(), 2);
});

test("lists and downloads documents only for the selected profile and owner", async () => {
  const owner = await user(); const ownerCookie = token(owner);
  const other = await user("other@example.test"); const otherCookie = token(other);
  const childId = await dependent(ownerCookie);
  const selfDoc = await upload(ownerCookie);
  const childDoc = await upload(ownerCookie, { filename: "child-lab.pdf", mimeType: "application/pdf", data: PDF }, childId);
  const selfList = await request("GET", "/medical-documents?profileId=self", { cookie: ownerCookie });
  assert.deepEqual(selfList.body.documents.map((item) => item.id), [selfDoc.body.document.id]);
  const childList = await request("GET", `/medical-documents?profileId=${childId}`, { cookie: ownerCookie });
  assert.deepEqual(childList.body.documents.map((item) => item.id), [childDoc.body.document.id]);
  const download = await fetch(`${base}/medical-documents/${selfDoc.body.document.id}/download?profileId=self`, { headers: { Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${ownerCookie}` } });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/pdf");
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), Buffer.from(PDF, "base64"));
  for (const [cookie, profileId] of [[ownerCookie, childId], [otherCookie, "self"]]) {
    const response = await fetch(`${base}/medical-documents/${selfDoc.body.document.id}/download?profileId=${profileId}`, { headers: { Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${cookie}` } });
    assert.equal(response.status, 404);
  }
  assert.equal((await request("GET", `/medical-documents?profileId=${other._id}`, { cookie: ownerCookie })).status, 404);
});

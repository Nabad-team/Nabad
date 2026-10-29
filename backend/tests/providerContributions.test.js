const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose"), jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const Provider = require("../src/models/Provider");
const User = require("../src/models/User");
const Feedback = require("../src/models/ProviderFeedback");
const Correction = require("../src/models/ProviderCorrection");
const { providerSummaries, feedbackInput, WINDOW_MS } = require("../src/providers/feedback");
let mongo, server, base, a, b;
const now = new Date("2026-10-29T12:00:00Z");
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: require("crypto").randomBytes(32).toString("hex") });
  mongo = await createTestMongo(); process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Provider.createIndexes(), Feedback.createIndexes(), Correction.createIndexes()]);
  server = require("../src/app").createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); if (mongo) await mongo.stop(); });
async function account(n) {
  const user = await User.create({ name: n, email: n + "@example.test", authProvider: "google", googleId: n, passwordHash: "test-only-unused" });
  return { user, cookie: "accessToken=" + jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" }) };
}
beforeEach(async () => {
  await Promise.all([Provider.deleteMany({}), User.deleteMany({}), Feedback.deleteMany({}), Correction.deleteMany({})]);
  a = await account("a"); b = await account("b");
  await Provider.create({ slug: "test-hospital", legacySlugs: ["old-hospital"], name: "Test hospital", type: "hospital",
    sources: ["https://example.test/hospital"], verifiedAt: now, insurances: ["nssf", "coop"],
    insuranceSources: ["https://example.test/insurance"], insuranceVerifiedAt: now });
});
async function req(method, path, who, body, origin = process.env.CLIENT_ORIGIN) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: origin, ...(who ? { Cookie: who.cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const review = () => ({ rating: 4, visitDate: today(), note: "Private note, not a public review" });
test("insurance search is public, exact, indexed and rejects nested filters", async () => {
  assert.equal((await req("GET", "/providers?insurance=nssf")).body.total, 1);
  assert.equal((await req("GET", "/providers?insurance=unknown")).body.total, 0);
  assert.equal((await req("GET", "/providers?insurance[$ne]=x")).status, 400);
  assert.equal((await req("GET", "/providers?insurance=nssf&insurance=coop")).status, 400);
  const found = (await req("GET", "/providers?insurance=coop")).body;
  assert.deepEqual(found.insurances, ["coop", "nssf"]);
  assert.ok((await Provider.collection.indexes()).some(i => i.key.insurances === 1));
  await assert.rejects(new Provider({ slug: "bad", name: "Bad", type: "hospital", insurances: ["nssf"], sources: [], verifiedAt: now }).validate());
});
test("shareable detail resolves aliases, has unknown defaults and no account fields", async () => {
  const result = await req("GET", "/providers/old-hospital");
  assert.equal(result.status, 200); assert.equal(result.body.provider.id, "test-hospital");
  assert.equal(result.body.provider.feedback.waiting.level, "unknown");
  assert.equal(result.body.provider.feedback.averageRating, null);
  assert.ok(!JSON.stringify(result.body).includes("owner"));
  assert.equal((await req("GET", "/providers/not-real")).status, 404);
  assert.equal((await req("GET", "/providers/bad%24slug")).status, 404);
});
test("contribution writes require sign-in and same-origin requests", async () => {
  for (const [method, path, body] of [
    ["PUT", "/providers/test-hospital/feedback", review()], ["DELETE", "/providers/test-hospital/feedback"],
    ["GET", "/providers/test-hospital/feedback/me"], ["PUT", "/providers/test-hospital/corrections", { field: "phone", details: "Wrong" }],
    ["GET", "/providers/test-hospital/corrections/me"], ["DELETE", "/providers/test-hospital/corrections/phone"]]) {
    assert.equal((await req(method, path, null, body)).status, 401);
  }
  assert.equal((await req("PUT", "/providers/test-hospital/feedback", a, review(), "https://other.test")).status, 403);
});
test("concurrent feedback saves replace one review and remain private to its owner", async () => {
  const saved = await Promise.all(Array.from({ length: 6 }, () => req("PUT", "/providers/old-hospital/feedback", a, review())));
  assert.ok(saved.every(r => r.status === 200)); assert.equal(await Feedback.countDocuments(), 1);
  assert.equal((await req("GET", "/providers/test-hospital/feedback/me", b)).body.feedback, null);
  assert.equal((await req("GET", "/providers/test-hospital/feedback/me", a)).body.feedback.note, review().note);
  const publicResult = await req("GET", "/providers/test-hospital");
  assert.equal(publicResult.body.provider.feedback.count, 1);
  assert.equal(publicResult.body.provider.feedback.averageRating, 4);
  assert.ok(!JSON.stringify(publicResult).includes(review().note));
  assert.ok(!JSON.stringify(publicResult).includes(String(a.user._id)));
  await req("PUT", "/providers/test-hospital/feedback", a, { ...review(), rating: 2 });
  assert.equal(await Feedback.countDocuments(), 1);
  assert.equal((await req("GET", "/providers/test-hospital")).body.provider.feedback.averageRating, 2);
  await req("DELETE", "/providers/test-hospital/feedback", b);
  assert.equal(await Feedback.countDocuments(), 1);
  await req("DELETE", "/providers/test-hospital/feedback", a);
  assert.equal(await Feedback.countDocuments(), 0);
});
test("invalid review values, dates, spoofed owners and unconfirmed waiting are refused", async () => {
  for (const body of [{ ...review(), rating: 0 }, { ...review(), rating: 2.5 }, { ...review(), rating: "4" },
    { ...review(), owner: b.user._id }, { ...review(), visitDate: "2026-02-30" }, { ...review(), visitDate: "2099-01-01" },
    { ...review(), note: "x".repeat(1001) }, { ...review(), waitLevel: "long" }, { ...review(), waitLevel: { $ne: "" } },
    { ...review(), recentVisit: "true" }]) {
    assert.equal((await req("PUT", "/providers/test-hospital/feedback", a, body)).status, 400);
  }
  assert.throws(() => feedbackInput({ rating: 4, visitDate: "2026-10-27", waitLevel: "long", recentVisit: true }, now));
  assert.equal((await req("PUT", "/providers/missing/feedback", a, review())).status, 404);
});
test("waiting uses a two-hour window, distinct accounts, and the conservative median only with enough reports", async () => {
  const users = [a.user, b.user, (await account("c")).user, (await account("d")).user, (await account("e")).user];
  await Feedback.create(users.map((u, i) => ({ owner: u._id, providerSlug: "test-hospital", rating: 4, visitDate: "2026-10-29",
    waitLevel: ["short", "moderate", "long", "short", "long"][i],
    waitReportedAt: i === 3 ? new Date(now - WINDOW_MS) : i === 4 ? new Date(now.getTime() + 1) : now })));
  let summary = (await providerSummaries(["test-hospital"], now)).get("test-hospital");
  assert.equal(summary.waiting.reportCount, 3); assert.equal(summary.waiting.level, "moderate");
  summary = (await providerSummaries(["test-hospital"], new Date(now.getTime() + WINDOW_MS))).get("test-hospital");
  assert.equal(summary.waiting.level, "unknown"); assert.equal(summary.waiting.updatedAt, null);
  await Feedback.deleteOne({ owner: users[2]._id });
  summary = (await providerSummaries(["test-hospital"], now)).get("test-hospital");
  assert.equal(summary.waiting.level, "unknown"); assert.equal(summary.waiting.reportCount, 2);
});
test("waiting observation timestamps come from the server, and removal updates aggregates", async () => {
  const start = Date.now();
  await req("PUT", "/providers/test-hospital/feedback", a, { ...review(), waitLevel: "long", recentVisit: true });
  const row = await Feedback.findOne({ owner: a.user._id }).lean();
  assert.ok(row.waitReportedAt.getTime() >= start);
  await req("PUT", "/providers/test-hospital/feedback", a, review());
  assert.equal((await Feedback.findOne({ owner: a.user._id })).waitReportedAt, null);
});
test("corrections are private, deduplicated, editable and never mutate curated information", async () => {
  const old = (await Provider.findOne({ slug: "test-hospital" })).toObject();
  const body = { field: "phone", details: "The published telephone is incorrect." };
  const results = await Promise.all(Array.from({ length: 4 }, () => req("PUT", "/providers/old-hospital/corrections", a, body)));
  assert.ok(results.every(r => r.status === 200)); assert.equal(await Correction.countDocuments(), 1);
  assert.equal((await req("GET", "/providers/test-hospital/corrections/me", b)).body.reports.length, 0);
  assert.equal((await req("GET", "/providers/test-hospital/corrections/me", a)).body.reports[0].status, "pending");
  assert.equal((await Provider.findOne({ slug: "test-hospital" })).phone, old.phone);
  for (const invalid of [{ field: "other", details: "" }, { ...body, status: "reviewed" }, { field: { $ne: "" }, details: "bad" }])
    assert.equal((await req("PUT", "/providers/test-hospital/corrections", a, invalid)).status, 400);
  await req("DELETE", "/providers/test-hospital/corrections/phone", b);
  assert.equal(await Correction.countDocuments(), 1);
  await req("DELETE", "/providers/test-hospital/corrections/phone", a);
  assert.equal(await Correction.countDocuments(), 0);
});
test("account data export includes only its own contributions, and account deletion removes them", async () => {
  for (const who of [a, b]) {
    await req("PUT", "/providers/test-hospital/feedback", who, { ...review(), note: who.user.name + " private note" });
    await req("PUT", "/providers/test-hospital/corrections", who, { field: "phone", details: who.user.name + " correction" });
  }
  const exported = await require("../src/dataExport").buildExport(a.user._id);
  assert.equal(exported.providerFeedback.length, 1); assert.equal(exported.providerCorrections.length, 1);
  assert.equal(exported.providerFeedback[0].note, "a private note");
  assert.ok(!JSON.stringify(exported).includes("b correction"));
  assert.equal((await req("DELETE", "/profile/me", a, { confirm: "DELETE", email: a.user.email })).status, 204);
  assert.equal(await Feedback.countDocuments({ owner: a.user._id }), 0);
  assert.equal(await Correction.countDocuments({ owner: a.user._id }), 0);
  assert.equal(await Feedback.countDocuments({ owner: b.user._id }), 1);
});

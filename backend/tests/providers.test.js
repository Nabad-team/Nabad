const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Provider = require("../src/models/Provider");
const User = require("../src/models/User");
const jwt = require("jsonwebtoken");
const { seedProviders } = require("../src/providers/seed");
let mongo, server, base;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: require("node:crypto").randomBytes(32).toString("hex") });
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  server = require("../src/app").createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/providers`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
beforeEach(async () => { await Provider.deleteMany({}); await User.deleteMany({}); await seedProviders(); });
async function get(query = "") { const r = await fetch(base + query); return { status: r.status, body: await r.json() }; }
test("seed is repeatable, includes hospitals and clinics, and preserves existing edits", async () => {
  await Provider.updateOne({ slug: "aubmc" }, { $set: { name: "Updated name" } });
  await Promise.all([seedProviders(), seedProviders()]);
  assert.equal(await Provider.countDocuments(), 6);
  assert.equal((await Provider.findOne({ slug: "aubmc" })).name, "Updated name");
  assert.equal(await Provider.countDocuments({ type: "clinic" }), 2);
});
test("directory is readable and only exposes public facility fields", async () => {
  const result = await get();
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 6);
  assert.ok(result.body.providers.every(p => p.id && p.sources.length && !p._id));
  assert.equal(result.body.providers.find(p => p.id === "nini-hospital").emergency24h, null);
});
test("schema rejects invalid coordinates and hours", async () => {
  const fixture = require("../data/providers")[0];
  await assert.rejects(new Provider({ ...fixture, latitude: 91 }).validate());
  await assert.rejects(new Provider({ ...fixture, hours: [{ day: 7, start: 0, end: 1440 }] }).validate());
});
test("specialty search, case-insensitive names, combined filters and no matches", async () => {
  assert.equal((await get("?specialty=pediatrics")).body.total, 3);
  assert.equal((await get("?q=RiZk&specialty=pediatrics")).body.total, 1);
  assert.equal((await get("?q=emergency%20medicine")).body.total, 2);
  assert.equal((await get("?q=does-not-exist")).body.total, 0);
  assert.equal((await get("?specialty=pediatrics&city=Tripoli")).body.total, 0);
  assert.equal((await get("?q=.*")).body.total, 0); // literal, not regex
});
test("rejects nested, repeated and excessively long filter parameters", async () => {
  for (const query of ["?q[$ne]=a", "?specialty=a&specialty=b", `?q=${"a".repeat(101)}`]) {
    assert.equal((await get(query)).status, 400);
  }
});
test("distance filters and sorting use coordinates before pagination", async () => {
  const near = await get("?lat=34.43587&lng=35.83076&radiusKm=5");
  assert.equal(near.body.total, 1); assert.equal(near.body.providers[0].id, "nini-hospital");
  assert.equal(near.body.providers[0].distanceKm, 0);
  const page = await get("?lat=34.43587&lng=35.83076&limit=1&page=2");
  assert.equal(page.body.total, 6); assert.equal(page.body.providers.length, 1);
  assert.notEqual(page.body.providers[0].id, "nini-hospital");
  assert.equal((await get("?city=saida")).body.providers[0].id, "hammoud-hospital");
  const { distanceKm } = require("../src/providers/query");
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.01);
});
test("invalid locations, radii and pagination are rejected", async () => {
  for (const query of ["lat=91&lng=0", "lat=0", "lng=0", "lat=&lng=0", "lat=NaN&lng=0", "radiusKm=10", "lat=0&lng=0&radiusKm=-1", "page=0", "limit=101", "page=1.5"]) {
    assert.equal((await get(`?${query}`)).status, 400, query);
  }
});
test("24/7 ER filtering excludes unknown status and exposes separate clinic hours", async () => {
  const result = await get("?emergency24h=true");
  assert.equal(result.body.total, 2);
  assert.ok(result.body.providers.every(p => p.emergency24h && p.openingStatus === "unknown"));
  assert.equal((await get("?openNow=maybe")).status, 400);
});
async function account(email) {
  const user = await User.create({ name: "Test", email, passwordHash: "test-only-unused" });
  return { user, cookie: `accessToken=${jwt.sign({ sub: String(user._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" })}` };
}
const favoriteRequest = (method, path, cookie, origin = process.env.CLIENT_ORIGIN) => fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: origin } });
test("favorites require authentication and reject cross-origin writes", async () => {
  for (const [method, path] of [["GET", "/favorites"], ["GET", "?favorites=true"], ["PUT", "/aubmc/favorite"], ["DELETE", "/aubmc/favorite"]]) assert.equal((await favoriteRequest(method, path)).status, 401);
  const { cookie } = await account("one@example.test");
  assert.equal((await favoriteRequest("PUT", "/aubmc/favorite", cookie, "https://other.test")).status, 403);
});
test("concurrent saves are idempotent and isolated to the signed-in account", async () => {
  const a = await account("one@example.test"); const b = await account("two@example.test");
  const saves = await Promise.all(Array.from({ length: 5 }, () => favoriteRequest("PUT", "/aubmc/favorite", a.cookie)));
  assert.ok(saves.every(r => r.status === 200));
  assert.deepEqual((await User.findById(a.user._id)).favoriteProviders.toObject(), ["aubmc"]);
  assert.deepEqual(await (await favoriteRequest("GET", "/favorites", b.cookie)).json(), { favorites: [] });
  const list = await (await favoriteRequest("GET", "?favorites=true", a.cookie)).json();
  assert.equal(list.total, 1); assert.equal(list.providers[0].id, "aubmc");
  assert.equal((await favoriteRequest("DELETE", "/aubmc/favorite", b.cookie)).status, 204);
  assert.equal((await User.findById(a.user._id)).favoriteProviders.length, 1);
  for (let i = 0; i < 2; i++) assert.equal((await favoriteRequest("DELETE", "/aubmc/favorite", a.cookie)).status, 204);
  assert.equal((await User.findById(a.user._id)).favoriteProviders.length, 0);
});
test("missing providers cannot be saved; account favorite limit is enforced", async () => {
  const { user, cookie } = await account("one@example.test");
  assert.equal((await favoriteRequest("PUT", "/not-real/favorite", cookie)).status, 404);
  await User.updateOne({ _id: user._id }, { $set: { favoriteProviders: Array.from({ length: 100 }, (_, i) => `fixture-${i}`) } });
  assert.equal((await favoriteRequest("PUT", "/aubmc/favorite", cookie)).status, 409);
  assert.equal((await User.findById(user._id)).favoriteProviders.length, 100);
});

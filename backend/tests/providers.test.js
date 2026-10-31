const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const Provider = require("../src/models/Provider");
const User = require("../src/models/User");
const seedData = require("../data/providers");
const jwt = require("jsonwebtoken");
const { seedProviders } = require("../src/providers/seed");
let mongo, server, base;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: require("node:crypto").randomBytes(32).toString("hex") });
  mongo = await createTestMongo();
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
  assert.equal(await Provider.countDocuments(), seedData.length);
  assert.equal((await Provider.findOne({ slug: "aubmc" })).name, "Updated name");
  assert.equal(await Provider.countDocuments({ type: "clinic" }), 2);
});
test("directory is readable and only exposes public facility fields", async () => {
  const result = await get("?limit=100");
  assert.equal(result.status, 200);
  assert.equal(result.body.total, seedData.length);
  assert.ok(result.body.services.every(value => typeof value === "string" && value));
  assert.ok(result.body.providers.every(p => p.id && p.sources.length && !p._id));
  assert.equal((await get("?q=Nini")).body.providers[0].emergency24h, null);
});
test("schema rejects invalid coordinates and hours", async () => {
  const fixture = require("../data/providers")[0];
  await assert.rejects(new Provider({ ...fixture, latitude: 91 }).validate());
  await assert.rejects(new Provider({ ...fixture, hours: [{ day: 7, start: 0, end: 1440 }] }).validate());
});
test("newer seed updates fields atomically while equal/older snapshots preserve edits", async () => {
  const original = require("../data/providers")[0];
  const newer = { ...original, name: "Reverified hospital", services: ["ct", "mri"], verifiedAt: new Date("2030-01-01") };
  await Promise.all([seedProviders([newer]), seedProviders([newer])]);
  let saved = await Provider.findOne({ slug: original.slug }).lean();
  assert.equal(saved.name, newer.name);
  assert.deepEqual(saved.services, ["ct", "mri"]);
  assert.deepEqual(saved.location.coordinates, [original.longitude, original.latitude]);
  await seedProviders([original]);
  await seedProviders([{ ...newer, name: "Same timestamp must not win" }]);
  saved = await Provider.findOne({ slug: original.slug }).lean();
  assert.equal(saved.name, newer.name);
  assert.equal(await Provider.countDocuments({ slug: original.slug }), 1);
  await Provider.collection.updateOne({ slug: original.slug }, { $unset: { location: "" } });
  await seedProviders([original]);
  assert.deepEqual((await Provider.findOne({ slug: original.slug }).lean()).location.coordinates, [original.longitude, original.latitude]);
});
test("specialty search, case-insensitive names, combined filters and no matches", async () => {
  assert.ok((await get("?specialty=pediatrics")).body.providers.every(p => p.specialties.includes("pediatrics")));
  assert.equal((await get("?q=RiZk&specialty=pediatrics")).body.total, 1);
  assert.ok((await get("?q=emergency%20medicine")).body.total >= 2);
  assert.equal((await get("?q=does-not-exist")).body.total, 0);
  assert.ok((await get("?specialty=pediatrics&city=Tripoli")).body.providers.some(p => p.id === "nini-hospital"));
  assert.equal((await get("?q=.*")).body.total, 0); // literal, not regex
});
test("rejects nested, repeated and excessively long filter parameters", async () => {
  for (const query of ["?q[$ne]=a", "?specialty=a&specialty=b", `?q=${"a".repeat(101)}`]) {
    assert.equal((await get(query)).status, 400);
  }
});
test("distance filters and sorting use coordinates before pagination", async () => {
  const near = await get("?lat=34.43587&lng=35.83076&radiusKm=5");
  assert.ok(near.body.total >= 10); assert.equal(near.body.providers[0].id, "nini-hospital");
  assert.ok(near.body.providers.every(p => p.distanceKm <= 5));
  assert.ok(near.body.providers.every((p, i, list) => i === 0 || p.distanceKm >= list[i - 1].distanceKm));
  assert.equal(near.body.providers[0].distanceKm, 0);
  const page = await get("?lat=34.43587&lng=35.83076&limit=1&page=2");
  assert.equal(page.body.total, seedData.filter(p => p.latitude != null).length); assert.equal(page.body.providers.length, 1);
  assert.notEqual(page.body.providers[0].id, "nini-hospital");
  assert.ok((await get("?city=saida")).body.providers.some(p => p.id === "hammoud-hospital"));
});
test("invalid locations, radii and pagination are rejected", async () => {
  for (const query of ["lat=91&lng=0", "lat=0", "lng=0", "lat=&lng=0", "lat=NaN&lng=0", "radiusKm=10", "lat=0&lng=0&radiusKm=-1", "page=0", "limit=101", "page=1.5"]) {
    assert.equal((await get(`?${query}`)).status, 400, query);
  }
});
test("indexed text and distance combine with services and geographic filters", async () => {
  await Provider.updateOne({ slug: "lau-rizk" }, { $set: { services: ["ct"], governorate: "Beirut" } });
  const result = await get("?q=Rizk&lat=33.9&lng=35.5&radiusKm=10&service=ct&governorate=beirut");
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.providers[0].id, "lau-rizk");
  assert.deepEqual(result.body.providers[0].services, ["ct"]);
  assert.equal((await get("?q=Rizk&lat=34.4&lng=35.8&radiusKm=1")).body.total, 0);
  assert.equal((await get("?service[$ne]=x")).status, 400);
  const indexes = await Provider.collection.indexes();
  assert.ok(indexes.some(i => i.key.location === "2dsphere"));
  assert.ok(indexes.some(i => i.textIndexVersion));
});
test("database schedule filter agrees with Beirut hours before pagination", async () => {
  const { searchProviders } = require("../src/providers/search");
  const { parseQuery } = require("../src/providers/query");
  const { openingStatus } = require("../src/providers/hours");
  await Provider.updateOne({ slug: "nini-hospital" }, { $set: { hoursKnown: true, hours: [{ day: 6, start: 1320, end: 120 }] } });
  for (const iso of ["2026-10-10T22:00:00Z", "2026-10-10T23:00:00Z", "2026-01-12T06:00:00Z", "2026-10-12T14:00:00Z"]) {
    const now = new Date(iso);
    const records = await Provider.find().lean();
    const expected = records.filter(p => p.emergency24h === true || openingStatus(p, now) === "open");
    const result = await searchProviders(parseQuery({ openNow: "true", limit: "1" }), undefined, now);
    assert.equal(result.total, expected.length, iso);
    assert.equal(result.providers.length, 1);
    assert.ok(expected.some(p => p.slug === result.providers[0].slug));
  }
});
test("24/7 ER filtering excludes unknown status and exposes separate clinic hours", async () => {
  const result = await get("?emergency24h=true");
  assert.equal(result.body.total, seedData.filter(p => p.emergency24h === true).length);
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

test("curated seed covers all governorates with unique identities and sourced capabilities", async () => {
  assert.equal(new Set(seedData.map(p => p.slug)).size, seedData.length);
  assert.deepEqual([...new Set(seedData.map(p => p.governorate))].sort(), ["Akkar", "Baalbek-Hermel", "Beirut", "Bekaa", "Keserwan-Jbeil", "Mount Lebanon", "Nabatieh", "North", "South"]);
  assert.ok(seedData.every(p => Array.isArray(p.specialties) && p.sources.length >= 1));
  for (const service of ["ct", "mri", "cath-lab", "nicu", "burn-unit", "dialysis", "maternity"]) {
    const response = await get(`?service=${service}`);
    assert.ok(response.body.total > 0, service);
    assert.ok(response.body.providers.every(p => p.services.includes(service)), service);
  }
});

test("expanded directory distinguishes Saida city from its district and paginates without loss", async () => {
  const saida = await get("?city=Saida&governorate=South");
  assert.equal(saida.status, 200);
  assert.ok(saida.body.total >= 5);
  const district = await get("?district=Saida&governorate=South&limit=100");
  assert.ok(district.body.total > saida.body.total);
  assert.ok(district.body.total > 10);
  assert.ok(district.body.providers.every(p => p.district === "Saida"));
  assert.ok(district.body.districts.includes("Tripoli"));
  assert.equal((await get("?district[$ne]=x")).status, 400);
  const ids = [];
  for (let page = 1; ids.length < seedData.length; page++) {
    const result = await get(`?limit=20&page=${page}`);
    assert.equal(result.body.total, seedData.length);
    assert.ok(result.body.providers.length > 0);
    ids.push(...result.body.providers.map(p => p.id));
  }
  assert.equal(ids.length, seedData.length);
  assert.equal(new Set(ids).size, seedData.length);
});

test("unlocated hospitals remain searchable and saveable without a fabricated geo point", async () => {
  const fixture = seedData.find(p => p.latitude === null);
  const row = await Provider.findOne({ slug: fixture.slug }).lean();
  assert.ok(!row.location);
  assert.ok((await get(`?district=${encodeURIComponent(fixture.district)}&limit=100`)).body.providers.some(p => p.id === fixture.slug));
  const { cookie } = await account("unlocated@example.test");
  assert.equal((await favoriteRequest("PUT", `/${fixture.slug}/favorite`, cookie)).status, 200);
  const geo = await (await favoriteRequest("GET", "?favorites=true&lat=33.9&lng=35.5", cookie)).json();
  assert.equal(geo.total, 0);
  await assert.rejects(new Provider({ ...fixture, latitude: 33.9 }).validate());
  const known = { ...fixture, latitude: 33.9, longitude: 35.5, verifiedAt: "2030-01-01" };
  await seedProviders([known]);
  assert.deepEqual((await Provider.findOne({ slug: fixture.slug }).lean()).location.coordinates, [35.5, 33.9]);
  await seedProviders([{ ...fixture, verifiedAt: "2031-01-01" }]);
  await seedProviders();
  assert.ok(!(await Provider.findOne({ slug: fixture.slug }).lean()).location);
});

test("source-reviewed services do not invent emergency availability or specialty coverage", async () => {
  const result = await get("?q=Saida&city=Saida&limit=100");
  const hospital = result.body.providers.find(p => p.id === "saida-governmental");
  assert.ok(hospital);
  assert.equal(hospital.emergency24h, null);
  assert.equal(hospital.openingStatus, "unknown");
  assert.deepEqual(hospital.specialties, []);
  assert.ok(hospital.services.includes("laboratory"));
  assert.ok(hospital.serviceSources.some(url => url.includes("moph.gov.lb")));
  assert.ok(!hospital.services.includes("ct"));
  assert.equal((await get("?city=Saida&emergency24h=true")).body.total, 0);
  assert.equal((await get("?q=Clemenceau&emergency24h=true")).body.total, 1);
});

test("consolidation preserves favorites once and does not recreate a retired hospital", async () => {
  const canonical = seedData.find(p => p.slug === "lebanese-italian-hospital");
  await Provider.create({ ...canonical, slug: "najem-hospital", legacySlugs: [] });
  const { user } = await account("migration@example.test");
  await User.updateOne({ _id: user._id }, { $set: { favoriteProviders: ["najem-hospital", canonical.slug, "aubmc"] } });
  await Promise.all([seedProviders(), seedProviders()]);
  assert.equal(await Provider.countDocuments(), seedData.length);
  assert.equal(await Provider.countDocuments({ slug: "najem-hospital" }), 0);
  assert.deepEqual([...(await User.findById(user._id)).favoriteProviders].sort(), [canonical.slug, "aubmc"].sort());
  await seedProviders([{ ...canonical, slug: "najem-hospital", legacySlugs: [], verifiedAt: "2026-10-01" }]);
  assert.equal(await Provider.countDocuments({ slug: "najem-hospital" }), 0);
});

test("legacy and canonical favorite URLs share one saved facility and retain access controls", async () => {
  const { user, cookie } = await account("alias@example.test");
  const oldPath = "/najem-hospital/favorite", currentPath = "/lebanese-italian-hospital/favorite";
  assert.equal((await favoriteRequest("PUT", oldPath)).status, 401);
  assert.equal((await favoriteRequest("PUT", oldPath, cookie, "https://other.test")).status, 403);
  const responses = await Promise.all([favoriteRequest("PUT", oldPath, cookie), favoriteRequest("PUT", currentPath, cookie)]);
  assert.ok(responses.every(r => r.status === 200));
  for (const response of responses) assert.equal((await response.json()).id, "lebanese-italian-hospital");
  assert.deepEqual([...(await User.findById(user._id)).favoriteProviders], ["lebanese-italian-hospital"]);
  assert.equal((await favoriteRequest("DELETE", oldPath, cookie)).status, 204);
  assert.equal((await User.findById(user._id)).favoriteProviders.length, 0);
});

test("invalid alias ownership fails before seed changes any provider", async () => {
  const fixture = seedData[0];
  await assert.rejects(seedProviders([{ ...fixture, name: "Must not change", legacySlugs: [fixture.slug] }]), /canonical owner/);
  await assert.rejects(seedProviders([{ ...fixture, legacySlugs: ["retired-fixture"] }, { ...seedData[1], legacySlugs: ["retired-fixture"] }]), /canonical owner/);
  assert.equal((await Provider.findOne({ slug: fixture.slug })).name, fixture.name);
  await assert.rejects(new Provider({ ...fixture, legacySlugs: ["Bad alias"] }).validate());
});

test("source review adds matched locations and capabilities without guessing emergency availability", async () => {
  const byId = id => seedData.find(p => p.slug === id);
  assert.ok(!byId("najem-hospital"));
  assert.deepEqual(byId("lebanese-italian-hospital").legacySlugs, ["najem-hospital"]);
  assert.equal(byId("al-jabal-hospital").district, "Baabda");
  assert.equal(byId("al-koura-hospital").emergency24h, true);
  assert.ok(byId("al-koura-hospital").services.includes("dialysis"));
  for (const id of ["clinique-de-chirugie-estetque-dr-nader-saab", "hopital-dr-toni-nassar-sal", "specialized-medical-rehabilitation-hospital", "al-rahma-hospital"]) {
    const p = byId(id);
    assert.ok(p.latitude > 33 && p.latitude < 35 && p.longitude > 35 && p.longitude < 37);
    assert.equal(p.locationApproximate, true);
    assert.equal(p.emergency24h, null, id);
  }
  assert.equal(byId("clinique-de-chirugie-estetque-dr-nader-saab").hours.length, 6);
  assert.ok(!byId("al-rahban-hospital").services.includes("ct"));
  for (const p of seedData) {
    assert.ok(p.sources.every(url => /^https:\/\//.test(url)), p.slug);
    assert.equal(p.latitude == null, p.longitude == null, p.slug);
  }
});

test("a newer empty service review records evidence without replacing curated fields", async () => {
  const original = seedData.find(p => p.slug === "hermel-governmental");
  await Provider.updateOne({ slug: original.slug }, { $set: { name: "Curated name", servicesReviewedAt: null } });
  const review = { ...original, name: "Must not replace curated name", servicesReviewedAt: "2032-01-01T00:00:00Z", serviceSources: ["https://example.test/review"] };
  await seedProviders([review]);
  let saved = await Provider.findOne({ slug: original.slug }).lean();
  assert.equal(saved.name, "Curated name");
  assert.equal(saved.servicesReviewedAt.toISOString(), "2032-01-01T00:00:00.000Z");
  assert.deepEqual(saved.serviceSources, ["https://example.test/review"]);
  await seedProviders([{ ...review, servicesReviewedAt: "2031-01-01", serviceSources: ["https://example.test/older"] }]);
  saved = await Provider.findOne({ slug: original.slug }).lean();
  assert.deepEqual(saved.serviceSources, ["https://example.test/review"]);
});

test("new source snapshots update existing facilities and insurance filters without duplicates", async () => {
  for (const slug of ["beirut-eye-specialist-hospital", "machghara-governmental-hospital"]) {
    const current = seedData.find(p => p.slug === slug);
    await Provider.updateOne({ slug }, { $set: {
      services: [], insurances: [], serviceSources: [], insuranceSources: [],
      verifiedAt: new Date("2026-10-29"), servicesReviewedAt: new Date("2026-10-29"),
    } });
    await seedProviders([current]);
    await seedProviders([current]);
    const saved = await Provider.findOne({ slug }).lean();
    assert.deepEqual(saved.services, current.services);
    assert.deepEqual(saved.insurances, current.insurances || []);
    assert.deepEqual(saved.serviceSources, current.serviceSources);
    assert.equal(saved.emergency24h, null);
    assert.equal(saved.hoursKnown, false);
    assert.equal(await Provider.countDocuments({ slug }), 1);
  }
  const eye = seedData.find(p => p.slug === "beirut-eye-specialist-hospital");
  assert.deepEqual(eye.specialties, ["ophthalmology", "ent"]);
  assert.ok(!eye.services.includes("ct"));
  assert.ok(!eye.insurances.includes("allianz"));
  const machghara = seedData.find(p => p.slug === "machghara-governmental-hospital");
  assert.ok(!machghara.services.includes("nicu"));
  assert.ok(!machghara.services.includes("dialysis"));
  const result = await get("?insurance=coop&limit=100");
  assert.equal(result.status, 200);
  assert.ok(result.body.providers.some(p => p.id === eye.slug));
  assert.equal(await Provider.countDocuments(), seedData.length);
});

test("published insurer network uses canonical facilities and does not infer contracts from shared phone numbers", async () => {
  const rows = seedData.filter(p => p.insurances?.includes("victoire"));
  assert.equal(rows.length, 69);
  for (const p of rows) {
    assert.ok(p.insuranceSources.includes("https://victoire.com.lb/hospital/"), p.slug);
    assert.ok(p.insuranceVerifiedAt, p.slug);
  }
  for (const slug of ["aubmc-specialty-clinics", "aubmc-outpatient", "rida-mroue-hospital", "hopital-francais-st-lourdes"]) {
    assert.ok(!rows.some(p => p.slug === slug), slug);
  }
  const found = await get("?insurance=victoire&limit=100");
  assert.equal(found.status, 200);
  assert.equal(found.body.total, rows.length);
  assert.deepEqual(found.body.providers.map(p => p.id).sort(), rows.map(p => p.slug).sort());
  const combined = await get("?insurance=victoire&city=Saida&limit=100");
  assert.ok(combined.body.total > 0);
  assert.ok(combined.body.providers.every(p => p.city === "Saida" && p.insurances.includes("victoire")));
});

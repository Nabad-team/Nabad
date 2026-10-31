const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const Provider = require("../src/models/Provider");
const User = require("../src/models/User");
const { classifyUrgency } = require("../src/triage/urgency");
const { emergencyNeeds, parseEmergencyNeeds } = require("../src/triage/emergencyNeeds");
const { assessWithAi } = require("../src/triage/ai/aiTriage");

test("requirements follow positive emergency rules, not a model's specialty or negated symptoms", async () => {
  const cases = [
    ["chest pain", ["cardiac"]],
    ["I think I am having a heart attack", ["cardiac"]],
    ["slurred speech and arm weakness", ["stroke"]],
    ["car crash today", ["trauma"]],
    ["a severe burn", ["burns"]],
    ["car crash with a severe burn", ["burns", "trauma"]],
    ["chest pain and slurred speech", ["cardiac", "stroke"]],
    ["I am pregnant and my baby stopped moving", ["maternity"]],
    ["my baby is not moving", []], // ambiguous: pregnancy or after birth
    ["my newborn baby is not moving", ["pediatric"]],
    ["no chest pain but slurred speech", ["stroke"]],
    ["no severe burn but I was in a car crash today", ["trauma"]],
    ["no chest pain, just a runny nose", []],
    ["I can't breathe", []], // no invented specialty; keep general emergency guidance
  ];
  for (const [symptoms, expected] of cases) {
    assert.deepEqual(emergencyNeeds(classifyUrgency(symptoms), symptoms), expected, symptoms);
    assert.deepEqual((await assessWithAi(symptoms)).emergencyNeeds, expected, symptoms);
  }
  assert.deepEqual(parseEmergencyNeeds("stroke,cardiac,stroke"), ["cardiac", "stroke"]);
  for (const value of ["__proto__", "constructor", "unknown", "cardiac,", ["cardiac"], { $ne: "" }]) {
    assert.throws(() => parseEmergencyNeeds(value));
  }
});

let mongo, server, base, cookie;
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: require("node:crypto").randomBytes(32).toString("hex") });
  mongo = await createTestMongo();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await Provider.init();
  server = require("../src/app").createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const user = await User.create({ name: "Routing test", email: "routing@example.test", passwordHash: "unused-test-hash" });
  cookie = `accessToken=${jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" })}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
const facility = (slug, latitude, extra = {}) => ({
  slug, name: slug, type: "hospital", latitude, longitude: 35.5,
  specialties: ["cardiology"], services: ["cath-lab"], emergency24h: true,
  sources: ["https://example.test/hospital"], verifiedAt: new Date(), ...extra,
});
beforeEach(async () => {
  await Provider.deleteMany({});
  await Provider.create([
    facility("nearest-but-unequipped", 33.9001, { services: [] }),
    facility("unknown-capabilities", 33.9002, { specialties: [], services: [] }),
    facility("clinic-not-hospital", 33.9003, { type: "clinic" }),
    facility("unknown-er", 33.9004, { emergency24h: null }),
    facility("no-er", 33.9005, { emergency24h: false }),
    facility("closest-capable", 33.91),
    facility("farther-capable", 34.1),
    facility("combined-capable", 34.2, { specialties: ["cardiology", "neurology"], services: ["ct", "cath-lab"] }),
  ]);
});
async function get(query) {
  const response = await fetch(`${base}/providers?${query}`);
  return { status: response.status, body: await response.json() };
}
test("filters capabilities before distance, count and pagination; cannot override ER requirement", async () => {
  const { status, body } = await get("emergencyNeeds=cardiac&lat=33.9&lng=35.5&limit=1&emergency24h=false");
  assert.equal(status, 200);
  assert.equal(body.total, 3);
  assert.equal(body.providers[0].id, "closest-capable");
  assert.ok(body.providers[0].distanceKm > 0);
  const second = await get("emergencyNeeds=cardiac&lat=33.9&lng=35.5&limit=1&page=2");
  assert.equal(second.body.providers[0].id, "farther-capable");
});
test("requires every condition and preserves additional service filters", async () => {
  const both = await get("emergencyNeeds=cardiac,stroke&lat=33.9&lng=35.5");
  assert.deepEqual(both.body.providers.map(p => p.id), ["combined-capable"]);
  assert.equal((await get("emergencyNeeds=cardiac&service=ct")).body.total, 1);
  assert.equal((await get("emergencyNeeds=cardiac&service=mri")).body.total, 0);
});
test("no nearby capable hospital returns no match instead of silently dropping requirements", async () => {
  const { body } = await get("emergencyNeeds=cardiac&lat=33.9&lng=35.5&radiusKm=0.1");
  assert.equal(body.total, 0);
  assert.deepEqual(body.providers, []);
  assert.equal((await get("emergencyNeeds=burns")).body.total, 0);
});
test("without GPS matches stay alphabetical and never claim a distance", async () => {
  const { body } = await get("emergencyNeeds=cardiac");
  assert.deepEqual(body.providers.map(p => p.id), ["closest-capable", "combined-capable", "farther-capable"]);
  assert.ok(body.providers.every(p => p.distanceKm === null));
});
test("a capable but unlocated hospital never becomes a nearest recommendation", async () => {
  await Provider.create(facility("unlocated-capable", null, { longitude: null }));
  assert.equal((await get("emergencyNeeds=cardiac")).body.total, 4);
  const { body } = await get("emergencyNeeds=cardiac&lat=33.9&lng=35.5");
  assert.equal(body.total, 3);
  assert.ok(body.providers.every(p => p.id !== "unlocated-capable"));
});
test("rejects malformed, repeated and unknown requirements and incomplete GPS", async () => {
  for (const query of ["emergencyNeeds[$ne]=a", "emergencyNeeds=cardiac&emergencyNeeds=stroke", "emergencyNeeds=constructor", "emergencyNeeds=cardiac,unknown", "emergencyNeeds=cardiac&lat=33.9"]) {
    assert.equal((await get(query)).status, 400, query);
  }
});
test("all triage endpoints carry condition requirements over the real authenticated API", async () => {
  for (const path of ["classify", "refine", "ai-assess"]) {
    const response = await fetch(`${base}/triage/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({ symptoms: "chest pain and slurred speech", answers: {} }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.level, "emergency");
    assert.equal(body.careTypeId, "emergency-department");
    assert.deepEqual(body.emergencyNeeds, ["cardiac", "stroke"]);
  }
});

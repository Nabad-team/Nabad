// One triage engine: the Sprint 1 safety check (policy.js, its own red-flag rules) is retired. Its
// emergency routing and self-care live in careGuidance.js and come with the main engine's result
// (urgency.js + ai/aiTriage.js). These tests need no database, no network and no API key.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { emergencyRoute, routineSelfCare } = require("../src/triage/careGuidance");
const { assessWithAi } = require("../src/triage/ai/aiTriage");
const { classifyUrgency } = require("../src/triage/urgency");

describe("emergency routing (kept from the Sprint 1 safety check)", () => {
  test("Lebanon gets the Lebanese Red Cross on 140", () => {
    const route = emergencyRoute({ country: "LB" });
    assert.equal(route.contactName, "Lebanese Red Cross");
    assert.equal(route.contactNumber, "140");
    assert.match(route.instructions, /140/);
  });

  test("no location means Lebanon", () => {
    assert.equal(emergencyRoute().contactNumber, "140");
    assert.equal(emergencyRoute({}).contactNumber, "140");
  });

  test("outside Lebanon no number is invented", () => {
    const route = emergencyRoute({ country: "FR" });
    assert.equal(route.contactNumber, null);
    assert.match(route.instructions, /local emergency number/);
  });

  test("self-care steps are general and safe: no medicines or doses", () => {
    const steps = routineSelfCare();
    assert.equal(steps.length, 4);
    for (const step of steps) assert.doesNotMatch(step, /\b(mg|tablet|paracetamol|ibuprofen|dose)\b/i);
  });
});

describe("one set of red-flag rules", () => {
  test("an emergency result from the main engine includes the emergency number", async () => {
    const result = await assessWithAi("crushing chest pain and sweating", { location: { country: "LB" } });
    assert.equal(result.level, "emergency");
    assert.equal(result.emergency.contactNumber, "140");
  });

  test("with AI off, the level always matches the rule classifier", async () => {
    for (const symptoms of ["I have a cough and chest pain", "mild headache", "my child has a fever", "I can't breathe"]) {
      const result = await assessWithAi(symptoms);
      assert.equal(result.level, classifyUrgency(symptoms).level, symptoms);
    }
  });

  test("chest pain is an emergency (the old engine said needs_clinical_review)", async () => {
    assert.equal((await assessWithAi("I have a cough and chest pain")).level, "emergency");
  });
});

describe("the old engine is gone", () => {
  test("policy.js no longer exists", () => {
    assert.equal(fs.existsSync(path.join(__dirname, "../src/triage/policy.js")), false);
  });

  test("the triage routes no longer offer /assess or /emergency-route", () => {
    const router = require("../src/routes/triage");
    const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
    assert.ok(paths.includes("/ai-assess"));
    assert.equal(paths.includes("/assess"), false);
    assert.equal(paths.includes("/emergency-route"), false);
  });
});

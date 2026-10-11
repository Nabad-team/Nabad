const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { assessSymptoms, emergencyRoute, loadApprovedRules } = require("../src/triage/policy");

describe("configuration-driven triage policy", () => {
  test("defaults to clinical review when no approved rule matches", () => {
    const result = assessSymptoms("something feels unusual", {}, { TRIAGE_RULES_JSON: "[]" });
    assert.equal(result.level, "needs_clinical_review");
    assert.match(result.guidance, /qualified healthcare professional/);
  });

  test("uses the most serious approved matching rule", () => {
    const env = {
      TRIAGE_RULES_JSON: JSON.stringify([
        { id: "routine-cough", pattern: "\\bcough\\b", level: "routine" },
        { id: "red-flag", pattern: "chest pain", level: "emergency" },
      ]),
    };
    const result = assessSymptoms("I have a cough and chest pain", { country: "LB" }, env);
    assert.equal(result.level, "emergency");
    assert.deepEqual(result.matchedRuleIds, ["red-flag", "routine-cough"]);
    assert.equal(result.routing.contactNumber, "140");
  });

  test("rejects malformed rules instead of treating them as clinical policy", () => {
    const rules = loadApprovedRules({
      TRIAGE_RULES_JSON: JSON.stringify([
        { pattern: "[", level: "emergency" },
        { pattern: "fever", level: "unsupported" },
        { pattern: "cough", level: "routine" },
      ]),
    });
    assert.deepEqual(rules.map((rule) => rule.pattern), ["cough"]);
  });

  test("uses a generic emergency fallback outside Lebanon", () => {
    const result = emergencyRoute({ country: "US" });
    assert.equal(result.contactName, "Local emergency services");
    assert.equal(result.contactNumber, null);
    assert.match(result.instructions, /local emergency number/);
  });
});

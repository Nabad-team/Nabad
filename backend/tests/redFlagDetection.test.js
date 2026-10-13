const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyUrgency,
} = require("../src/triage/urgency");

test("detects chest pain as emergency", () => {
  const result = classifyUrgency(
    "I have chest pain"
  );

  assert.equal(result.level, "emergency");
  assert.ok(
    result.matchedRuleIds.includes("chest-pain")
  );
});

test("detects trouble breathing as emergency", () => {
  const result = classifyUrgency(
    "I am having trouble breathing"
  );

  assert.equal(result.level, "emergency");
  assert.ok(
    result.matchedRuleIds.includes("breathing")
  );
});

test("detects stroke warning symptoms", () => {
  const result = classifyUrgency(
    "I suddenly have slurred speech"
  );

  assert.equal(result.level, "emergency");
  assert.ok(
    result.matchedRuleIds.includes("stroke")
  );
});

test("most serious symptom wins", () => {
  const result = classifyUrgency(
    "I have a cough and chest pain"
  );

  assert.equal(result.level, "emergency");
});

test("does not trigger a negated red flag", () => {
  const result = classifyUrgency(
    "I have a cough but no chest pain"
  );

  assert.ok(
    !result.matchedRuleIds.includes("chest-pain")
  );
});

test("routine symptoms are not emergency", () => {
  const result = classifyUrgency(
    "I have a runny nose"
  );

  assert.equal(result.level, "routine");
});
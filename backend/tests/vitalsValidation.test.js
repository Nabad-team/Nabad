const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readBody } = require("../src/routes/vitals");

test("accepts complete and partial vital readings", () => {
  const recordedAt = new Date(Date.now() - 1000).toISOString();
  assert.deepEqual(readBody({ systolic: 120, diastolic: 80, heartRate: 72, temperature: 36.7, recordedAt }).value, {
    systolic: 120, diastolic: 80, heartRate: 72, temperature: 36.7, recordedAt: new Date(recordedAt),
  });
  assert.equal(readBody({ heartRate: 65, recordedAt }).value.heartRate, 65);
});

test("rejects unsafe shapes and implausible values", () => {
  const recordedAt = new Date().toISOString();
  for (const body of [
    { recordedAt },
    { systolic: 80, diastolic: 120, recordedAt },
    { systolic: 120, recordedAt },
    { heartRate: 251, recordedAt },
    { temperature: 46, recordedAt },
    { heartRate: 70, recordedAt: "not-a-date" },
  ]) assert.ok(readBody(body).error, JSON.stringify(body));
});

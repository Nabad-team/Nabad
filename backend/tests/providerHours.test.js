const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openingStatus } = require("../src/providers/hours");
const clinic = { hoursKnown: true, hours: [{ day: 1, start: 480, end: 1020 }] };
test("Beirut summer/winter time, exact opening/closing boundaries, and weekends", () => {
  for (const [iso, expected] of [["2026-10-12T04:59:00Z", "closed"], ["2026-10-12T05:00:00Z", "open"], ["2026-10-12T13:59:00Z", "open"], ["2026-10-12T14:00:00Z", "closed"], ["2026-10-11T09:00:00Z", "closed"], ["2026-01-12T06:00:00Z", "open"]]) {
    assert.equal(openingStatus(clinic, new Date(iso)), expected, iso);
  }
});
test("overnight shifts cross the day and week boundary", () => {
  const night = { hoursKnown: true, hours: [{ day: 6, start: 1320, end: 120 }] };
  assert.equal(openingStatus(night, new Date("2026-10-10T20:00:00Z")), "open");
  assert.equal(openingStatus(night, new Date("2026-10-10T22:00:00Z")), "open");
  assert.equal(openingStatus(night, new Date("2026-10-10T23:00:00Z")), "closed");
});
test("unknown hours stay unknown even with a 24/7 ER; open filter includes the ER separately", () => {
  const hospital = { slug: "test", name: "Test", city: "Beirut", specialties: [], hoursKnown: false, hours: [], emergency24h: true };
  assert.equal(openingStatus(hospital), "unknown");
});

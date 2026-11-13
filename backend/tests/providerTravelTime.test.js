const { test } = require("node:test");
const assert = require("node:assert/strict");
const Provider = require("../src/models/Provider");
const { parseTravelRequest, drivingMinutes } = require("../src/providers/travelTime");

test("travel requests reject nonnumeric origins and invalid or oversized facility lists", () => {
  const origin = { lat: 33.9, lng: 35.5 };
  assert.throws(() => parseTravelRequest({ ...origin, lat: "33.9", ids: ["clinic"] }));
  assert.throws(() => parseTravelRequest({ ...origin, ids: [{ $ne: "" }] }));
  assert.throws(() => parseTravelRequest({ ...origin, ids: Array(21).fill("clinic") }));
  assert.deepEqual(parseTravelRequest({ ...origin, ids: ["clinic", "clinic"] }), { ...origin, ids: ["clinic"] });
});

test("the road matrix uses known destinations and omits facilities without a route", async t => {
  t.mock.method(Provider, "find", filter => {
    assert.deepEqual(filter.locationApproximate, { $ne: true });
    return { select: () => ({ lean: async () => [
      { slug: "clinic", latitude: 33.8, longitude: 35.4 },
      { slug: "unroutable", latitude: 34.1, longitude: 35.8 },
      { slug: "unlocated", latitude: null, longitude: null },
    ] }) };
  });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.match(url, /\/matrix\/driving-car$/);
    assert.deepEqual(JSON.parse(options.body), {
      locations: [[35.5, 33.9], [35.4, 33.8], [35.8, 34.1]], sources: [0], destinations: [1, 2], metrics: ["duration"],
    });
    return { ok: true, json: async () => ({ durations: [[621, null]] }) };
  });
  assert.deepEqual(await drivingMinutes({ lat: 33.9, lng: 35.5, ids: ["clinic", "unroutable", "unlocated"] }, "test-key"), { clinic: 11 });
});

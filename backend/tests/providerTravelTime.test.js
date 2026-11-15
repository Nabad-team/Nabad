const { test } = require("node:test");
const assert = require("node:assert/strict");
const Provider = require("../src/models/Provider");
const { parseTravelRequest, drivingMinutes } = require("../src/providers/travelTime");

test("travel requests reject nonnumeric origins and invalid or oversized facility lists", () => {
  const origin = { lat: 33.9, lng: 35.5 };
  assert.throws(() => parseTravelRequest({ ...origin, lat: "33.9", ids: ["clinic"] }));
  assert.throws(() => parseTravelRequest({ ...origin, ids: [{ $ne: "" }] }));
  assert.throws(() => parseTravelRequest({ ...origin, ids: Array(21).fill("clinic") }));
  assert.deepEqual(
    parseTravelRequest({ ...origin, ids: ["clinic", "clinic"], userId: "ignored" }),
    { ...origin, ids: ["clinic"] },
  );
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
    assert.equal(url, "https://api.heigit.org/openrouteservice/v2/matrix/driving-car");
    assert.deepEqual(options.headers, { Authorization: "test-key", "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(options.body), {
      locations: [[35.5, 33.9], [35.4, 33.8], [35.8, 34.1]], sources: [0], destinations: [1, 2], metrics: ["duration"],
    });
    return { ok: true, json: async () => ({ durations: [[621, null]] }) };
  });
  assert.deepEqual(await drivingMinutes({ lat: 33.9, lng: 35.5, ids: ["clinic", "unroutable", "unlocated"] }, "test-key"), { clinic: 11 });
});

test("upstream failures retain only a safe reason and status for diagnosis", async t => {
  const query = { lat: 33.9, lng: 35.5, ids: ["clinic"] };
  t.mock.method(Provider, "find", () => ({
    select: () => ({ lean: async () => [{ slug: "clinic", latitude: 33.8, longitude: 35.4 }] }),
  }));
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("private error body", { status: 403 }));
  await assert.rejects(drivingMinutes(query, "test-key"), {
    message: "Routing service unavailable.", reason: "upstream_http_error", status: 403,
  });

  fetch.mock.mockImplementationOnce(async () => new Response("private invalid response"));
  await assert.rejects(drivingMinutes(query, "test-key"), {
    message: "Routing service unavailable.", reason: "upstream_invalid_response",
  });

  fetch.mock.mockImplementationOnce(async () => { throw new Error("private network error"); });
  await assert.rejects(drivingMinutes(query, "test-key"), {
    message: "Routing service unavailable.", reason: "upstream_connection_failed",
  });
});

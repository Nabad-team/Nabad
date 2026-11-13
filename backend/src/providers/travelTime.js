const Provider = require("../models/Provider");

const MAX_DESTINATIONS = 20;
const MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car";

function parseTravelRequest(body) {
  const { lat, lng, ids } = body || {};
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 ||
      !Number.isFinite(lng) || Math.abs(lng) > 180 ||
      !Array.isArray(ids) || !ids.length || ids.length > MAX_DESTINATIONS ||
      !ids.every(id => typeof id === "string" && /^[a-z0-9-]{1,100}$/.test(id))) {
    throw new Error("A valid location and up to 20 facility IDs are required.");
  }
  return { lat, lng, ids: [...new Set(ids)] };
}

async function drivingMinutes({ lat, lng, ids }, apiKey) {
  const rows = await Provider.find({ slug: { $in: ids }, locationApproximate: { $ne: true } })
    .select("slug latitude longitude").lean();
  const destinations = rows.filter(row => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
  if (!destinations.length) return {};

  const response = await fetch(MATRIX_URL, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [[lng, lat], ...destinations.map(row => [row.longitude, row.latitude])],
      sources: [0],
      destinations: destinations.map((_, index) => index + 1),
      metrics: ["duration"],
    }),
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Routing service unavailable.");
  const { durations } = await response.json();
  const seconds = durations?.[0];
  if (!Array.isArray(seconds) || seconds.length !== destinations.length) throw new Error("Invalid routing response.");
  return Object.fromEntries(destinations.flatMap(({ slug }, index) => {
    const duration = seconds[index];
    return Number.isFinite(duration) && duration >= 0 ? [[slug, Math.ceil(duration / 60)]] : [];
  }));
}

module.exports = { parseTravelRequest, drivingMinutes };

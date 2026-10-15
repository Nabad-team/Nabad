const { openingStatus } = require("./hours");
// Parse scalar strings explicitly: objects/arrays must never become MongoDB operators.
function parseQuery(query) {
  const parsed = {};
  for (const key of ["q", "specialty", "city"]) {
    const value = query[key];
    if (value !== undefined && (typeof value !== "string" || value.length > 100)) {
      throw new Error("Invalid search filters.");
    }
    parsed[key] = (value || "").trim().toLowerCase();
  }
  const number = (key, min, max, fallback) => {
    if (query[key] === undefined) return fallback;
    if (typeof query[key] !== "string" || !/^-?\d+(\.\d+)?$/.test(query[key]) || !Number.isFinite(Number(query[key])) || Number(query[key]) < min || Number(query[key]) > max) throw new Error("Invalid distance or pagination filters.");
    return Number(query[key]);
  };
  parsed.lat = number("lat", -90, 90);
  parsed.lng = number("lng", -180, 180);
  parsed.radiusKm = number("radiusKm", 0.1, 500);
  parsed.page = number("page", 1, 100000, 1);
  parsed.limit = number("limit", 1, 100, 20);
  for (const key of ["openNow", "emergency24h", "favorites"]) {
    if (query[key] !== undefined && !["true", "false"].includes(query[key])) throw new Error("Invalid search filters.");
    parsed[key] = query[key] === "true";
  }
  if (!Number.isInteger(parsed.page) || !Number.isInteger(parsed.limit) || (parsed.lat === undefined) !== (parsed.lng === undefined) || (parsed.radiusKm !== undefined && parsed.lat === undefined)) throw new Error("Choose a location before filtering by distance.");
  return parsed;
}
function distanceKm(lat1, lng1, lat2, lng2) {
  const radians = value => value * Math.PI / 180;
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
function filterProviders(providers, query, now = new Date()) {
  return providers.filter(p => (!query.q || `${p.name} ${p.specialties.join(" ").replaceAll("-", " ")}`.toLowerCase().includes(query.q.replaceAll("-", " ")))
    && (!query.specialty || p.specialties.includes(query.specialty))
    && (!query.city || p.city.toLowerCase() === query.city))
    .map(p => ({ ...p, openingStatus: openingStatus(p, now), distanceKm: query.lat === undefined ? null : distanceKm(query.lat, query.lng, p.latitude, p.longitude) }))
    .filter(p => (!query.openNow || p.openingStatus === "open" || p.emergency24h === true) && (!query.emergency24h || p.emergency24h === true))
    .filter(p => query.radiusKm === undefined || p.distanceKm <= query.radiusKm)
    .sort((a, b) => (query.lat === undefined ? 0 : a.distanceKm - b.distanceKm) || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
}
module.exports = { parseQuery, filterProviders, distanceKm };

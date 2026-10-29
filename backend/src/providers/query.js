// Parse scalar strings explicitly: objects/arrays must never become MongoDB operators.
function parseQuery(query) {
  const parsed = {};
  for (const key of ["q", "specialty", "city", "district", "service", "governorate", "insurance"]) {
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
module.exports = { parseQuery };

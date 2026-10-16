// Stable link contract for triage and the provider directory. Never serialize GPS.
export function readProviderFilters(query = {}) {
  const filters = {};
  for (const key of ["q", "specialty", "city", "governorate", "service"]) {
    filters[key] = typeof query[key] === "string" && query[key].length <= 100 ? query[key].trim().toLowerCase() : "";
  }
  for (const key of ["openNow", "emergency24h", "favorites"]) filters[key] = query[key] === "true" || query[key] === true;
  filters.radiusKm = "";
  filters.page = /^\d+$/.test(String(query.page)) && Number(query.page) > 0 && Number(query.page) <= 100000 ? Number(query.page) : 1;
  return filters;
}
export function providerUrl(filters = {}) {
  const query = new URLSearchParams();
  const safe = readProviderFilters(filters);
  for (const [key, value] of Object.entries(safe)) {
    if (key !== "radiusKm" && value && !(key === "page" && value === 1)) query.set(key, String(value));
  }
  return `/providers${query.size ? `?${query}` : ""}`;
}
// Triage returns urgency, not a specialty. careType is localized prose, not an ID.
// Keep emergency browsing broad; do not infer a specialty from symptoms or rule IDs.
export function triageProviderUrl(result) {
  const filters = {};
  if (result?.level === "emergency") filters.emergency24h = true;
  return providerUrl(filters);
}

// Stable link contract for triage and the provider directory. Never serialize GPS.
import providerText from "../locales/en/providers.json";

const SPECIALTY_NAMES = providerText.specialties;
export const EMERGENCY_NEED_IDS = Object.keys(providerText.emergencyNeeds);
const validNeeds = value => typeof value === "string" && value.length <= 100 && value.split(",").every(id => EMERGENCY_NEED_IDS.includes(id));

export function readProviderFilters(query = {}) {
  const filters = {};
  for (const key of ["q", "specialty", "city", "district", "governorate", "service", "insurance"]) {
    filters[key] = typeof query[key] === "string" && query[key].length <= 100 ? query[key].trim().toLowerCase() : "";
  }
  for (const key of ["openNow", "emergency24h", "favorites"]) filters[key] = query[key] === "true" || query[key] === true;
  filters.emergencyNeeds = query.emergencyNeeds === undefined || query.emergencyNeeds === "" ? ""
    : validNeeds(query.emergencyNeeds) ? [...new Set(query.emergencyNeeds.split(","))].sort().join(",") : "invalid";
  if (filters.emergencyNeeds) filters.emergency24h = true;
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
// SCRUM-278: triage now returns careTypeId, a fixed id chosen by the server
// (backend/src/triage/careTypes.js). This allow-list is the only place an id becomes directory
// filters. careType stays localized prose and is still never parsed, and no specialty is ever
// inferred here from symptoms or rule ids. An unknown or missing id opens the unfiltered directory.
// Specialist ids are the directory's own specialty slugs; general practice opens family medicine.
const CARE_TYPE_FILTERS = {
  "emergency-department": { emergency24h: true },
  "urgent-care": { emergency24h: true },
  "general-practitioner": { specialty: "family-medicine" },
  "self-care": { specialty: "family-medicine" }, // if it does not improve, a family doctor is the next step
  cardiology: { specialty: "cardiology" },
  dermatology: { specialty: "dermatology" },
  ent: { specialty: "ent" },
  neurology: { specialty: "neurology" },
  "obstetrics-gynecology": { specialty: "obstetrics-gynecology" },
  ophthalmology: { specialty: "ophthalmology" },
  orthopedics: { specialty: "orthopedics" },
  pediatrics: { specialty: "pediatrics" },
  psychiatry: { specialty: "psychiatry" },
  surgery: { specialty: "surgery" },
};
export const TRIAGE_CARE_TYPE_IDS = Object.keys(CARE_TYPE_FILTERS);

export function triageProviderFilters(result) {
  // Only server-selected requirement IDs cross this boundary, never symptoms or model prose.
  if (result?.level === "emergency") {
    const needs = Array.isArray(result.emergencyNeeds) ? result.emergencyNeeds : [];
    return { emergency24h: true, ...(needs.length ? { emergencyNeeds: needs.every(id => EMERGENCY_NEED_IDS.includes(id)) ? [...new Set(needs)].sort().join(",") : "invalid" } : {}) };
  }
  const id = result?.careTypeId;
  if (typeof id !== "string" || !Object.hasOwn(CARE_TYPE_FILTERS, id)) return {};
  const filters = { ...CARE_TYPE_FILTERS[id] };
  // Urgent means "seen today", so a specialty is shown among the 24/7 emergency facilities.
  if (result.level === "urgent" && filters.specialty) filters.emergency24h = true;
  return filters;
}
export function triageProviderUrl(result) {
  return providerUrl(triageProviderFilters(result));
}
// The words on the "Find care" button, so the user knows what the directory will show.
export function triageProviderLabel(result) {
  const { specialty, emergency24h, emergencyNeeds } = triageProviderFilters(result);
  if (emergencyNeeds) return "Find a hospital with the required emergency capabilities in Lebanon";
  const name = specialty ? SPECIALTY_NAMES[specialty]?.toLowerCase() : null;
  if (name && emergency24h) return `Browse 24/7 ER facilities with ${name} in Lebanon`;
  if (name) return `Find ${name} providers in Lebanon`;
  if (emergency24h) return "Browse published 24/7 ER facilities in Lebanon";
  return "Browse hospitals and clinics in Lebanon";
}

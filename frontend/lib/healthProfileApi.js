import { request } from "./api";

// "My health" for the signed-in user ("self") or one of their linked profiles (backend: routes/healthProfile.js,
// mounted at /api/health-profile). Every call names the profile, like lib/medicationApi.js.
// getHealthProfile returns { dateOfBirth, age, facts, suggestions, medications, summary }:
//   age: { years, text } ("34 years", "8 months") or null when there is no date of birth
//   facts / suggestions: [{ id, category, value, source, status, recordedAt, updatedAt }]
//     (see lib/healthProfile.js for the categories and their values)
//   medications: the active ones, read only here: [{ id, name, dose, unit, form, frequency }]
//   summary: the plain text Nabad's guidance takes into account; its last line covers recent water and sleep,
//     only when something was logged in the last 7 days

const path = (profileId, rest = "") => "/health-profile" + rest + "?profileId=" + encodeURIComponent(profileId);
const id = (value) => "/" + encodeURIComponent(value);

// date: the user's local "YYYY-MM-DD", so "fluids today" in the summary means their today (optional).
export const getHealthProfile = (profileId, date) => request(path(profileId) + (date ? "&date=" + date : ""));
export const addHealthFact = (profileId, category, value) =>
  request(path(profileId, "/facts"), { method: "POST", body: JSON.stringify({ category, value }) }).then((data) => data.fact);
export const updateHealthFact = (profileId, factId, value) =>
  request(path(profileId, "/facts" + id(factId)), { method: "PUT", body: JSON.stringify({ value }) }).then((data) => data.fact);
export const removeHealthFact = (profileId, factId) => request(path(profileId, "/facts" + id(factId)), { method: "DELETE" });
export const confirmSuggestion = (profileId, factId) =>
  request(path(profileId, "/suggestions" + id(factId) + "/confirm"), { method: "POST" }).then((data) => data.fact);
export const dismissSuggestion = (profileId, factId) => request(path(profileId, "/suggestions" + id(factId) + "/dismiss"), { method: "POST" });

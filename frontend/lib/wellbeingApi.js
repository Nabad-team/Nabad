import { request } from "./api";

// Water and sleep tracking for the signed-in user ("self") or one of their linked profiles
// (backend: routes/wellbeing.js). Every call names the profile, like lib/medicationApi.js.
// Days are the user's local date as "YYYY-MM-DD" (see todayString() in lib/dates.js).
//   water: { date, glasses, target }   target is null unless the user set a goal
//   sleep: { date, hours, quality, note } or null   quality is 1 (very poorly) to 5 (very well)

const path = (profileId, rest) => "/wellbeing" + rest + (rest.includes("?") ? "&" : "?") + "profileId=" + encodeURIComponent(profileId);

export const getToday = (profileId, date) => request(path(profileId, "/today?date=" + date));
export const addGlass = (profileId, date) =>
  request(path(profileId, "/water/glass"), { method: "POST", body: JSON.stringify({ date }) }).then((data) => data.water);
export const removeGlass = (profileId, date) =>
  request(path(profileId, "/water/glass?date=" + date), { method: "DELETE" }).then((data) => data.water);
export const setWaterTarget = (profileId, target) =>
  request(path(profileId, "/water/target"), { method: "PUT", body: JSON.stringify({ target }) }).then((data) => data.target);
export const clearWaterTarget = (profileId) =>
  request(path(profileId, "/water/target"), { method: "DELETE" }).then((data) => data.target);
export const saveSleep = (profileId, date, { hours, quality, note }) =>
  request(path(profileId, "/sleep/" + date), { method: "PUT", body: JSON.stringify({ hours, quality, note }) }).then((data) => data.sleep);
export const deleteSleep = (profileId, date) => request(path(profileId, "/sleep/" + date), { method: "DELETE" });
// { days: [{ date, glasses (or null), sleep (or null) }], target }, oldest day first.
export const getHistory = (profileId, end, days = 7) => request(path(profileId, `/history?days=${days}&end=${end}`));

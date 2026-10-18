import { request } from "./api";

// Water and sleep tracking for the signed-in user ("self") or one of their linked profiles
// (backend: routes/wellbeing.js). Every call names the profile, like lib/medicationApi.js.
// Days are the user's local date as "YYYY-MM-DD" (see todayString() in lib/dates.js). Fluids are in millilitres.
//   water: { date, totalMl, entries: [{ ml, at }], goal }   entries oldest first; goal is null unless the user set one
//   goal:  { type: "atLeast" | "atMost", ml }               "atMost" is a limit, for people on fluid restriction
//   sleep: { date, hours, bedtime, wakeTime, quality, note } or null
//          bedtime and wakeTime are "HH:MM" or null; quality is 1 (very poorly) to 5 (very well)

const path = (profileId, rest) => "/wellbeing" + rest + (rest.includes("?") ? "&" : "?") + "profileId=" + encodeURIComponent(profileId);

export const getToday = (profileId, date) => request(path(profileId, "/today?date=" + date));
export const addDrink = (profileId, date, ml) =>
  request(path(profileId, "/water/entries"), { method: "POST", body: JSON.stringify({ date, ml }) }).then((data) => data.water);
export const undoLastDrink = (profileId, date) =>
  request(path(profileId, "/water/entries/last?date=" + date), { method: "DELETE" }).then((data) => data.water);
export const setWaterGoal = (profileId, { type, ml }) =>
  request(path(profileId, "/water/goal"), { method: "PUT", body: JSON.stringify({ type, ml }) }).then((data) => data.goal);
export const clearWaterGoal = (profileId) =>
  request(path(profileId, "/water/goal"), { method: "DELETE" }).then((data) => data.goal);
// Send hours, or bedtime and wakeTime ("HH:MM", then the server works the hours out).
export const saveSleep = (profileId, date, { hours, bedtime, wakeTime, quality, note }) =>
  request(path(profileId, "/sleep/" + date), { method: "PUT", body: JSON.stringify({ hours, bedtime, wakeTime, quality, note }) }).then((data) => data.sleep);
export const deleteSleep = (profileId, date) => request(path(profileId, "/sleep/" + date), { method: "DELETE" });
// { days: [{ date, totalMl (or null), sleep (or null) }], goal }, oldest day first. days: 7, 14 or 30.
export const getHistory = (profileId, end, days = 7) => request(path(profileId, `/history?days=${days}&end=${end}`));

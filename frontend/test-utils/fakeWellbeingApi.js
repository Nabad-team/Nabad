// In-memory stand-in for lib/wellbeingApi.js, used only by tests. Like the backend, everything is
// kept per profile, one water and one sleep entry per day, and there is no water goal until one is set.
// Use it with:
//   jest.mock("../lib/wellbeingApi", () => require("../test-utils/fakeWellbeingApi"));
// and call resetFakeWellbeing() in beforeEach.

let store;
export const calls = [];
export function resetFakeWellbeing() {
  store = {};
  calls.length = 0;
}
resetFakeWellbeing();

function profile(profileId) {
  if (!store[profileId]) store[profileId] = { water: {}, sleep: {}, goal: null };
  return store[profileId];
}
// "2026-10-12", -1 -> "2026-10-11"
export function shiftDate(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Test helpers: put data straight into the fake. seedWater logs the amount as one drink at 08:00 local time
// (or as the drinks given, e.g. seedWater("self", date, [250, 500])).
export function seedWater(profileId, date, ml) {
  const amounts = Array.isArray(ml) ? ml : [ml];
  const [year, month, day] = date.split("-").map(Number);
  profile(profileId).water[date] = amounts.map((amount, i) => ({ ml: amount, at: new Date(year, month - 1, day, 8, i * 5).toISOString() }));
}
export function seedSleep(profileId, date, hours, quality = 3, note = "", times = {}) {
  profile(profileId).sleep[date] = { date, hours, bedtime: times.bedtime || null, wakeTime: times.wakeTime || null, quality, note };
}
export function seedGoal(profileId, goal) { profile(profileId).goal = goal; }
export const fakeData = (profileId) => profile(profileId);
export const totalOn = (profileId, date) => (profile(profileId).water[date] || []).reduce((sum, entry) => sum + entry.ml, 0);

const water = (profileId, date) => ({
  date, totalMl: totalOn(profileId, date), entries: (profile(profileId).water[date] || []).slice(), goal: profile(profileId).goal,
});

export async function getToday(profileId, date) {
  calls.push(["getToday", profileId, date]);
  return { date, water: water(profileId, date), sleep: profile(profileId).sleep[date] || null };
}
export async function addDrink(profileId, date, ml) {
  calls.push(["addDrink", profileId, date, ml]);
  if (totalOn(profileId, date) + ml > 10000) throw new Error("10 litres is the most this tracker records for one day.");
  const data = profile(profileId);
  data.water[date] = [...(data.water[date] || []), { ml, at: new Date().toISOString() }];
  return water(profileId, date);
}
export async function undoLastDrink(profileId, date) {
  calls.push(["undoLastDrink", profileId, date]);
  const data = profile(profileId);
  if (data.water[date]) data.water[date] = data.water[date].slice(0, -1);
  return water(profileId, date);
}
export async function setWaterGoal(profileId, goal) {
  calls.push(["setWaterGoal", profileId, goal]);
  profile(profileId).goal = { type: goal.type, ml: goal.ml };
  return profile(profileId).goal;
}
export async function clearWaterGoal(profileId) {
  calls.push(["clearWaterGoal", profileId]);
  profile(profileId).goal = null;
  return null;
}
// Works the hours out from the times like the server does.
export async function saveSleep(profileId, date, entry) {
  calls.push(["saveSleep", profileId, date, entry]);
  let { hours } = entry;
  if (entry.bedtime && entry.wakeTime) {
    const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    hours = Math.round((((minutes(entry.wakeTime) - minutes(entry.bedtime) + 1440) % 1440) / 60) * 100) / 100;
  }
  profile(profileId).sleep[date] = {
    date, hours, bedtime: entry.bedtime || null, wakeTime: entry.wakeTime || null, quality: entry.quality, note: entry.note || "",
  };
  return profile(profileId).sleep[date];
}
export async function deleteSleep(profileId, date) {
  calls.push(["deleteSleep", profileId, date]);
  delete profile(profileId).sleep[date];
}
export async function getHistory(profileId, end, days = 7) {
  calls.push(["getHistory", profileId, end, days]);
  const data = profile(profileId);
  const list = Array.from({ length: days }, (_, i) => {
    const date = shiftDate(end, i - days + 1);
    const logged = data.water[date] && data.water[date].length;
    return { date, totalMl: logged ? totalOn(profileId, date) : null, sleep: data.sleep[date] || null };
  });
  return { days: list, goal: data.goal };
}

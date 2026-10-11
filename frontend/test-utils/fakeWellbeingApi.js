// In-memory stand-in for lib/wellbeingApi.js, used only by tests. Like the backend, everything is
// kept per profile, one water and one sleep entry per day, and there is no water target until one is set.
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
  if (!store[profileId]) store[profileId] = { water: {}, sleep: {}, target: null };
  return store[profileId];
}
// "2026-10-12", -1 -> "2026-10-11"
export function shiftDate(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Test helpers: put data straight into the fake.
export function seedWater(profileId, date, glasses) { profile(profileId).water[date] = glasses; }
export function seedSleep(profileId, date, hours, quality = 3, note = "") { profile(profileId).sleep[date] = { date, hours, quality, note }; }
export function seedTarget(profileId, target) { profile(profileId).target = target; }
export const fakeData = (profileId) => profile(profileId);

const water = (profileId, date) => ({ date, glasses: profile(profileId).water[date] || 0, target: profile(profileId).target });

export async function getToday(profileId, date) {
  calls.push(["getToday", profileId, date]);
  return { date, water: water(profileId, date), sleep: profile(profileId).sleep[date] || null };
}
export async function addGlass(profileId, date) {
  calls.push(["addGlass", profileId, date]);
  const data = profile(profileId);
  if ((data.water[date] || 0) >= 30) throw new Error("30 glasses is the most this tracker records for one day.");
  data.water[date] = (data.water[date] || 0) + 1;
  return water(profileId, date);
}
export async function removeGlass(profileId, date) {
  calls.push(["removeGlass", profileId, date]);
  const data = profile(profileId);
  if (data.water[date]) data.water[date] -= 1;
  return water(profileId, date);
}
export async function setWaterTarget(profileId, target) {
  calls.push(["setWaterTarget", profileId, target]);
  profile(profileId).target = target;
  return target;
}
export async function clearWaterTarget(profileId) {
  calls.push(["clearWaterTarget", profileId]);
  profile(profileId).target = null;
  return null;
}
export async function saveSleep(profileId, date, entry) {
  calls.push(["saveSleep", profileId, date, entry]);
  profile(profileId).sleep[date] = { date, ...entry };
  return profile(profileId).sleep[date];
}
export async function deleteSleep(profileId, date) {
  calls.push(["deleteSleep", profileId, date]);
  delete profile(profileId).sleep[date];
}
export async function getHistory(profileId, end, days = 7) {
  calls.push(["getHistory", profileId, end]);
  const data = profile(profileId);
  const list = Array.from({ length: days }, (_, i) => {
    const date = shiftDate(end, i - days + 1);
    return { date, glasses: date in data.water ? data.water[date] : null, sleep: data.sleep[date] || null };
  });
  return { days: list, target: data.target };
}

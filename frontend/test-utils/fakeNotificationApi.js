// An in-memory stand-in for lib/notificationApi.js. Use with
// jest.mock("../lib/notificationApi", () => require("../test-utils/fakeNotificationApi")).
const actual = jest.requireActual("../lib/notificationApi");
export const { NOTIFICATION_TYPES, NOTIFICATIONS_CHANGED, announceNotificationsChanged, timeAgo } = actual;

let notifications = [];
let muted = new Set();
let nextId = 1;
export const calls = [];
export const failures = new Set();

export function resetFakeNotifications() {
  notifications = []; muted = new Set(); nextId = 1; calls.length = 0; failures.clear();
}
// Newest first, like the API: each seeded notification is newer than the ones before.
export function seedNotification(fields = {}) {
  const id = `n${nextId++}`;
  notifications.unshift({ id, profileId: "self", type: "appointment_reminder", title: `Notification ${id}`, message: "Your appointment at City Hospital is in 1 hour (10:00).", link: "/appointments", read: false, readAt: null, createdAt: new Date().toISOString(), ...fields });
  return id;
}
export const storedNotifications = () => notifications.map((item) => ({ ...item }));
function check(name) {
  calls.push(name);
  if (failures.has(name)) return Promise.reject(new Error("Request failed."));
  return null;
}

export async function getNotifications({ page = 1, limit = 20, profileId, unread } = {}) {
  calls.push(["getNotifications", { page, limit, profileId, unread }]);
  if (failures.has("getNotifications")) throw new Error("Request failed.");
  const matching = notifications.filter((item) => (!profileId || item.profileId === profileId) && (!unread || !item.read));
  const start = (page - 1) * limit;
  return { notifications: matching.slice(start, start + limit).map((item) => ({ ...item })), page, limit, total: matching.length, hasMore: start + limit < matching.length };
}
export async function getUnreadCount() {
  await check("getUnreadCount");
  return notifications.filter((item) => !item.read).length;
}
export async function markNotificationRead(id, options) {
  calls.push(["markNotificationRead", id, options]);
  if (failures.has("markNotificationRead")) throw new Error("Request failed.");
  const item = notifications.find((n) => n.id === id);
  if (!item.read) Object.assign(item, { read: true, readAt: new Date().toISOString() });
  return { ...item };
}
export async function markAllNotificationsRead() {
  await check("markAllNotificationsRead");
  notifications.forEach((item) => { if (!item.read) Object.assign(item, { read: true, readAt: new Date().toISOString() }); });
  return {};
}
export async function deleteNotification(id) {
  await check("deleteNotification");
  notifications = notifications.filter((item) => item.id !== id);
}
const preferencesView = () => NOTIFICATION_TYPES.map(({ type }) => {
  const alwaysOn = ["emergency_alert", "caregiver_urgent"].includes(type);
  return { type, enabled: alwaysOn || !muted.has(type), alwaysOn };
});
export async function getNotificationPreferences() {
  await check("getNotificationPreferences");
  return preferencesView();
}
export async function updateNotificationPreferences(changes) {
  calls.push(["updateNotificationPreferences", changes]);
  if (failures.has("updateNotificationPreferences")) throw new Error("Request failed.");
  Object.entries(changes).forEach(([type, enabled]) => (enabled ? muted.delete(type) : muted.add(type)));
  return preferencesView();
}

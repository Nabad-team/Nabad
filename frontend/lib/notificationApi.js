import { request } from "./api";

// In-app notifications (backend routes/notifications.js). They are created by the server, never here.
export const NOTIFICATION_TYPES = [
  { type: "appointment_reminder", label: "Appointment reminders", hint: "Before a doctor's appointment, at the reminder time you chose." },
  { type: "emergency_alert", label: "Emergency alerts", hint: "When something needs urgent care." },
  { type: "caregiver_urgent", label: "Care circle alerts", hint: "When a symptom check of someone whose care circle you're in needs attention." },
  { type: "document_ready", label: "Documents ready", hint: "When a document you asked for is ready." },
  { type: "system", label: "Account and service updates", hint: "Important news about your account or Nabad." },
];

// Pages and the header bell send this event after changing notifications, so every count on the page stays in step.
export const NOTIFICATIONS_CHANGED = "nabad:notifications-changed";
export const announceNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export function getNotifications({ page = 1, limit = 20, profileId, unread } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (profileId) query.set("profileId", profileId);
  if (unread) query.set("unread", "true");
  return request(`/notifications?${query}`);
}
export const getUnreadCount = () => request("/notifications/unread-count").then((data) => data.count);
// keepalive lets the request finish when it is sent just before following a link.
export const markNotificationRead = (id, { keepalive = false } = {}) => request(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST", keepalive }).then((data) => data.notification);
export const markAllNotificationsRead = () => request("/notifications/read-all", { method: "POST" });
export const deleteNotification = (id) => request(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
export const getNotificationPreferences = () => request("/notifications/preferences").then((data) => data.preferences);
export const updateNotificationPreferences = (changes) => request("/notifications/preferences", { method: "PUT", body: JSON.stringify(changes) }).then((data) => data.preferences);

// "Just now", "5 minutes ago", "3 hours ago", "Yesterday", then the date.
export function timeAgo(isoDate, now = new Date()) {
  const date = new Date(isoDate);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (hours < 48) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

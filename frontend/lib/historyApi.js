import { request } from "./api";

// SCRUM-156: questions about the active profile's own history (backend: routes/history.js).
// useAi: the person agreed to send the question and the matching records to the AI provider.
export const askHistory = (profileId, question, useAi, signal) => request(`/history/ask?profileId=${encodeURIComponent(profileId)}`, {
  method: "POST",
  signal,
  body: JSON.stringify({ question, useAi, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Beirut" }),
});

// SCRUM-332: "My health story", the active profile's records month by month (backend: healthStory.js).
// until: the last month to show ("YYYY-MM"), or undefined for this month.
export function getHealthStory(profileId, { until, months } = {}, signal) {
  const query = new URLSearchParams({ profileId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Beirut" });
  if (until) query.set("until", until);
  if (months) query.set("months", String(months));
  return request(`/history/timeline?${query}`, { signal });
}

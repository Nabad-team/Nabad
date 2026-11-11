import { request } from "./api";

// SCRUM-156: questions about the active profile's own history (backend: routes/history.js).
// useAi: the person agreed to send the question and the matching records to the AI provider.
export const askHistory = (profileId, question, useAi, signal) => request(`/history/ask?profileId=${encodeURIComponent(profileId)}`, {
  method: "POST",
  signal,
  body: JSON.stringify({ question, useAi, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Beirut" }),
});

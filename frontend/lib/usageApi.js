import { request } from "./api";

// SCRUM-311: the team's usage dashboard (backend: routes/usage.js). Anonymous daily totals only.
// Anyone who is not on the team gets a 404, the same as a page that doesn't exist.
export const getUsageSummary = (days, signal) => request(`/usage/summary?days=${encodeURIComponent(days)}`, { signal, cache: "no-store" });

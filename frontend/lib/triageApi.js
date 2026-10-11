// SCRUM-128: asks the backend how urgent a symptom description is.
// Kept in its own file (not lib/api.js) so pages and tests can mock triage on its own.
import { request } from "./api";

export const classifyUrgency = (symptoms) =>
  request("/triage/classify", { method: "POST", body: JSON.stringify({ symptoms }) });

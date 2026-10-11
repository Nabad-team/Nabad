// Triage calls. Kept in its own file (not lib/api.js) so pages and tests can mock triage on its own.
import { request } from "./api";

// SCRUM-128: first urgency result for a description (plus follow-up questions, SCRUM-126).
export const classifyUrgency = (symptoms) =>
  request("/triage/classify", { method: "POST", body: JSON.stringify({ symptoms }) });

// SCRUM-126: final result after the follow-up answers ({ questionId: optionValue }).
export const refineUrgency = (symptoms, answers) =>
  request("/triage/refine", { method: "POST", body: JSON.stringify({ symptoms, answers }) });

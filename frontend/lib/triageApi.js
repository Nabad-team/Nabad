// Triage calls. Kept in its own file (not lib/api.js) so pages and tests can mock triage on its own.
import { request } from "./api";

export const assessSymptoms = (symptoms, location) =>
  request("/triage/assess", {
    method: "POST",
    body: JSON.stringify({ symptoms, location }),
  });

export const getEmergencyRoute = (location) =>
  request("/triage/emergency-route", {
    method: "POST",
    body: JSON.stringify({ location }),
  });

// SCRUM-128: first urgency result for a description (plus follow-up questions, SCRUM-126).
export const classifyUrgency = (symptoms) =>
  request("/triage/classify", { method: "POST", body: JSON.stringify({ symptoms }) });

// SCRUM-126: final result after the follow-up answers ({ questionId: optionValue }).
export const refineUrgency = (symptoms, answers) =>
  request("/triage/refine", { method: "POST", body: JSON.stringify({ symptoms, answers }) });

// Triage calls. Kept in its own file (not lib/api.js) so pages and tests can mock triage on its own.
import { request } from "./api";

// SCRUM-128: first urgency result for a description (plus follow-up questions, SCRUM-126).
export const classifyUrgency = (symptoms) =>
  request("/triage/classify", { method: "POST", body: JSON.stringify({ symptoms }) });

// SCRUM-126: final result after the follow-up answers ({ questionId: optionValue }).
export const refineUrgency = (symptoms, answers) =>
  request("/triage/refine", { method: "POST", body: JSON.stringify({ symptoms, answers }) });

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

// SCRUM-125: the symptoms page sends the user's own words to AI triage (/ai-assess). The server
// keeps the safety rules as the floor and answers with the rules alone when the AI is off or
// unavailable, so this is never less safe than /classify. Same response shape, plus an explanation.
export const assessUrgency = (symptoms) =>
  request("/triage/ai-assess", { method: "POST", body: JSON.stringify({ symptoms }) });

// SCRUM-125: the same assessment again with the follow-up answers ({ questionId: optionValue }).
export const assessUrgencyWithAnswers = (symptoms, answers) =>
  request("/triage/ai-assess", { method: "POST", body: JSON.stringify({ symptoms, answers }) });

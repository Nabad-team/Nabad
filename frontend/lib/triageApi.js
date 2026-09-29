import { request } from "./request";

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

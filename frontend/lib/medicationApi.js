import { request } from "./api";

// The signed-in user's medications (backend: routes/medications.js).
// Each medication: { id, name, dose, unit, form, frequency, startDate, endDate, status, notes }.
// Dates are "YYYY-MM-DD" strings; endDate is "" when there is none. status is "active" or "discontinued".
export const MEDICATION_FORMS = ["tablet", "syrup", "injection", "inhaler", "drops", "other"];

export const getMedications = () => request("/medications").then((data) => data.medications);
export const addMedication = (fields) =>
  request("/medications", { method: "POST", body: JSON.stringify(fields) }).then((data) => data.medication);
export const updateMedication = (id, fields) =>
  request("/medications/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(fields) }).then((data) => data.medication);
export const setMedicationStatus = (id, status) =>
  request("/medications/" + encodeURIComponent(id) + "/status", { method: "PATCH", body: JSON.stringify({ status }) }).then((data) => data.medication);
export const deleteMedication = (id) => request("/medications/" + encodeURIComponent(id), { method: "DELETE" });

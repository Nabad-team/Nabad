import { request } from "./api";

// Medications of the signed-in user ("self") or of one of their linked profiles (backend: routes/medications.js).
// Every call names the profile, so the list always matches the profile chosen in the header.
// Each medication: { id, profileId, name, dose, unit, form, frequency, startDate, endDate, status, notes }.
// Dates are "YYYY-MM-DD" strings; endDate is "" when there is none. status is "active" or "discontinued".
export const MEDICATION_FORMS = ["tablet", "syrup", "injection", "inhaler", "drops", "other"];

const path = (profileId, id, rest = "") =>
  "/medications" + (id ? "/" + encodeURIComponent(id) + rest : "") + "?profileId=" + encodeURIComponent(profileId);

export const getMedications = (profileId) => request(path(profileId)).then((data) => data.medications);
export const getMedicationAdherence = (profileId, date) => request(`/medications/adherence?profileId=${encodeURIComponent(profileId)}&date=${encodeURIComponent(date)}`).then((data) => data.medications);
export const setMedicationTaken = (profileId, id, date, taken) =>
  request(path(profileId, id, "/adherence"), { method: "PUT", body: JSON.stringify({ date, taken }) });
export const addMedication = (profileId, fields) =>
  request(path(profileId), { method: "POST", body: JSON.stringify(fields) }).then((data) => data.medication);
export const updateMedication = (profileId, id, fields) =>
  request(path(profileId, id), { method: "PUT", body: JSON.stringify(fields) }).then((data) => data.medication);
export const setMedicationStatus = (profileId, id, status) =>
  request(path(profileId, id, "/status"), { method: "PATCH", body: JSON.stringify({ status }) }).then((data) => data.medication);
export const deleteMedication = (profileId, id) => request(path(profileId, id), { method: "DELETE" });

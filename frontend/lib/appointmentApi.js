import { request } from "./api";

const path = (profileId, id = "") =>
  `/appointments${id ? `/${encodeURIComponent(id)}` : ""}?profileId=${encodeURIComponent(profileId)}`;

export const REMINDER_OPTIONS = [
  [0, "At the appointment time"],
  [15, "15 minutes before"],
  [30, "30 minutes before"],
  [60, "1 hour before"],
  [1440, "1 day before"],
];
export const getAppointments = (profileId) => request(path(profileId)).then((data) => data.appointments);
export const addAppointment = (profileId, fields) => request(path(profileId), { method: "POST", body: JSON.stringify(fields) }).then((data) => data.appointment);
export const updateAppointment = (profileId, id, fields) => request(path(profileId, id), { method: "PUT", body: JSON.stringify(fields) }).then((data) => data.appointment);
export const deleteAppointment = (profileId, id) => request(path(profileId, id), { method: "DELETE" });

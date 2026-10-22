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
// The browser's time zone goes with every save, so the server-side reminder (the notification bell) fires at the
// same local time as the reminder on this page.
const withTimeZone = (fields) => JSON.stringify({ ...fields, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
export const addAppointment = (profileId, fields) => request(path(profileId), { method: "POST", body: withTimeZone(fields) }).then((data) => data.appointment);
export const updateAppointment = (profileId, id, fields) => request(path(profileId, id), { method: "PUT", body: withTimeZone(fields) }).then((data) => data.appointment);
export const deleteAppointment = (profileId, id) => request(path(profileId, id), { method: "DELETE" });

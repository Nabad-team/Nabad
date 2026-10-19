const appointmentData = {};
export const calls = [];

export function resetFakeAppointments() {
  Object.keys(appointmentData).forEach((key) => delete appointmentData[key]);
  calls.length = 0;
}
export function seedAppointment(profileId, appointment) {
  appointmentData[profileId] ||= [];
  appointmentData[profileId].push({ id: `appointment-${appointmentData[profileId].length + 1}`, title: "Check-up", hospital: "City Hospital", appointmentDate: "2026-10-20", appointmentTime: "10:00", ...appointment });
}
export async function getAppointments(profileId) {
  calls.push(["getAppointments", profileId]);
  return (appointmentData[profileId] || []).map((item) => ({ ...item }));
}

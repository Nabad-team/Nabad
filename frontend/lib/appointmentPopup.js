// The browser pop-up for an appointment reminder (pages/appointments.js). It can appear on a locked screen or over
// another app, so it names no appointment title, clinic or date: only the time. Details are in Nabad after opening it.
export function appointmentPopup(appointment) {
  return { title: "Nabad reminder", body: `You have an appointment at ${appointment.appointmentTime}. Open Nabad for details.` };
}

// The dashboard's "Next step": one short line and one button, picked from data the dashboard already loads.
// In this order, the first that applies wins:
//   1. a medication dose due in the next 3 hours       "Take Amlodipine 5 mg at 08:00"         Open medications
//   2. an appointment in the next 3 days                "Cardiology check-up on Friday: ..."     Prepare visit
//   3. My health basics not all filled in               "Add your health basics for safer ..."   Open my health
//   4. no sleep logged for today                        "Log last night's sleep"                 Log sleep
// Nothing applies -> null, and the card is hidden. Plain reminders only: no medical advice.
// Every time is Beirut time (APP_TIME_ZONE), whatever the device's time zone.
import { APP_TIME_ZONE } from "./dates";

export const DOSE_WINDOW_MINUTES = 3 * 60;
export const APPOINTMENT_WINDOW_MINUTES = 3 * 24 * 60;
const BASICS_COUNT = 5;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const beirutClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// A Beirut wall-clock moment as minutes on one shared scale (as if Beirut were UTC), so dates and times
// typed in Beirut ("2026-11-20", "08:00") can be compared with "now" by plain subtraction.
function beirutNowMinutes(now) {
  const parts = Object.fromEntries(beirutClock.formatToParts(now).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute) / 60000;
}
function wallMinutes(day, time) {
  const date = DAY.exec(day || "");
  const clock = TIME.exec(time || "");
  if (!date || !clock) return null;
  return Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), Number(clock[1]), Number(clock[2])) / 60000;
}
// The line can start with something the user typed ("checking on my date"), so its first letter is capitalised.
export const sentence = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

const dayOf = (minutes) => new Date(minutes * 60000).toISOString().slice(0, 10);
const startOfDay = (minutes) => Math.floor(minutes / 1440) * 1440;

// "today", "tomorrow" or "on Friday" for an appointment day, counted in Beirut.
function whenText(appointmentMinutes, nowMinutes) {
  const days = Math.round((startOfDay(appointmentMinutes) - startOfDay(nowMinutes)) / 1440);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${WEEKDAYS[new Date(appointmentMinutes * 60000).getUTCDay()]}`;
}

// The next dose of an active medication within the window. A medication already checked off today
// is skipped when it has only one dose a day (the check-in is one tick per day); a dose after midnight
// belongs to tomorrow, so today's tick doesn't hide it.
function nextDose(medications, nowMinutes) {
  const today = dayOf(nowMinutes);
  const tomorrow = dayOf(nowMinutes + 1440);
  let best = null;
  for (const medication of medications || []) {
    const times = (medication.times || []).filter((time) => TIME.test(time));
    for (const time of times) {
      for (const day of [today, tomorrow]) {
        const at = wallMinutes(day, time);
        if (at < nowMinutes || at > nowMinutes + DOSE_WINDOW_MINUTES) continue;
        if (day === today && medication.taken && times.length <= 1) continue;
        if (!best || at < best.at || (at === best.at && medication.name.localeCompare(best.medication.name) < 0)) best = { at, time, medication };
      }
    }
  }
  return best;
}

function nextAppointment(appointments, nowMinutes) {
  return (appointments || [])
    .map((appointment) => ({ appointment, at: wallMinutes(appointment.appointmentDate, appointment.appointmentTime) }))
    .filter(({ at }) => at !== null && at >= nowMinutes && at <= nowMinutes + APPOINTMENT_WINDOW_MINUTES)
    .sort((a, b) => a.at - b.at)[0] || null;
}

// data: { medications, appointments, health, wellbeing } as the dashboard loads them (null while loading or
// after an error: that source simply doesn't apply). basicsFilled: 0-5, or null when unknown.
// forName: the first name when acting for a linked profile ("Sami"), so the line says whose step it is
// ("Sami's Amlodipine 5 mg is due at 08:00", "Cardiology check-up for Sami on Friday: prepare the visit").
export function pickNextStep(options) {
  const step = pickStep(options);
  return step ? { ...step, text: sentence(step.text) } : null;
}

function pickStep({ medications, appointments, basicsFilled, wellbeing, now = new Date(), forName = "" }) {
  const nowMinutes = beirutNowMinutes(now);

  const dose = nextDose(medications, nowMinutes);
  if (dose) {
    const { name, dose: amount, unit } = dose.medication;
    const what = [name, [amount, unit].filter(Boolean).join(" ")].filter(Boolean).join(" ");
    return { kind: "medication", text: forName ? `${forName}'s ${what} is due at ${dose.time}` : `Take ${what} at ${dose.time}`, action: "Open medications", href: "/medications" };
  }
  const visit = nextAppointment(appointments, nowMinutes);
  if (visit) {
    const title = visit.appointment.title || "Your appointment";
    return { kind: "appointment", text: forName ? `${title} for ${forName} ${whenText(visit.at, nowMinutes)}: prepare the visit` : `${title} ${whenText(visit.at, nowMinutes)}: prepare your visit`, action: "Prepare visit", href: "/visit-prep" };
  }
  if (basicsFilled !== null && basicsFilled !== undefined && basicsFilled < BASICS_COUNT) {
    return { kind: "health", text: forName ? `Add ${forName}'s health basics for safer guidance` : "Add your health basics for safer guidance", action: "Open my health", href: "/my-health" };
  }
  if (wellbeing && !wellbeing.sleep) {
    return { kind: "sleep", text: forName ? `Log ${forName}'s sleep from last night` : "Log last night's sleep", action: "Log sleep", href: "/water-and-sleep" };
  }
  return null;
}

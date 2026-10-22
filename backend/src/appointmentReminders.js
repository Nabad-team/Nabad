const Appointment = require("./models/Appointment");
const LinkedProfile = require("./models/LinkedProfile");
const { notify } = require("./notifications");
const { logEvent } = require("./logger");

// Server-side appointment reminders. The appointments page still shows its own browser reminder while it is open;
// this job also adds an appointment_reminder notification at the same moment, so the reminder is in the header
// bell and on /notifications even when the page is closed.

// Appointments saved before browsers sent their time zone are read as Lebanon time, like the provider hours.
const DEFAULT_TIME_ZONE = "Asia/Beirut";
const INTERVAL_MS = 60 * 1000;
const BATCH = 200;

function validTimeZone(value) {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}

// How far ahead of UTC the time zone is at that moment, in milliseconds.
function zoneOffset(time, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(time).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(time / 1000) * 1000;
}

// "2026-10-23" and "14:30" in a time zone, as a Date. The second pass gets the offset right across a DST change.
function localTime(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = asUtc - zoneOffset(asUtc, timeZone);
  return new Date(asUtc - zoneOffset(first, timeZone));
}

// The reminder fields to store with an appointment's date, time, reminder and time zone. Every save sets
// reminderNotified back to false: when the schedule did not change, the dedupe key stops a second notification.
function reminderSchedule({ appointmentDate, appointmentTime, reminderMinutes, timeZone }) {
  const zone = validTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const startsAt = localTime(appointmentDate, appointmentTime, zone);
  return { timeZone: zone, startsAt, remindAt: new Date(startsAt.getTime() - reminderMinutes * 60000), reminderNotified: false };
}

function untilText(minutes) {
  if (minutes <= 1) return "starting now";
  if (minutes < 60) return `in ${minutes} minutes`;
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return "in 1 day";
}
const short = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

// Only who, where and when: never the appointment's title or notes, which can describe a health problem.
function reminderMessage(appointment, profileName, now) {
  const who = profileName ? `${short(profileName, 40)}'s appointment` : "Your appointment";
  const minutes = Math.round((appointment.startsAt.getTime() - now.getTime()) / 60000);
  return `${who} at ${short(appointment.hospital, 60)} is ${untilText(minutes)} (${appointment.appointmentTime}).`;
}

// Notifies every appointment whose reminder time has come and that hasn't started yet, the same window in which the
// appointments page shows "Reminder due". Safe to run repeatedly and on several servers at once: each schedule has
// one dedupe key, and an appointment is marked handled only if it wasn't edited in the meantime.
async function sendDueReminders(now = new Date()) {
  let sent = 0;
  for (;;) {
    const due = await Appointment.find({ remindAt: { $lte: now }, startsAt: { $gte: now }, reminderNotified: { $ne: true } })
      .sort({ remindAt: 1 }).limit(BATCH);
    if (!due.length) return sent;
    const linkedIds = due.filter((item) => String(item.profileId) !== String(item.owner)).map((item) => item.profileId);
    const names = new Map((await LinkedProfile.find({ _id: { $in: linkedIds } }).select("fullName"))
      .map((profile) => [String(profile._id), profile.fullName]));
    for (const appointment of due) {
      const linked = String(appointment.profileId) !== String(appointment.owner);
      try {
        const created = await notify(appointment.owner, appointment.profileId, "appointment_reminder", {
          title: "Appointment reminder",
          message: reminderMessage(appointment, linked ? names.get(String(appointment.profileId)) || "Someone you look after" : null, now),
          link: "/appointments",
          dedupeKey: `appointment:${appointment._id}:${appointment.startsAt.toISOString()}:${appointment.reminderMinutes}`,
        });
        if (created) sent += 1;
      } catch (error) {
        logEvent("appointment_reminder_failed", { errorType: error.name });
        // A database problem is retried at the next run; a reminder that can never be valid is not.
        if (error.name !== "ValidationError") throw error;
      }
      await Appointment.updateOne(
        { _id: appointment._id, startsAt: appointment.startsAt, remindAt: appointment.remindAt },
        { $set: { reminderNotified: true } }
      );
    }
    if (due.length < BATCH) return sent;
  }
}

// Gives appointments saved before reminders were sent from the server their startsAt and remindAt. Safe to run on
// every start: it only touches appointments without them.
async function backfillReminderSchedules() {
  let updated = 0;
  for await (const appointment of Appointment.find({ startsAt: null }).cursor()) {
    await Appointment.updateOne({ _id: appointment._id, startsAt: null }, { $set: reminderSchedule(appointment) });
    updated += 1;
  }
  return updated;
}

// Runs sendDueReminders every minute. A run that is still going is never overlapped, and a failure is logged
// (error type only) and retried at the next tick.
function startReminderJob({ intervalMs = INTERVAL_MS } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await sendDueReminders(); } catch (error) { logEvent("appointment_reminders_failed", { errorType: error.name }); } finally { running = false; }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}

module.exports = { DEFAULT_TIME_ZONE, validTimeZone, localTime, reminderSchedule, reminderMessage, sendDueReminders, backfillReminderSchedules, startReminderJob };

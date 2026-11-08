const { validTimeZone, localTime } = require("./appointmentReminders");
const DEFAULT_TIME_ZONE = "Asia/Beirut";
const MAX_TIMES = 12;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function localParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function readReminder(body) {
  const times = body.reminderTimes === undefined ? [] : body.reminderTimes;
  if (!Array.isArray(times) || times.length > MAX_TIMES || times.some(time => typeof time !== "string" || !TIME.test(time))) {
    return { error: `Choose up to ${MAX_TIMES} reminder times in HH:mm format.` };
  }
  if (new Set(times).size !== times.length) return { error: "Each reminder time must be different." };
  const reminderTimeZone = body.reminderTimeZone === undefined ? DEFAULT_TIME_ZONE : body.reminderTimeZone;
  if (!validTimeZone(reminderTimeZone)) return { error: "Choose a valid reminder time zone, such as Asia/Beirut." };
  return { reminderTimes: [...times].sort(), reminderTimeZone };
}

const dayString = date => new Date(date).toISOString().slice(0, 10);
// Wall-clock times stay fixed across DST. Skip nonexistent spring-forward times;
// a repeated autumn time has a single occurrence and a single notification.
function nextReminder(medication, after = new Date()) {
  if (medication.status !== "active" || !medication.reminderTimes?.length) return null;
  const zone = medication.reminderTimeZone || DEFAULT_TIME_ZONE;
  let day = localParts(after, zone).date;
  const start = dayString(medication.startDate);
  if (day < start) day = start;
  const end = medication.endDate ? dayString(medication.endDate) : null;
  for (let i = 0; i < 3; i++) {
    if (end && day > end) return null;
    for (const time of [...medication.reminderTimes].sort()) {
      const instant = localTime(day, time, zone);
      const actual = localParts(instant, zone);
      if (instant > after && actual.date === day && actual.time === time) return instant;
    }
    day = new Date(new Date(day).getTime() + 86400000).toISOString().slice(0, 10);
  }
  return null;
}

module.exports = { DEFAULT_TIME_ZONE, MAX_TIMES, TIME, readReminder, localParts, nextReminder };

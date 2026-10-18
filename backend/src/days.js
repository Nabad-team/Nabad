// Calendar days for water and sleep: the user's local date as "YYYY-MM-DD", stored as UTC midnight.
// Only the browser knows the user's time zone, so "today" comes from it and is checked against the clock here.

const DAY = 24 * 60 * 60 * 1000;
const dateString = (date) => date.toISOString().slice(0, 10);

// A real "YYYY-MM-DD" date as UTC midnight, or null.
function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || dateString(date) !== value ? null : date;
}
// Today in UTC, as UTC midnight.
const utcToday = () => parseDate(dateString(new Date()));
// Somewhere in the world it is this date right now: UTC today, yesterday or tomorrow (time zones run from -12 to +14 hours).
const isTodaySomewhere = (date) => Math.abs(date - utcToday()) <= DAY;
// The "today" a request is about, or null if the date is missing, invalid or not today anywhere.
function readToday(value) {
  const date = parseDate(value);
  return date && isTodaySomewhere(date) ? date : null;
}

module.exports = { DAY, dateString, parseDate, utcToday, readToday };

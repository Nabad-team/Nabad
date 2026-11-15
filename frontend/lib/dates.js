// Small date helpers shared by pages and the profile mock API.

// Today's date as "YYYY-MM-DD" in the user's local time zone.
// (toISOString() uses UTC, which can be a different day around midnight in Lebanon.)
export function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Age in whole years for a "YYYY-MM-DD" date of birth.
// We subtract the years, then take one off if this year's birthday hasn't happened yet.
export function calculateAge(dateOfBirth) {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const birthdayPassed =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!birthdayPassed) {
    age -= 1;
  }
  return age;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Nabad is used in Lebanon, so every date and time shown to people is in Beirut time,
// whatever time zone the device or the server is set to.
export const APP_TIME_ZONE = "Asia/Beirut";

const beirutParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// The calendar day and clock time of a moment in Beirut, as numbers (month 1-12).
function partsInBeirut(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (value == null || value === "" || Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(beirutParts.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n) => String(n).padStart(2, "0");

// The Beirut calendar day of a timestamp as "YYYY-MM-DD" (for grouping and comparing days).
export function beirutDayString(value) {
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const parts = partsInBeirut(value);
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : "";
}

// The one date format shown to people: "11 November 2026".
// A "YYYY-MM-DD" date is read from the string itself, so no time zone can shift the day (dates of birth, appointment days).
// A timestamp (ISO string, Date or milliseconds) shows its calendar day in Beirut.
// Anything that isn't a date is returned unchanged.
export function formatDate(value) {
  const match = typeof value === "string" ? DATE_ONLY.exec(value) : null;
  if (match) {
    const [, year, month, day] = match;
    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
  }
  const parts = partsInBeirut(value);
  if (!parts) return value;
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

// The one date-and-time format shown to people: "11 November 2026, 01:44" in Beirut time (24-hour clock, no seconds).
// Returns "" for a missing or invalid value.
export function formatDateTime(value) {
  const parts = partsInBeirut(value);
  if (!parts) return "";
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}, ${pad(parts.hour)}:${pad(parts.minute)}`;
}

// Just the Beirut clock time: "01:44".
export function formatTime(value) {
  const parts = partsInBeirut(value);
  return parts ? `${pad(parts.hour)}:${pad(parts.minute)}` : "";
}

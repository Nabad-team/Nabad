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

// "1984-05-02" -> "2 May 1984". Read from the string itself, not new Date(), so the time zone can never shift the day.
// Anything that isn't a "YYYY-MM-DD" date is returned unchanged.
export function formatDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || "");
  if (!match) return dateString;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

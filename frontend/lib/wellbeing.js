// Wording and weekly summaries for water and sleep, shared by the page, the doctor summary and the dashboard card.
// Kept plain and calm: no medical claims, no causes, no alarms. Fluids are stored in millilitres and shown in litres.
// A goal is { type: "atLeast" | "atMost", ml } or null. "atMost" is a limit (for people on fluid restriction):
// its wording never encourages drinking more.

export const QUALITY_WORDS = ["Very poorly", "Poorly", "Okay", "Well", "Very well"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Quick-add amounts, and the limits the server checks (backend: models/Wellbeing.js).
export const GLASS_ML = 250;
export const BOTTLE_ML = 500;
export const DRINK_ML = [10, 2000];
export const GOAL_ML = [100, 10000];
// From this share of a limit on, the page gently says the limit is close.
export const NEAR_LIMIT = 0.8;

// 1250 -> "1.3 L" (always one decimal, so 2000 -> "2.0 L")
export const litresText = (ml) => `${(ml / 1000).toFixed(1)} L`;
// 250 -> "250 ml"
export const mlText = (ml) => `${ml} ml`;
// "1 hour", "7.5 hours"
export const hoursText = (hours) => `${formatNumber(hours)} ${hours === 1 ? "hour" : "hours"}`;
// 6.5, 7 (never "7.0"), rounded to one decimal.
export const formatNumber = (value) => String(Math.round(value * 10) / 10);
// 4 -> "Slept well"
export const sleptText = (quality) => `Slept ${QUALITY_WORDS[quality - 1].toLowerCase()}`;
// "23:30 to 07:00", or "" when the times weren't entered.
export const sleepTimesText = (sleep) => (sleep && sleep.bedtime && sleep.wakeTime ? `${sleep.bedtime} to ${sleep.wakeTime}` : "");
// An ISO timestamp -> "08:05" in the user's own time zone.
export function timeText(at) {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// "23:30", "07:00" -> 7.5: a wake-up time earlier in the day than bedtime is the next morning.
// null unless both are "HH:MM" and different. Matches the server, which works the hours out itself.
export function hoursBetween(bedtime, wakeTime) {
  const minutes = (time) => {
    const match = /^(\d{2}):(\d{2})$/.exec(time || "");
    return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const bed = minutes(bedtime);
  const wake = minutes(wakeTime);
  if (bed === null || wake === null || bed === wake) return null;
  return Math.round((((wake - bed + 1440) % 1440) / 60) * 100) / 100;
}

// "2026-10-12" -> "Mon" / "Monday" / "Mon 12 Oct". Read from the date string, so the time zone never shifts the day.
function dateParts(date) {
  const [year, month, day] = date.split("-").map(Number);
  return { weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), month, day };
}
export const shortDay = (date) => DAY_NAMES[dateParts(date).weekday];
export const longDay = (date) => FULL_DAY_NAMES[dateParts(date).weekday];
export function shortDate(date) {
  const { weekday, month, day } = dateParts(date);
  return `${DAY_NAMES[weekday]} ${day} ${MONTH_NAMES[month - 1]}`;
}

// "Drink at least 2.0 L a day" / "Stay under 1.5 L a day"
export function goalText(goal) {
  if (!goal) return "";
  return `${goal.type === "atMost" ? "Stay under" : "Drink at least"} ${litresText(goal.ml)} a day`;
}

// "1.3 L today" without a goal, "1.3 L of 2.0 L" with one, "1.3 L of the 1.5 L limit" with a limit.
export function waterCountText(totalMl, goal) {
  if (goal && goal.type === "atMost") return `${litresText(totalMl)} of the ${litresText(goal.ml)} limit`;
  if (goal) return `${litresText(totalMl)} of ${litresText(goal.ml)}`;
  return totalMl === 0 ? "Nothing logged yet today" : `${litresText(totalMl)} today`;
}

// With a limit: "near" (from NEAR_LIMIT of it), "reached" (exactly) or "over". null otherwise, and always without one.
export function limitStatus(totalMl, goal) {
  if (!goal || goal.type !== "atMost") return null;
  if (totalMl > goal.ml) return "over";
  if (totalMl === goal.ml) return "reached";
  return totalMl >= goal.ml * NEAR_LIMIT ? "near" : null;
}

// Only when the user set a goal, and only gentle words. With a limit: a calm note near or over it, and
// never how much is "left", which would read as a nudge to drink. who: null for the user, or the family member's name.
export function waterGoalText(totalMl, goal, who = null) {
  if (!goal) return "";
  if (goal.type === "atMost") {
    const subject = who ? `${who} is` : "You're";
    return {
      near: `${subject} close to the daily limit.`,
      reached: `${who ? `${who} has` : "You've"} reached the daily limit.`,
      over: `${subject} over the daily limit for today.`,
    }[limitStatus(totalMl, goal)] || "";
  }
  if (totalMl >= goal.ml) return "Goal reached for today.";
  return `${litresText(goal.ml - totalMl)} more to reach the goal.`;
}

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
// Average fluids and sleep over the logged days of a list from GET /wellbeing/history, rounded for display.
export function averages(days) {
  const waterDays = days.filter((day) => day.totalMl !== null);
  const sleepDays = days.filter((day) => day.sleep);
  return {
    waterDays: waterDays.length,
    sleepDays: sleepDays.length,
    waterMl: waterDays.length ? average(waterDays.map((day) => day.totalMl)) : null,
    sleepHours: sleepDays.length ? Math.round(average(sleepDays.map((day) => day.sleep.hours)) * 10) / 10 : null,
  };
}

// Text summaries of a week (from GET /wellbeing/history), for everyone including screen reader users.
export function weekSummary(days) {
  const { waterDays, sleepDays, waterMl, sleepHours } = averages(days);
  return {
    hasData: waterDays > 0 || sleepDays > 0,
    water: waterDays
      ? `Average fluids this week: ${litresText(waterMl)} a day, over ${plural(waterDays, "day", "days")} logged.`
      : "No fluids logged this week.",
    sleep: sleepDays
      ? `Average sleep this week: ${hoursText(sleepHours)}, over ${plural(sleepDays, "night", "nights")} logged.`
      : "No sleep logged this week.",
  };
}

// At most one observation, and only when it is plainly true from what was logged. It follows the goal type:
// a goal counts the days it was reached; a limit counts the days over it, or else the days within it.
// who: null for the user themselves, or the family member's name.
export const SHORT_NIGHT_HOURS = 5;
export function weekObservation(days, goal, who = null) {
  const shortNights = days.filter((day) => day.sleep && day.sleep.hours < SHORT_NIGHT_HOURS).length;
  if (shortNights >= 3) {
    return `${who ? `${who} has` : "You've"} slept under ${SHORT_NIGHT_HOURS} hours on ${shortNights} nights this week.`;
  }
  if (!goal) return "";
  const logged = days.filter((day) => day.totalMl !== null);
  if (goal.type === "atMost") {
    const over = logged.filter((day) => day.totalMl > goal.ml).length;
    if (over >= 3) return `${who || "You"} went over the daily limit on ${over} days this week.`;
    const within = logged.length - over;
    if (within >= 3) return `${who || "You"} stayed within the daily limit on ${within} days this week.`;
    return "";
  }
  const goalDays = logged.filter((day) => day.totalMl >= goal.ml).length;
  if (goalDays >= 3) return `${who ? `${who} reached the` : "You reached your"} water goal on ${goalDays} days this week.`;
  return "";
}

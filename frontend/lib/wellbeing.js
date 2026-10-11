// Wording and weekly summaries for water and sleep, shared by the page and the dashboard card.
// Kept plain and calm: no medical claims, no causes, no alarms.

export const QUALITY_WORDS = ["Very poorly", "Poorly", "Okay", "Well", "Very well"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "1 glass", "3 glasses"
export const glassesText = (count) => `${count} ${count === 1 ? "glass" : "glasses"}`;
// "1 hour", "7.5 hours"
export const hoursText = (hours) => `${formatNumber(hours)} ${hours === 1 ? "hour" : "hours"}`;
// 6.5, 7 (never "7.0"), rounded to one decimal.
export const formatNumber = (value) => String(Math.round(value * 10) / 10);
// 4 -> "Slept well"
export const sleptText = (quality) => `Slept ${QUALITY_WORDS[quality - 1].toLowerCase()}`;

// "2026-10-12" -> "Mon" / "Monday". Read from the date string, so the time zone never shifts the day.
function weekday(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
export const shortDay = (date) => DAY_NAMES[weekday(date)];
export const longDay = (date) => FULL_DAY_NAMES[weekday(date)];

// "3 of 8 glasses" with a goal, "3 glasses today" without one.
export function waterCountText(glasses, target) {
  if (target) return `${glasses} of ${glassesText(target)}`;
  return glasses === 0 ? "No glasses yet today" : `${glassesText(glasses)} today`;
}
// Only when the user set a goal, and only gentle words.
export function waterGoalText(glasses, target) {
  if (!target) return "";
  if (glasses >= target) return "You've reached your goal for today.";
  const left = target - glasses;
  return `${left} more to reach your goal.`;
}

// Text summaries of a week (from GET /wellbeing/history), for everyone including screen reader users.
export function weekSummary(days) {
  const waterDays = days.filter((day) => day.glasses !== null);
  const sleepDays = days.filter((day) => day.sleep);
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    hasData: waterDays.length > 0 || sleepDays.length > 0,
    water: waterDays.length
      ? `Average water this week: ${formatNumber(average(waterDays.map((day) => day.glasses)))} glasses a day, over ${waterDays.length} ${waterDays.length === 1 ? "day" : "days"} logged.`
      : "No water logged this week.",
    sleep: sleepDays.length
      ? `Average sleep this week: ${hoursText(Math.round(average(sleepDays.map((day) => day.sleep.hours)) * 10) / 10)}, over ${sleepDays.length} ${sleepDays.length === 1 ? "night" : "nights"} logged.`
      : "No sleep logged this week.",
  };
}

// At most one observation, and only when it is plainly true from what was logged.
// who: null for the user themselves, or the family member's name.
export const SHORT_NIGHT_HOURS = 5;
export function weekObservation(days, target, who = null) {
  const shortNights = days.filter((day) => day.sleep && day.sleep.hours < SHORT_NIGHT_HOURS).length;
  if (shortNights >= 3) {
    return `${who ? `${who} has` : "You've"} slept under ${SHORT_NIGHT_HOURS} hours on ${shortNights} nights this week.`;
  }
  if (target) {
    const goalDays = days.filter((day) => day.glasses !== null && day.glasses >= target).length;
    if (goalDays >= 3) return `${who ? `${who} reached the` : "You reached your"} water goal on ${goalDays} days this week.`;
  }
  return "";
}

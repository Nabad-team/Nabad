const clock = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// A scheduled status, not live capacity. The emergency department is independent of clinic hours.
function beirutClock(now = new Date()) {
  const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
  const day = days.indexOf(parts.weekday);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return { day, minute };
}
function openingStatus(provider, now = new Date()) {
  if (!provider.hoursKnown) return "unknown";
  const { day, minute } = beirutClock(now);
  const open = provider.hours.some(slot => slot.end > slot.start
    ? slot.day === day && minute >= slot.start && minute < slot.end
    : (slot.day === day && minute >= slot.start) || ((slot.day + 1) % 7 === day && minute < slot.end));
  return open ? "open" : "closed";
}
module.exports = { openingStatus, beirutClock };

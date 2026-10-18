const express = require("express");
const rateLimit = require("express-rate-limit");
const { HydrationEntry, SleepEntry, WellbeingSettings, LIMITS, GOAL_TYPES } = require("../models/Wellbeing");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const { DAY, dateString, parseDate, utcToday, readToday } = require("../days");
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Water and sleep tracking for the signed-in user and the people they look after.
// Every route takes ?profileId= ("self" by default, or one of the user's linked profiles; anything else is 404).
// Days are the user's local calendar date ("YYYY-MM-DD"), sent by the browser: only it knows the user's time zone.
// Fluids are in millilitres.
// Health data: amounts, goals, hours, times, quality and notes are never logged (the logger only writes allowlisted fields).
const router = express.Router();
router.use(requireAuth);
router.use(resolveProfile);

// Keyed by account. Tapping "Glass" is quick, so the limit is higher than for medications.
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, keyGenerator: (req) => req.userId, message: { error: "Too many changes in a short time. Please wait a few minutes and try again." } });

const QUALITY_WORDS = ["very poorly", "poorly", "okay", "well", "very well"];
const TODAY_ERROR = { error: "Send today's date as YYYY-MM-DD. Water can only be logged for today." };
const HISTORY_DAYS = [7, 14, 30]; // the week, the summary for a doctor, the month

const scope = (req) => ({ owner: req.userId, profileId: req.profileId });
async function waterGoal(req) {
  const settings = await WellbeingSettings.findOne(scope(req)).select("waterGoal");
  return settings?.waterGoal ? { type: settings.waterGoal.type, ml: settings.waterGoal.ml } : null;
}
const sleepView = (entry) => entry && {
  date: dateString(entry.date), hours: entry.hours, bedtime: entry.bedtime || null, wakeTime: entry.wakeTime || null,
  quality: entry.quality, note: entry.note,
};
// A day's fluids: the total, every drink oldest first, and the goal (or null).
async function waterView(req, date, entry) {
  return {
    date: dateString(date),
    totalMl: entry?.totalMl || 0,
    entries: (entry?.entries || []).map(({ ml, at }) => ({ ml, at })),
    goal: await waterGoal(req),
  };
}

// Today at a glance: fluids so far, the goal (or null), and the sleep logged this morning (or null).
router.get("/today", asyncRoute(async (req, res) => {
  const date = readToday(req.query.date);
  if (!date) return res.status(400).json({ error: "Send today's date as YYYY-MM-DD." });
  const [water, sleep] = await Promise.all([
    HydrationEntry.findOne({ ...scope(req), date }),
    SleepEntry.findOne({ ...scope(req), date }),
  ]);
  return res.json({ date: dateString(date), water: await waterView(req, date, water), sleep: sleepView(sleep) });
}));

const [MIN_ML, MAX_ML] = LIMITS.entryMl;
const AMOUNT_ERROR = { error: `Enter an amount from ${MIN_ML} to ${MAX_ML} ml, in whole millilitres.` };
const isWholeIn = (value, [min, max]) => Number.isInteger(value) && value >= min && value <= max;

// One drink today: { date, ml }. The day's entry is created by its first drink (one entry per profile per day).
router.post("/water/entries", writeLimiter, asyncRoute(async (req, res) => {
  const date = readToday(req.body?.date);
  if (!date) return res.status(400).json(TODAY_ERROR);
  const ml = req.body?.ml;
  if (!isWholeIn(ml, LIMITS.entryMl)) return res.status(400).json(AMOUNT_ERROR);
  // Only matches a day with room left, so the total and the number of drinks can never pass the caps.
  const filter = { ...scope(req), date, totalMl: { $lte: LIMITS.dayMl - ml }, [`entries.${LIMITS.entries - 1}`]: { $exists: false } };
  const update = { $inc: { totalMl: ml }, $push: { entries: { ml, at: new Date() } } };
  // The unique index makes a second insert for the same day fail: either the day is full, or another
  // tab created the entry at the same moment (then the retry adds to it).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const entry = await HydrationEntry.findOneAndUpdate(filter, update, { upsert: true, new: true, runValidators: true });
      return res.json({ water: await waterView(req, date, entry) });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await HydrationEntry.findOne({ ...scope(req), date });
      if (existing && existing.entries.length >= LIMITS.entries) {
        return res.status(400).json({ error: `${LIMITS.entries} drinks is the most this tracker records for one day.` });
      }
      if (existing && existing.totalMl + ml > LIMITS.dayMl) {
        return res.status(400).json({ error: `${LIMITS.dayMl / 1000} litres is the most this tracker records for one day.` });
      }
    }
  }
  return res.status(409).json({ error: "Please try again." });
}));

// Undoes the last drink logged today. With nothing logged it changes nothing, so a double tap is harmless.
router.delete("/water/entries/last", writeLimiter, asyncRoute(async (req, res) => {
  const date = readToday(req.query.date);
  if (!date) return res.status(400).json(TODAY_ERROR);
  // One atomic update takes the last drink off both the list and the total, so they always agree.
  const remaining = { $subtract: [{ $size: "$entries" }, 1] };
  const entry = await HydrationEntry.findOneAndUpdate({ ...scope(req), date, "entries.0": { $exists: true } }, [{
    $set: {
      totalMl: { $max: [0, { $subtract: ["$totalMl", { $arrayElemAt: ["$entries.ml", -1] }] }] },
      entries: { $cond: [{ $gt: [remaining, 0] }, { $slice: ["$entries", remaining] }, []] },
    },
  }], { new: true });
  return res.json({ water: await waterView(req, date, entry || await HydrationEntry.findOne({ ...scope(req), date })) });
}));

// The daily goal: { type: "atLeast" | "atMost", ml }, or { goal: null } to have none. There is never a default.
// "atMost" is a limit, for people on fluid restriction.
router.put("/water/goal", writeLimiter, asyncRoute(async (req, res) => {
  const body = req.body || {};
  let goal = null;
  if (!(body.goal === null && body.type === undefined)) {
    if (!GOAL_TYPES.includes(body.type)) return res.status(400).json({ error: "Choose \"Drink at least\" or \"Stay under\"." });
    if (!isWholeIn(body.ml, LIMITS.goalMl)) {
      return res.status(400).json({ error: `Enter a daily amount from ${LIMITS.goalMl[0]} ml to ${LIMITS.goalMl[1] / 1000} litres, or remove the goal.` });
    }
    goal = { type: body.type, ml: body.ml };
  }
  await WellbeingSettings.findOneAndUpdate(scope(req), { $set: { waterGoal: goal } }, { upsert: true, runValidators: true });
  return res.json({ goal });
}));

router.delete("/water/goal", writeLimiter, asyncRoute(async (req, res) => {
  await WellbeingSettings.updateOne(scope(req), { $set: { waterGoal: null } });
  return res.json({ goal: null });
}));

// "23:30" -> minutes after midnight, or null.
function readTime(value) {
  const match = typeof value === "string" && /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
const isBlank = (value) => value === undefined || value === null || value === "";
// Hours from bedtime to wake-up time, to the minute (two decimals). A wake-up time earlier in the day than
// bedtime is the next morning, so 23:30 to 07:00 is 7.5 hours.
function hoursBetween(bed, wake) {
  const minutes = (wake - bed + 24 * 60) % (24 * 60);
  return Math.round((minutes / 60) * 100) / 100;
}

// Checks a sleep entry from the body. Returns { sleep } or { error } in plain words.
// Hours are entered directly, or worked out from bedtime and wakeTime ("HH:MM"), which then take precedence.
function readSleep(body) {
  const { hours: enteredHours, bedtime, wakeTime, quality, note } = body || {};
  let hours = enteredHours;
  let times = { bedtime: null, wakeTime: null };
  if (!isBlank(bedtime) || !isBlank(wakeTime)) {
    if (isBlank(bedtime) || isBlank(wakeTime)) return { error: "Enter both bedtime and wake-up time, or neither." };
    const bed = readTime(bedtime);
    const wake = readTime(wakeTime);
    if (bed === null || wake === null) return { error: "Enter times as HH:MM, for example 23:30." };
    if (bed === wake) return { error: "Bedtime and wake-up time can't be the same. Enter the hours slept instead." };
    hours = hoursBetween(bed, wake);
    times = { bedtime, wakeTime };
  } else if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0 || hours > LIMITS.hours || !Number.isInteger(hours * 2)) {
    return { error: "Enter the hours slept, from 0 to 24, in half hours (for example 7.5)." };
  }
  if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
    return { error: `Choose how well you slept, from 1 (${QUALITY_WORDS[0]}) to 5 (${QUALITY_WORDS[4]}).` };
  }
  if (note !== undefined && note !== null && typeof note !== "string") return { error: "The note must be text." };
  const text = (note || "").trim();
  if (text.length > LIMITS.note) return { error: `Keep the note to ${LIMITS.note} characters or fewer.` };
  return { sleep: { hours, ...times, quality, note: text } };
}
// Sleep can be logged for any morning in the past year, up to today.
function readSleepDate(value) {
  const date = parseDate(value);
  if (!date) return null;
  const today = utcToday();
  return date <= today.getTime() + DAY && date >= today.getTime() - 366 * DAY ? date : null;
}
const SLEEP_DATE_ERROR = { error: "Choose a morning from the past year, up to today." };

// Creates or replaces the sleep entry for one morning (one entry per profile per day).
router.put("/sleep/:date", writeLimiter, asyncRoute(async (req, res) => {
  const date = readSleepDate(req.params.date);
  if (!date) return res.status(400).json(SLEEP_DATE_ERROR);
  const { sleep, error } = readSleep(req.body);
  if (error) return res.status(400).json({ error });
  const before = await SleepEntry.findOneAndUpdate({ ...scope(req), date }, { $set: sleep }, { upsert: true, new: false, runValidators: true });
  const entry = { date, ...sleep };
  return res.status(before ? 200 : 201).json({ sleep: sleepView(entry) });
}));

router.delete("/sleep/:date", writeLimiter, asyncRoute(async (req, res) => {
  const date = parseDate(req.params.date);
  const result = date ? await SleepEntry.deleteOne({ ...scope(req), date }) : { deletedCount: 0 };
  if (result.deletedCount === 0) return res.status(404).json({ error: "There is no sleep entry for that morning." });
  return res.status(204).end();
}));

// The last 7, 14 or 30 days up to `end` (today), oldest first. A day with nothing logged has totalMl and sleep null.
router.get("/history", asyncRoute(async (req, res) => {
  const days = Number(req.query.days || 7);
  if (!HISTORY_DAYS.includes(days)) return res.status(400).json({ error: "History is available for 7, 14 or 30 days." });
  const end = readToday(req.query.end);
  if (!end) return res.status(400).json({ error: "Send today's date as YYYY-MM-DD." });
  const start = new Date(end.getTime() - (days - 1) * DAY);
  const range = { ...scope(req), date: { $gte: start, $lte: end } };
  const [water, sleep, goal] = await Promise.all([HydrationEntry.find(range).select("date totalMl entries"), SleepEntry.find(range), waterGoal(req)]);
  // A day whose every drink was undone counts as nothing logged.
  const waterByDay = new Map(water.filter((entry) => entry.entries.length).map((entry) => [dateString(entry.date), entry.totalMl]));
  const sleepByDay = new Map(sleep.map((entry) => [dateString(entry.date), sleepView(entry)]));
  const list = Array.from({ length: days }, (_, i) => {
    const date = dateString(new Date(start.getTime() + i * DAY));
    return { date, totalMl: waterByDay.has(date) ? waterByDay.get(date) : null, sleep: sleepByDay.get(date) || null };
  });
  return res.json({ days: list, goal });
}));

module.exports = router;

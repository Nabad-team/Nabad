const express = require("express");
const rateLimit = require("express-rate-limit");
const { HydrationEntry, SleepEntry, WellbeingSettings, LIMITS } = require("../models/Wellbeing");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Water and sleep tracking for the signed-in user and the people they look after.
// Every route takes ?profileId= ("self" by default, or one of the user's linked profiles; anything else is 404).
// Days are the user's local calendar date ("YYYY-MM-DD"), sent by the browser: only it knows the user's time zone.
// Health data: glasses, hours, quality and notes are never logged (the logger only writes allowlisted fields).
const router = express.Router();
router.use(requireAuth);
router.use(resolveProfile);

// Keyed by account. Tapping "+ glass" is quick, so the limit is higher than for medications.
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, keyGenerator: (req) => req.userId, message: { error: "Too many changes in a short time. Please wait a few minutes and try again." } });

const DAY = 24 * 60 * 60 * 1000;
const dateString = (date) => date.toISOString().slice(0, 10);
const QUALITY_WORDS = ["very poorly", "poorly", "okay", "well", "very well"];

// A real "YYYY-MM-DD" date as UTC midnight, or null.
function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || dateString(date) !== value ? null : date;
}
// Somewhere in the world it is this date right now: UTC today, yesterday or tomorrow (time zones run from -12 to +14 hours).
function isTodaySomewhere(date) {
  const utcToday = parseDate(dateString(new Date()));
  return Math.abs(date - utcToday) <= DAY;
}
// The "today" a request is about, or null if the date is missing, invalid or not today anywhere.
function readToday(value) {
  const date = parseDate(value);
  return date && isTodaySomewhere(date) ? date : null;
}
const TODAY_ERROR = { error: "Send today's date as YYYY-MM-DD. Water can only be logged for today." };

const scope = (req) => ({ owner: req.userId, profileId: req.profileId });
async function waterTarget(req) {
  const settings = await WellbeingSettings.findOne(scope(req)).select("waterTarget");
  return settings ? settings.waterTarget : null;
}
const sleepView = (entry) => entry && { date: dateString(entry.date), hours: entry.hours, quality: entry.quality, note: entry.note };
async function waterView(req, date, glasses) {
  return { date: dateString(date), glasses, target: await waterTarget(req) };
}

// Today at a glance: water so far, the target (or null), and the sleep logged this morning (or null).
router.get("/today", asyncRoute(async (req, res) => {
  const date = readToday(req.query.date);
  if (!date) return res.status(400).json({ error: "Send today's date as YYYY-MM-DD." });
  const [water, sleep] = await Promise.all([
    HydrationEntry.findOne({ ...scope(req), date }),
    SleepEntry.findOne({ ...scope(req), date }),
  ]);
  return res.json({ date: dateString(date), water: await waterView(req, date, water ? water.glasses : 0), sleep: sleepView(sleep) });
}));

// One more glass today. The day's entry is created by the first glass (one entry per profile per day).
router.post("/water/glass", writeLimiter, asyncRoute(async (req, res) => {
  const date = readToday(req.body?.date);
  if (!date) return res.status(400).json(TODAY_ERROR);
  const filter = { ...scope(req), date, glasses: { $lt: LIMITS.glasses } };
  // The unique index makes a second insert for the same day fail: either the day is full, or another
  // tab created the entry at the same moment (then the retry adds to it).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const entry = await HydrationEntry.findOneAndUpdate(filter, { $inc: { glasses: 1 } }, { upsert: true, new: true, runValidators: true });
      return res.json({ water: await waterView(req, date, entry.glasses) });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await HydrationEntry.findOne({ ...scope(req), date });
      if (existing && existing.glasses >= LIMITS.glasses) {
        return res.status(400).json({ error: `${LIMITS.glasses} glasses is the most this tracker records for one day.` });
      }
    }
  }
  return res.status(409).json({ error: "Please try again." });
}));

// One glass less today. At 0 it stays 0, so a double tap never goes negative.
router.delete("/water/glass", writeLimiter, asyncRoute(async (req, res) => {
  const date = readToday(req.query.date);
  if (!date) return res.status(400).json(TODAY_ERROR);
  const entry = await HydrationEntry.findOneAndUpdate({ ...scope(req), date, glasses: { $gt: 0 } }, { $inc: { glasses: -1 } }, { new: true });
  return res.json({ water: await waterView(req, date, entry ? entry.glasses : 0) });
}));

// The daily water goal: a whole number of glasses, or null to have none. There is never a default.
router.put("/water/target", writeLimiter, asyncRoute(async (req, res) => {
  const { target } = req.body || {};
  if (target !== null && !(Number.isInteger(target) && target >= 1 && target <= LIMITS.target)) {
    return res.status(400).json({ error: `Enter a daily goal from 1 to ${LIMITS.target} glasses, or remove the goal.` });
  }
  await WellbeingSettings.findOneAndUpdate(scope(req), { $set: { waterTarget: target } }, { upsert: true, runValidators: true });
  return res.json({ target });
}));

router.delete("/water/target", writeLimiter, asyncRoute(async (req, res) => {
  await WellbeingSettings.updateOne(scope(req), { $set: { waterTarget: null } });
  return res.json({ target: null });
}));

// Checks a sleep entry from the body. Returns { sleep } or { error } in plain words.
function readSleep(body) {
  const { hours, quality, note } = body || {};
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0 || hours > LIMITS.hours || !Number.isInteger(hours * 2)) {
    return { error: "Enter the hours slept, from 0 to 24, in half hours (for example 7.5)." };
  }
  if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
    return { error: `Choose how well you slept, from 1 (${QUALITY_WORDS[0]}) to 5 (${QUALITY_WORDS[4]}).` };
  }
  if (note !== undefined && note !== null && typeof note !== "string") return { error: "The note must be text." };
  const text = (note || "").trim();
  if (text.length > LIMITS.note) return { error: `Keep the note to ${LIMITS.note} characters or fewer.` };
  return { sleep: { hours, quality, note: text } };
}
// Sleep can be logged for any morning in the past year, up to today.
function readSleepDate(value) {
  const date = parseDate(value);
  if (!date) return null;
  const utcToday = parseDate(dateString(new Date()));
  return date <= utcToday.getTime() + DAY && date >= utcToday.getTime() - 366 * DAY ? date : null;
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

// The last 7 or 30 days up to `end` (today), oldest first. A day with nothing logged has glasses and sleep null.
router.get("/history", asyncRoute(async (req, res) => {
  const days = Number(req.query.days || 7);
  if (days !== 7 && days !== 30) return res.status(400).json({ error: "History is available for 7 or 30 days." });
  const end = readToday(req.query.end);
  if (!end) return res.status(400).json({ error: "Send today's date as YYYY-MM-DD." });
  const start = new Date(end.getTime() - (days - 1) * DAY);
  const range = { ...scope(req), date: { $gte: start, $lte: end } };
  const [water, sleep, target] = await Promise.all([HydrationEntry.find(range), SleepEntry.find(range), waterTarget(req)]);
  const waterByDay = new Map(water.map((entry) => [dateString(entry.date), entry.glasses]));
  const sleepByDay = new Map(sleep.map((entry) => [dateString(entry.date), sleepView(entry)]));
  const list = Array.from({ length: days }, (_, i) => {
    const date = dateString(new Date(start.getTime() + i * DAY));
    return { date, glasses: waterByDay.has(date) ? waterByDay.get(date) : null, sleep: sleepByDay.get(date) || null };
  });
  return res.json({ days: list, target });
}));

module.exports = router;

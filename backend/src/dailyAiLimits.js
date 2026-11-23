// Per-account daily AI limits, on top of the 15-minute limits on each route. All profiles of an account (the
// owner's own and linked family profiles) count together, because req.userId is always the account.
// A day is a calendar day in Beirut: the counts start again at midnight Asia/Beirut. See docs/ai-fallback.md.
//
// Stored in MongoDB (AiUsageDaily): only counts per account per day, deleted automatically after 2 days, so a
// restart doesn't reset them and every server instance shares them. Never the question, symptoms or files.
//
// Safety: emergencies are never limited. The symptom check runs the red-flag rules before this and never counts
// them; at the limit it still answers with the rules (routes/triage.js). An assistant or history question that the
// safety rules flag as an emergency is answered and not counted either.
const mongoose = require("mongoose");
const AiUsageDaily = require("./models/AiUsageDaily");
const { relaxedForScan, SCAN_FACTOR } = require("./rateLimit");
const { logEvent } = require("./logger");
// A symptom check has at most this many follow-up rounds (adaptiveFollowUps.js).
const { MAX_ROUNDS: FOLLOW_UP_ROUNDS } = require("./triage/adaptiveFollowUps");

const TIME_ZONE = "Asia/Beirut";
const DAY_MS = 24 * 60 * 60 * 1000;

// feature: the stored count. setting: its environment variable. noun: how the limit message names it.
const FEATURES = {
  symptomChecks: { setting: "AI_DAILY_LIMIT_SYMPTOM_CHECKS", defaultLimit: 20, noun: "AI symptom checks" },
  assistantMessages: { setting: "AI_DAILY_LIMIT_ASSISTANT_MESSAGES", defaultLimit: 40, noun: "health assistant messages" },
  historyQuestions: { setting: "AI_DAILY_LIMIT_HISTORY_QUESTIONS", defaultLimit: 30, noun: "AI questions about your history" },
  prescriptionReads: { setting: "AI_DAILY_LIMIT_PRESCRIPTION_READS", defaultLimit: 10, noun: "prescription photo readings" },
  reportAnalyses: { setting: "AI_DAILY_LIMIT_REPORT_ANALYSES", defaultLimit: 5, noun: "lab report reviews" },
};
const MAX_SETTING = 10000;

// { symptomChecks: 20, ... } from the environment. A setting that is set must be a whole number from 1 to 10000;
// anything else throws (config.js checks this at startup). The PR security scan multiplies them like every limit.
function readDailyLimits(env = process.env) {
  const factor = relaxedForScan(env) ? SCAN_FACTOR : 1;
  const limits = {};
  for (const [feature, { setting, defaultLimit }] of Object.entries(FEATURES)) {
    const raw = env[setting];
    let value = defaultLimit;
    if (raw !== undefined && String(raw).trim() !== "") {
      value = Number(String(raw).trim());
      if (!/^\d+$/.test(String(raw).trim()) || value < 1 || value > MAX_SETTING) throw new Error(`${setting} must be a whole number from 1 to ${MAX_SETTING}.`);
    }
    limits[feature] = value * factor;
  }
  return limits;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const wallFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
});

// The Beirut calendar date of an instant, "YYYY-MM-DD".
const beirutDay = (now = new Date()) => dayFormat.format(now);

// Beirut's offset from UTC at an instant, in ms (+2 h in winter, +3 h in summer).
function offsetAt(time) {
  const parts = Object.fromEntries(wallFormat.formatToParts(new Date(time)).map(({ type, value }) => [type, Number(value)]));
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wall - Math.floor(time / 1000) * 1000;
}

// The instant the next Beirut day starts: midnight, or the first moment of the day when a clock change skips it.
function nextReset(now = new Date()) {
  const [year, month, day] = beirutDay(now).split("-").map(Number);
  const tomorrowUtc = Date.UTC(year, month - 1, day + 1);
  const tomorrow = new Date(tomorrowUtc).toISOString().slice(0, 10);
  const starts = [offsetAt(tomorrowUtc - DAY_MS / 2), offsetAt(tomorrowUtc + DAY_MS / 2)]
    .map((offset) => tomorrowUtc - offset)
    .filter((time) => beirutDay(new Date(time)) === tomorrow && beirutDay(new Date(time - 1)) !== tomorrow);
  return new Date(starts.length ? Math.min(...starts) : tomorrowUtc - 2 * 60 * 60 * 1000);
}

const dbReady = () => mongoose.connection.readyState === 1;

// What the page shows: { feature, used, limit, remaining, resetsAt }.
const view = (feature, used, limit, resetsAt) => ({ feature, used, limit, remaining: Math.max(limit - used, 0), resetsAt: resetsAt.toISOString() });

// Uses one of today's `feature` for the account, if any are left. Atomic: two requests at once can't both take the
// last one. Returns { allowed, usage, day }. If the database can't be reached, it lets the request through
// (allowed, usage null): a limit must never stop someone getting help because of a database problem.
// alsoAdd: other counts to add with the use, e.g. { freeFollowUps: 3 } for a symptom check.
async function useOne(account, feature, { now = new Date(), env = process.env, alsoAdd = {} } = {}) {
  const limit = readDailyLimits(env)[feature];
  const day = beirutDay(now);
  const resetsAt = nextReset(now);
  if (!dbReady()) return { allowed: true, usage: null, day };
  const underLimit = { owner: account, day, [feature]: { $lt: limit } };
  const inc = { [feature]: 1, ...alsoAdd };
  const takeOne = { $inc: inc, $setOnInsert: { expiresAt: new Date(resetsAt.getTime() + DAY_MS) } };
  try {
    let row;
    try {
      row = await AiUsageDaily.findOneAndUpdate(underLimit, takeOne, { upsert: true, new: true, maxTimeMS: 2000 }).lean();
    } catch (error) {
      if (error.code !== 11000) throw error;
      // The upsert hit the unique index: the day's row exists, because it is at the limit (the filter missed) or
      // because another request created it a moment ago. Now that it exists, try once more without creating it.
      row = await AiUsageDaily.findOneAndUpdate(underLimit, { $inc: inc }, { new: true, maxTimeMS: 2000 }).lean();
    }
    if (row) return { allowed: true, usage: view(feature, row[feature], limit, resetsAt), day };
    const current = await AiUsageDaily.findOne({ owner: account, day }).maxTimeMS(2000).lean().catch(() => null);
    return { allowed: false, usage: view(feature, Math.max(current?.[feature] ?? limit, limit), limit, resetsAt), day };
  } catch {
    logEvent("ai_daily_limit_unavailable", { feature });
    return { allowed: true, usage: null, day };
  }
}

// Gives back one use, when the AI wasn't used after all (the model was down, or the request failed).
async function giveBack(account, feature, day) {
  if (!dbReady()) return;
  try {
    await AiUsageDaily.updateOne({ owner: account, day, [feature]: { $gt: 0 } }, { $inc: { [feature]: -1 } }, { maxTimeMS: 2000 });
  } catch {
    logEvent("ai_daily_limit_unavailable", { feature });
  }
}

// A symptom check and all its follow-up rounds count as one AI symptom check. The follow-up state comes from the
// browser and is not signed, so it can't be trusted to skip counting. Instead, each counted check adds
// FOLLOW_UP_ROUNDS free follow-up rounds to the day's row (a number, nothing about the check), and a follow-up
// round uses one of those. A follow-up with none left counts as a new check. Honest use: 1 per check. The most
// anyone can get is the same as 20 full checks.
//   followUp: true when the request answers follow-up questions (answers or followUpState sent).
// Returns { allowed, usage, day, kind: "check" | "followUp" }.
async function useSymptomCheck(account, { followUp = false, now = new Date(), env = process.env } = {}) {
  const day = beirutDay(now);
  if (followUp && dbReady()) {
    try {
      const row = await AiUsageDaily.findOneAndUpdate(
        { owner: account, day, freeFollowUps: { $gt: 0 } }, { $inc: { freeFollowUps: -1 } }, { new: true, maxTimeMS: 2000 },
      ).lean();
      if (row) {
        const usage = view("symptomChecks", row.symptomChecks, readDailyLimits(env).symptomChecks, nextReset(now));
        return { allowed: true, usage, day, kind: "followUp" };
      }
    } catch {
      logEvent("ai_daily_limit_unavailable", { feature: "symptomChecks" });
      return { allowed: true, usage: null, day, kind: "followUp" };
    }
  }
  const result = await useOne(account, "symptomChecks", { now, env, alsoAdd: { freeFollowUps: FOLLOW_UP_ROUNDS } });
  return { ...result, kind: "check" };
}

// Gives back what useSymptomCheck took, when the model didn't answer after all.
async function giveBackSymptomCheck(account, day, kind) {
  if (!dbReady()) return;
  try {
    if (kind === "followUp") {
      await AiUsageDaily.updateOne({ owner: account, day }, { $inc: { freeFollowUps: 1 } }, { maxTimeMS: 2000 });
      return;
    }
    // The check and the free rounds it added; never below 0 (some rounds may already be used).
    await AiUsageDaily.updateOne({ owner: account, day, symptomChecks: { $gt: 0 } }, [{ $set: {
      symptomChecks: { $subtract: ["$symptomChecks", 1] },
      freeFollowUps: { $max: [0, { $subtract: [{ $ifNull: ["$freeFollowUps", 0] }, FOLLOW_UP_ROUNDS] }] },
    } }], { maxTimeMS: 2000 });
  } catch {
    logEvent("ai_daily_limit_unavailable", { feature: "symptomChecks" });
  }
}

// Today's counts for every feature: { timeZone, resetsAt, symptomChecks: { used, limit, remaining, ... }, ... }.
async function usageToday(account, { now = new Date(), env = process.env } = {}) {
  const limits = readDailyLimits(env);
  const resetsAt = nextReset(now);
  const row = dbReady()
    ? await AiUsageDaily.findOne({ owner: account, day: beirutDay(now) }).maxTimeMS(2000).lean().catch(() => null)
    : null;
  const usage = { timeZone: TIME_ZONE, resetsAt: resetsAt.toISOString() };
  for (const feature of Object.keys(FEATURES)) usage[feature] = view(feature, row?.[feature] || 0, limits[feature], resetsAt);
  return usage;
}

// The friendly answer when a limit is reached: HTTP 429, with when it starts again.
function limitReachedBody(usage) {
  const { noun } = FEATURES[usage.feature];
  return {
    error: `You've used today's ${usage.limit} ${noun}. They start again at midnight, Beirut time.`,
    code: "daily_ai_limit",
    dailyLimit: usage,
  };
}

// Route middleware for the assistant, history, prescription and report features:
//   feature: a key of FEATURES. skip(req): true when this request must not count (an emergency, or no AI is used).
// When it counts, req.aiUsage is the usage after this request (add it to the reply) and req.aiUsageDay its Beirut
// day; the use is given back if
// the reply is an error. At the limit it answers 429 with limitReachedBody instead of calling the route.
function dailyAiLimit(feature, { skip = () => false } = {}) {
  if (!FEATURES[feature]) throw new Error(`Unknown daily AI limit: ${feature}`);
  return async (req, res, next) => {
    try {
      if (await skip(req)) return next();
      const { allowed, usage, day } = await useOne(req.userId, feature);
      if (!allowed) {
        logEvent("ai_daily_limit", { requestId: req.requestId, feature });
        return res.status(429).json(limitReachedBody(usage));
      }
      req.aiUsage = usage;
      req.aiUsageDay = day;
      if (usage) res.once("finish", () => { if (res.statusCode >= 400) giveBack(req.userId, feature, day); });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  FEATURES, TIME_ZONE, FOLLOW_UP_ROUNDS, readDailyLimits, beirutDay, nextReset, useOne, giveBack, useSymptomCheck, giveBackSymptomCheck,
  usageToday, limitReachedBody, dailyAiLimit,
};

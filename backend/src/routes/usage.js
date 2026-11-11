// SCRUM-311: "As a developer, I want usage analytics (e.g. number of triage sessions run) so that the
// team can track adoption." A team dashboard of anonymous daily totals (no personal or health data).
//
// GET /api/usage/summary?days=7|30|90 -> { timeZone, from, to, totals, daily, generatedAt }
//
// The counts come from what is already stored anonymously (SCRUM-192, usageAnalytics.js): completed symptom
// checks, initial checks and follow-up rounds per UTC day. New accounts per day are counted from account
// creation dates only: no id, name, email or anything else about an account leaves the database.
//
// Who can see it: signed-in team members whose verified email is listed in TEAM_DASHBOARD_EMAILS
// (comma-separated). Unset means nobody. Everyone else gets the same 404 as a route that doesn't
// exist, so the dashboard isn't advertised. An unverified account can't get in by signing up with a
// team member's address.

const express = require("express");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const User = require("../models/User");
const { usageSummary } = require("../usageAnalytics");
const { logEvent } = require("../logger");

const router = express.Router();
const DAY = 86400000;
const ALLOWED_DAYS = [7, 30, 90];
const NOT_FOUND = { error: "Route not found." };
// Far above any real sign-up rate; keeps one request bounded however the data grows.
const MAX_ACCOUNTS_COUNTED = 100000;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.userId,
  message: { error: "Too many dashboard requests. Please wait a minute and try again." },
});

// The team's emails, lowercased. Read on every request, so a change to the setting needs no restart.
function teamEmails(env = process.env) {
  return new Set(String(env.TEAM_DASHBOARD_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean));
}

async function requireTeamMember(req, res, next) {
  try {
    const team = teamEmails();
    if (!team.size) return res.status(404).json(NOT_FOUND);
    const user = await User.findById(req.userId).select("email emailVerified").lean();
    if (!user?.emailVerified || !team.has(String(user.email).toLowerCase())) return res.status(404).json(NOT_FOUND);
    return next();
  } catch (error) {
    return next(error);
  }
}

// New accounts per UTC day in [from, to]. Only creation dates are read.
async function newAccountsByDay(from, to) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(Date.parse(`${to}T00:00:00.000Z`) + DAY);
  const rows = await User.find({ createdAt: { $gte: start, $lt: end } })
    .select({ createdAt: 1, _id: 0 }).limit(MAX_ACCOUNTS_COUNTED).maxTimeMS(2000).lean();
  const counts = new Map();
  for (const { createdAt } of rows) {
    const day = new Date(createdAt).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return counts;
}

async function teamSummary(days, now = new Date()) {
  const summary = await usageSummary(days, now);
  const accounts = await newAccountsByDay(summary.from, summary.to);
  const daily = summary.daily.map((row) => ({ ...row, newAccounts: accounts.get(row.day) || 0 }));
  return {
    ...summary,
    totals: { ...summary.totals, newAccounts: daily.reduce((sum, row) => sum + row.newAccounts, 0) },
    daily,
    generatedAt: now.toISOString(),
  };
}

router.get("/summary", requireAuth, limiter, requireTeamMember, async (req, res, next) => {
  const days = req.query.days === undefined ? 30 : Number(req.query.days);
  if (!ALLOWED_DAYS.includes(days)) return res.status(400).json({ error: "Choose 7, 30 or 90 days." });
  try {
    const summary = await teamSummary(days);
    // Who looked, for the team's own audit; never what they saw.
    logEvent("team_dashboard_viewed", { requestId: req.requestId, userId: req.userId });
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.teamEmails = teamEmails;
module.exports.teamSummary = teamSummary;

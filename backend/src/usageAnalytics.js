const mongoose = require("mongoose");
const UsageDaily = require("./models/UsageDaily");
const { logEvent } = require("./logger");
const DAY = 86400000;
async function recordAssessment(followup = false, now = new Date()) {
  if (mongoose.connection.readyState !== 1) return false;
  const day = now.toISOString().slice(0, 10);
  const counts = { assessments: 1, sessionsStarted: followup ? 0 : 1, followupAssessments: followup ? 1 : 0 };
  try {
    await UsageDaily.updateOne({ _id: day }, {
      $inc: counts, $setOnInsert: { expiresAt: new Date(Date.parse(day) + 90 * DAY) },
    }, { upsert: true, setDefaultsOnInsert: false, maxTimeMS: 1000 });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await UsageDaily.updateOne({ _id: day }, { $inc: counts }, { maxTimeMS: 1000 });
  }
  return true;
}
function countTriageUsage(req, res, next) {
  if (process.env.USAGE_ANALYTICS_ENABLED === "false") return next();
  const followup = Boolean(req.body?.followUpState ||
    (req.body?.answers && typeof req.body.answers === "object" && Object.keys(req.body.answers).length));
  res.once("finish", () => {
    if (res.statusCode === 200) {
      // Metrics never delay or reject the clinical result.
      recordAssessment(followup).catch(() => logEvent("usage_analytics_unavailable"));
    }
  });
  next();
}
async function usageSummary(days = 30, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new RangeError("Choose 1 through 90 whole days.");
  const today = Date.parse(now.toISOString().slice(0, 10));
  const from = new Date(today - (days - 1) * DAY).toISOString().slice(0, 10);
  const to = new Date(today).toISOString().slice(0, 10);
  const rows = await UsageDaily.find({ _id: { $gte: from, $lte: to } })
    .select("_id assessments sessionsStarted followupAssessments").maxTimeMS(2000).lean();
  const stored = new Map(rows.map(row => [row._id, row]));
  const totals = { assessments: 0, sessionsStarted: 0, followupAssessments: 0 };
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10);
    const row = { day };
    for (const field of Object.keys(totals)) { row[field] = stored.get(day)?.[field] || 0; totals[field] += row[field]; }
    return row;
  });
  return { timeZone: "UTC", from, to, totals, daily };
}
module.exports = { recordAssessment, countTriageUsage, usageSummary };

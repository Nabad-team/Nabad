const ProviderFeedback = require("../models/ProviderFeedback");
const WINDOW_MS = 2 * 60 * 60 * 1000;
const MIN_REPORTS = 3;
const LEVELS = ["short", "moderate", "long"];
const beirutDay = now => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
function feedbackInput(body, now = new Date()) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(k => !["rating", "visitDate", "note", "waitLevel", "recentVisit"].includes(k))) throw new Error("Invalid feedback fields.");
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) throw new Error("Choose a rating from 1 to 5.");
  const date = body.visitDate;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date || date > beirutDay(now)) throw new Error("Choose a valid visit date, no later than today.");
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1000)) throw new Error("Feedback must be at most 1000 characters.");
  if (body.recentVisit !== undefined && typeof body.recentVisit !== "boolean") throw new Error("Invalid recent visit confirmation.");
  const wait = body.waitLevel || null;
  if (wait !== null && !LEVELS.includes(wait)) throw new Error("Choose a valid waiting level.");
  if (wait && body.recentVisit !== true) throw new Error("Only report a waiting level observed in the last two hours.");
  if (wait && date < beirutDay(new Date(now - WINDOW_MS))) throw new Error("An older visit cannot be used for a current waiting report.");
  return { rating: body.rating, visitDate: date, note: (body.note || "").trim(), waitLevel: wait, waitReportedAt: wait ? now : null };
}
function feedbackView(row) {
  if (!row) return null;
  return { rating: row.rating, visitDate: row.visitDate, note: row.note,
    waitLevel: row.waitLevel, waitReportedAt: row.waitReportedAt, updatedAt: row.updatedAt };
}
function summary(row = {}) {
  const counts = LEVELS.map(k => row[k] || 0), total = counts.reduce((a, b) => a + b, 0);
  let level = "unknown", cumulative = 0;
  if (total >= MIN_REPORTS) for (let i = 0; i < counts.length; i++) {
    cumulative += counts[i];
    if (cumulative > Math.floor(total / 2)) { level = LEVELS[i]; break; }
  }
  return { count: row.count || 0, averageRating: row.count ? Math.round(row.averageRating * 10) / 10 : null,
    waiting: { level, reportCount: total, windowMinutes: 120, minimumReports: MIN_REPORTS,
      updatedAt: total >= MIN_REPORTS ? row.latest : null } };
}
async function providerSummaries(slugs, now = new Date()) {
  if (!slugs.length) return new Map();
  const recent = { $and: [{ $gt: ["$waitReportedAt", new Date(now - WINDOW_MS)] }, { $lte: ["$waitReportedAt", now] }] };
  // Aggregate in MongoDB: never load individual notes, author IDs or every review in JS.
  const rows = await ProviderFeedback.aggregate([{ $match: { providerSlug: { $in: slugs } } },
    { $group: { _id: "$providerSlug", count: { $sum: 1 }, averageRating: { $avg: "$rating" },
      ...Object.fromEntries(LEVELS.map(k => [k, { $sum: { $cond: [{ $and: [recent, { $eq: ["$waitLevel", k] }] }, 1, 0] } }])),
      latest: { $max: { $cond: [recent, "$waitReportedAt", null] } } } }]).option({ maxTimeMS: 3000 });
  const found = new Map(rows.map(row => [row._id, summary(row)]));
  return new Map(slugs.map(slug => [slug, found.get(slug) || summary()]));
}
module.exports = { feedbackInput, feedbackView, summary, providerSummaries, WINDOW_MS, MIN_REPORTS };

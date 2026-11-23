// GET /api/ai-usage -> { timeZone, resetsAt, symptomChecks, assistantMessages, historyQuestions, prescriptionReads,
//                        reportAnalyses }, each { feature, used, limit, remaining, resetsAt }.
// The signed-in account's AI use today (all its profiles together), so a page can show "15 of 40 messages used
// today". Counts only (dailyAiLimits.js).
const express = require("express");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const { usageToday } = require("../dailyAiLimits");

const router = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, keyGenerator: (req) => req.userId,
  message: { error: "Too many requests in a short time. Please wait a few minutes and try again." },
});

router.get("/", requireAuth, limiter, async (req, res, next) => {
  try {
    return res.json(await usageToday(req.userId));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

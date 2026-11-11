// SCRUM-156: "As a user, I want to ask natural-language questions about my own history so that I can recall
// past symptoms or visits."
//
// POST /api/history/ask?profileId=  { question, timeZone?, useAi? }
//   -> { answer, answeredBy: "ai" | "search", aiReason?, period, kinds, records, total, sources, safety? }
//
// Answers from the profile's own symptom checks, appointments, medications and documents (historyQuestions.js).
// useAi: true means the person agreed to send the question and the matching records to the configured AI
// provider; without it, or when the AI is off, slow or its answer fails the checks, the plain answer is used.
// If the question describes an emergency happening now, `safety` says to call 140 first.
// Questions and records are health data: only counts and fixed codes are logged.

const express = require("express");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const { answerHistoryQuestion } = require("../historyQuestions");
const { getLlmClient } = require("../triage/ai/modelAccess");
const { getChatSafetyReply } = require("../reports/chatSafety");
const { logEvent } = require("../logger");

const router = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, keyGenerator: (req) => req.userId,
  message: { error: "You have asked a lot of questions in a short time. Please wait a few minutes and try again." },
});

const SAFETY = {
  message: "If this is happening now, call 140 (Lebanese Red Cross) or go to the nearest emergency department. Don't wait for an answer about your history.",
  phone: "140",
};

router.post("/ask", requireAuth, limiter, resolveProfile, async (req, res, next) => {
  const { question, timeZone, useAi } = req.body || {};
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 300) {
    return res.status(400).json({ error: "Ask a question between 3 and 300 characters." });
  }
  if (timeZone !== undefined && (typeof timeZone !== "string" || timeZone.length > 64)) return res.status(400).json({ error: "Invalid time zone." });
  if (useAi !== undefined && typeof useAi !== "boolean") return res.status(400).json({ error: "Invalid request." });
  const started = performance.now();
  try {
    const result = await answerHistoryQuestion({
      owner: req.userId, profileId: req.profileId, question, timeZone,
      aiClient: useAi ? getLlmClient() : null,
    });
    logEvent("history_question", {
      requestId: req.requestId,
      reason: `${result.answeredBy}:${result.total}${result.aiReason ? `:${result.aiReason}` : ""}`,
      durationMs: Math.round(performance.now() - started),
    });
    return res.json({ ...result, ...(getChatSafetyReply(question) ? { safety: SAFETY } : {}) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

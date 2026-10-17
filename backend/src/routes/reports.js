const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/authMiddleware");
const { getLlmClient } = require("../triage/ai/llmClient");
const { extractReport, ReportInputError } = require("../reports/extract");
const { analyzeReport, ReportAnalysisError } = require("../reports/analyze");
const { answerChat } = require("../reports/chat");
const { logEvent, errorDetails } = require("../logger");

const router = express.Router();
router.use(requireAuth);
router.use(express.json({ limit: "7mb" }));

const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.userId,
  message: { error: "You have reached the report review limit. Please wait 15 minutes before trying again." },
});

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.userId,
  message: { error: "You have reached the assistant message limit. Please wait a little before asking another question." },
});

router.post("/analyze", analysisLimiter, async (req, res) => {
  const requestId = req.requestId;
  const started = performance.now();
  try {
    if (req.body?.consent !== true) return res.status(400).json({ error: "Confirm that you agree to send the report to the configured AI provider before analysis." });
    const question = req.body?.question || "";
    if (typeof question !== "string" || question.length > 1200) throw new ReportAnalysisError("invalid_question");
    const client = getLlmClient();
    if (!client) throw new ReportAnalysisError("not_configured");
    const extracted = await extractReport(req.body?.file);
    if (extracted.kind === "image" && process.env.LLM_VISION_ENABLED !== "true") {
      return res.status(503).json({ error: "Photo reading is not enabled for the configured AI model. Try a searchable PDF, DOCX, TXT, or CSV report instead." });
    }
    const result = await analyzeReport({ report: extracted, question, client });
    logEvent("report_analysis", { requestId, reason: `success:${result.urgency}`, durationMs: Math.round(performance.now() - started) });
    return res.json(result);
  } catch (error) {
    if (error instanceof ReportInputError) return res.status(error.status).json({ error: error.message });
    if (error instanceof ReportAnalysisError) {
      const status = error.code === "not_configured" ? 503 : error.code === "invalid_question" ? 400 : error.code === "not_report" ? 422 : 502;
      logEvent("report_analysis", { requestId, reason: `unavailable:${error.code}`, durationMs: Math.round(performance.now() - started) });
      const messages = {
        not_configured: "AI report review is not configured on this server yet. Your file was not analyzed.",
        invalid_question: "Keep your question under 1200 characters.",
        timeout: "The AI report review took too long. Your file was not analyzed; please try again later.",
        provider_unavailable: "The AI report service is unavailable. Your file was not analyzed; please try again later.",
        unsupported_quote: "The AI could not reliably link its explanation to text in the report. No result was shown; try a clearer copy.",
        not_report: "This appears to be a scan image or not a written report. Nabad cannot interpret raw MRI, CT, X-ray, or ultrasound images. Upload the radiologist's written report instead.",
        unsafe_response: "The AI response did not pass safety checks. No result was shown; please contact your clinician.",
      };
      return res.status(status).json({ error: messages[error.code] || "The report could not be safely analyzed. No result was shown; please contact your clinician." });
    }
    // Never log the document, extracted text, the question or a provider's raw error message.
    logEvent("report_analysis", { requestId, reason: "unavailable:internal_error", ...errorDetails(error), durationMs: Math.round(performance.now() - started) });
    return res.status(500).json({ error: "The report could not be safely analyzed. No result was shown; please try again later.", requestId });
  }
});

router.post("/chat", chatLimiter, async (req, res) => {
  const requestId = req.requestId;
  const started = performance.now();
  try {
    if (req.body?.consent !== true) return res.status(400).json({ error: "Confirm that you agree to send your question and any attachment to the configured AI provider." });
    const client = getLlmClient();
    if (!client) throw new ReportAnalysisError("not_configured");
    const report = req.body?.file ? await extractReport(req.body.file) : null;
    if (report?.kind === "image" && process.env.LLM_VISION_ENABLED !== "true") {
      return res.status(503).json({ error: "Photo reading is not enabled for the configured AI model. Try a searchable written report or ask without the photo." });
    }
    const result = await answerChat({ question: req.body?.question, history: req.body?.history, report, client });
    logEvent("health_assistant_chat", { requestId, reason: "success", durationMs: Math.round(performance.now() - started) });
    return res.json(result);
  } catch (error) {
    if (error instanceof ReportInputError) return res.status(error.status).json({ error: error.message });
    if (error instanceof ReportAnalysisError) {
      const status = error.code === "not_configured" ? 503 : ["invalid_question", "invalid_history"].includes(error.code) ? 400 : 502;
      logEvent("health_assistant_chat", { requestId, reason: `unavailable:${error.code}`, durationMs: Math.round(performance.now() - started) });
      const messages = {
        not_configured: "The health assistant is not configured on this server yet. Your message was not sent.",
        invalid_question: "Write a question between 3 and 1200 characters.",
        invalid_history: "This conversation is too long to continue. Start a new conversation and try again.",
        timeout: "The health assistant took too long to respond. Please try again.",
        provider_unavailable: "The health assistant is unavailable right now. Please try again later.",
        unsupported_quote: "The AI could not reliably ground that answer in the report. No answer was shown; try a clearer report or ask your clinician.",
        unsafe_response: "The AI response did not pass safety checks. No answer was shown; please contact a clinician for personal medical advice.",
      };
      return res.status(status).json({ error: messages[error.code] || "The health assistant could not safely answer. Please contact a clinician for personal medical advice." });
    }
    logEvent("health_assistant_chat", { requestId, reason: "unavailable:internal_error", ...errorDetails(error), durationMs: Math.round(performance.now() - started) });
    return res.status(500).json({ error: "The health assistant could not respond safely. Please try again later.", requestId });
  }
});

module.exports = router;

const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const ReportConversation = require("../models/ReportConversation");
const { getLlmClient } = require("../triage/ai/llmClient");
const { extractReport, ReportInputError } = require("../reports/extract");
const { analyzeReport, ReportAnalysisError } = require("../reports/analyze");
const { answerChat } = require("../reports/chat");
const { getChatSafetyReply } = require("../reports/chatSafety");
const { providerFailureDetails } = require("../reports/providerFailure");
const { logEvent, errorDetails } = require("../logger");

const router = express.Router();
router.use(requireAuth);
router.use(express.json({ limit: "7mb" }));
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function analysisMessages(question, result) {
  const explanation = [result.summary, ...result.findings.map((finding) => `${finding.name}: ${finding.explanation} Next step: ${finding.followUp}`), result.nextStep].join("\n").slice(0, 4000);
  return [
    { role: "user", content: question.slice(0, 4000) },
    { role: "assistant", content: explanation, disclaimer: result.disclaimer },
  ];
}

function chatMessages(question, result) {
  return [
    { role: "user", content: question.slice(0, 4000) },
    { role: "assistant", content: result.answer, evidence: result.evidence, disclaimer: result.disclaimer },
  ];
}

router.get("/conversations", resolveProfile, asyncRoute(async (req, res) => {
  const conversations = await ReportConversation.find({ owner: req.userId, profileId: req.profileId })
    .sort({ updatedAt: -1 }).limit(30).lean();
  return res.json({ conversations: conversations.map(({ _id, ...conversation }) => ({ id: String(_id), ...conversation })) });
}));

router.delete("/conversations/:id", resolveProfile, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Conversation not found." });
  const result = await ReportConversation.deleteOne({ _id: req.params.id, owner: req.userId, profileId: req.profileId });
  if (!result.deletedCount) return res.status(404).json({ error: "Conversation not found." });
  return res.status(204).end();
}));

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

router.post("/analyze", resolveProfile, analysisLimiter, async (req, res) => {
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
    const conversation = await ReportConversation.create({
      owner: req.userId,
      profileId: req.profileId,
      title: question.trim().slice(0, 120) || "Report review",
      messages: analysisMessages(question, result),
      reportResult: result,
    });
    logEvent("report_analysis", { requestId, reason: `success:${result.urgency}`, durationMs: Math.round(performance.now() - started) });
    return res.json({ ...result, conversationId: String(conversation._id) });
  } catch (error) {
    if (error instanceof ReportInputError) return res.status(error.status).json({ error: error.message });
    if (error instanceof ReportAnalysisError) {
      const status = error.code === "not_configured" ? 503 : error.code === "invalid_question" ? 400 : error.code === "not_report" ? 422 : 502;
      const reason = error.providerFailure
        ? `provider_${error.providerFailure.code}${error.providerFailure.status ? `_${error.providerFailure.status}` : ""}`
        : `unavailable:${error.code}`;
      logEvent("report_analysis", { requestId, reason, durationMs: Math.round(performance.now() - started) });
      const messages = {
        not_configured: "AI report review is not configured on this server yet. Your file was not analyzed.",
        invalid_question: "Keep your question under 1200 characters.",
        timeout: "The AI report review took too long. Your file was not analyzed; please try again later.",
        provider_unavailable: "The AI report service is unavailable. Your file was not analyzed; please try again later.",
        unsupported_quote: "The AI could not reliably link its explanation to text in the report. No result was shown; try a clearer copy.",
        not_report: "This appears to be a scan image or not a written report. Nabad cannot interpret raw MRI, CT, X-ray, or ultrasound images. Upload the radiologist's written report instead.",
        unsafe_response: "The AI response did not pass safety checks. No result was shown; please contact your clinician.",
      };
      const providerIssue = providerFailureDetails(error, "report");
      return res.status(status).json({ error: providerIssue?.message || messages[error.code] || "The report could not be safely analyzed. No result was shown; please contact your clinician.", requestId, ...(providerIssue ? { serviceIssue: providerIssue.serviceIssue } : {}) });
    }
    // Never log the document, extracted text, the question or a provider's raw error message.
    logEvent("report_analysis", { requestId, reason: "unavailable:internal_error", ...errorDetails(error), durationMs: Math.round(performance.now() - started) });
    return res.status(500).json({ error: "The report could not be safely analyzed. No result was shown; please try again later.", requestId });
  }
});

router.post("/chat", resolveProfile, chatLimiter, async (req, res) => {
  const requestId = req.requestId;
  const started = performance.now();
  try {
    if (req.body?.consent !== true) return res.status(400).json({ error: "Confirm that you agree to send your question and any attachment to the configured AI provider." });
    let savedConversation = null;
    // New-chat clients may send null. Only a supplied, non-null ID resumes a chat.
    if (req.body?.conversationId !== undefined && req.body.conversationId !== null) {
      if (!mongoose.isValidObjectId(req.body.conversationId)) return res.status(404).json({ error: "Conversation not found." });
      savedConversation = await ReportConversation.findOne({ _id: req.body.conversationId, owner: req.userId, profileId: req.profileId });
      if (!savedConversation) return res.status(404).json({ error: "Conversation not found." });
      if (savedConversation.messages.length + 2 > 80) return res.status(400).json({ error: "This saved conversation has reached its message limit. Start a new conversation." });
    }
    const safetyReply = getChatSafetyReply(req.body?.question);
    const client = getLlmClient();
    const report = !safetyReply && req.body?.file ? await extractReport(req.body.file) : null;
    if (report?.kind === "image" && process.env.LLM_VISION_ENABLED !== "true") {
      return res.status(503).json({ error: "Photo reading is not enabled for the configured AI model. Try a searchable written report or ask without the photo." });
    }
    const history = savedConversation
      ? savedConversation.messages.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 1200) }))
      : req.body?.history;
    const result = await answerChat({ question: req.body?.question, history, report, client });
    if (savedConversation) {
      savedConversation.messages.push(...chatMessages(req.body.question, result));
      await savedConversation.save();
    } else {
      savedConversation = await ReportConversation.create({
        owner: req.userId,
        profileId: req.profileId,
        title: req.body.question.trim().slice(0, 120),
        messages: chatMessages(req.body.question, result),
      });
    }
    logEvent("health_assistant_chat", { requestId, reason: result.responseSource === "safety_rules" ? "safety_rules" : "success", durationMs: Math.round(performance.now() - started) });
    return res.json({ ...result, conversationId: String(savedConversation._id) });
  } catch (error) {
    if (error instanceof ReportInputError) return res.status(error.status).json({ error: error.message });
    if (error instanceof ReportAnalysisError) {
      const status = error.code === "not_configured" ? 503 : ["invalid_question", "invalid_history"].includes(error.code) ? 400 : 502;
      const reason = error.providerFailure
        ? `provider_${error.providerFailure.code}${error.providerFailure.status ? `_${error.providerFailure.status}` : ""}`
        : `unavailable:${error.code}`;
      logEvent("health_assistant_chat", { requestId, reason, durationMs: Math.round(performance.now() - started) });
      const messages = {
        not_configured: "The health assistant is not configured on this server yet. Your message was not sent.",
        invalid_question: "Write a question between 3 and 1200 characters.",
        invalid_history: "This conversation is too long to continue. Start a new conversation and try again.",
        timeout: "The health assistant took too long to respond. Please try again.",
        provider_unavailable: "The health assistant is unavailable right now. Please try again later.",
        unsupported_quote: "The AI could not reliably ground that answer in the report. No answer was shown; try a clearer report or ask your clinician.",
        unsafe_response: "The AI response did not pass safety checks. No answer was shown; please contact a clinician for personal medical advice.",
      };
      const providerIssue = providerFailureDetails(error, "chat");
      return res.status(status).json({ error: providerIssue?.message || messages[error.code] || "The health assistant could not safely answer. Please contact a clinician for personal medical advice.", requestId, ...(providerIssue ? { serviceIssue: providerIssue.serviceIssue } : {}) });
    }
    logEvent("health_assistant_chat", { requestId, reason: "unavailable:internal_error", ...errorDetails(error), durationMs: Math.round(performance.now() - started) });
    return res.status(500).json({ error: "The health assistant could not respond safely. Please try again later.", requestId });
  }
});

module.exports = router;

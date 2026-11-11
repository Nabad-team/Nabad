// SCRUM-146: "As a user, I want to upload a photo of a prescription so that my medication list updates
// automatically."
//
// POST /api/prescriptions/read?profileId=  { file: { mimeType, data, extension }, consent: true }
//   -> { medications: [{ name, dose, unit, form, frequency, durationDays, notes, needsCheck,
//                        match: { status: "new" | "already-listed" | "changed", existingId?, changes?, current? } }],
//        unreadable }
//   The photo (JPG, PNG or WebP, or a PDF with text, up to 3 MB) goes to the configured AI model, the same way
//   as a test report, and is never stored. Nothing is saved yet.
//
// POST /api/prescriptions/apply?profileId=  { items: [{ name, dose, unit, form, frequency, startDate, endDate?,
//                                                       notes?, replaceId? }] }
//   -> { added: [medication], replaced: [{ id, name }] }
//   Saves the medicines the person kept, with the same checks as the medication form. replaceId: the
//   "changed" entry on the list, which is marked discontinued (kept for the history) and replaced by the new
//   prescription, keeping its reminder times.
//
// Mounted before the app's 100 KB JSON limit (like /api/reports), so a photo fits; each route parses its
// own body after sign-in.

const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const Medication = require("../models/Medication");
const { readMedication, MAX_MEDICATIONS } = require("./medications");
const { nextReminder } = require("../medicationSchedule");
const { extractReport, ReportInputError } = require("../reports/extract");
const { readPrescription, matchToList, PrescriptionError, MAX_MEDICATIONS: MAX_PER_PRESCRIPTION } = require("../prescriptionReader");
const { getLlmClient } = require("../triage/ai/modelAccess");
const { providerFailureDetails } = require("../reports/providerFailure");
const { logEvent, errorDetails } = require("../logger");

const router = express.Router();
router.use(requireAuth);

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, keyGenerator: (req) => req.userId,
  message: { error: "You have read several prescriptions in a short time. Please wait 15 minutes and try again." },
});
const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, keyGenerator: (req) => req.userId,
  message: { error: "Too many changes in a short time. Please wait a few minutes and try again." },
});

const MESSAGES = {
  not_configured: "Reading prescriptions is not set up on this server yet. You can still add your medicines by hand.",
  vision_disabled: "Reading photos is not turned on for the configured AI model. Try a PDF of the prescription, or add your medicines by hand.",
  not_prescription: "This doesn't look like a prescription. Take a clear photo of the whole prescription, or add your medicines by hand.",
  nothing_found: "No medicine names could be read clearly. Try a sharper photo in good light, or add your medicines by hand.",
  invalid_response: "The prescription couldn't be read reliably. Nothing was added. Please try again or add your medicines by hand.",
  timeout: "Reading the prescription took too long. Nothing was added. Please try again.",
  provider_unavailable: "The AI service is unavailable right now. Nothing was added. Please try again later.",
};

router.post("/read", readLimiter, express.json({ limit: "5mb" }), resolveProfile, async (req, res) => {
  const requestId = req.requestId;
  const started = performance.now();
  try {
    if (req.body?.consent !== true) return res.status(400).json({ error: "Confirm that you agree to send the prescription to the configured AI provider before it is read." });
    const client = getLlmClient();
    if (!client) throw new PrescriptionError("not_configured");
    const document = await extractReport(req.body?.file);
    if (document.kind === "image" && process.env.LLM_VISION_ENABLED !== "true") throw new PrescriptionError("vision_disabled");
    const { medications, unreadable } = await readPrescription({ document, client });
    const existing = await Medication.find({ owner: req.userId, profileId: req.profileId, status: "active" })
      .select("name dose unit form frequency status").lean();
    // Only counts and fixed codes are logged: never a medicine name, a dose or the photo.
    logEvent("prescription_read", { requestId, reason: `success:${medications.length}`, durationMs: Math.round(performance.now() - started) });
    return res.json({ medications: matchToList(medications, existing), unreadable });
  } catch (error) {
    if (error instanceof ReportInputError) return res.status(error.status).json({ error: error.message });
    if (error instanceof PrescriptionError) {
      const status = ["not_configured", "vision_disabled"].includes(error.code) ? 503 : ["not_prescription", "nothing_found"].includes(error.code) ? 422 : 502;
      const reason = error.providerFailure
        ? `provider_${error.providerFailure.code}${error.providerFailure.status ? `_${error.providerFailure.status}` : ""}`
        : `unavailable:${error.code}`;
      logEvent("prescription_read", { requestId, reason, durationMs: Math.round(performance.now() - started) });
      const providerIssue = providerFailureDetails(error, "report");
      return res.status(status).json({ error: providerIssue?.message || MESSAGES[error.code], requestId, ...(providerIssue ? { serviceIssue: providerIssue.serviceIssue } : {}) });
    }
    logEvent("prescription_read", { requestId, reason: "unavailable:internal_error", ...errorDetails(error), durationMs: Math.round(performance.now() - started) });
    return res.status(500).json({ error: "The prescription couldn't be read. Nothing was added. Please try again later.", requestId });
  }
});

router.post("/apply", applyLimiter, express.json({ limit: "50kb" }), resolveProfile, async (req, res, next) => {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_PER_PRESCRIPTION) {
      return res.status(400).json({ error: `Choose between 1 and ${MAX_PER_PRESCRIPTION} medicines to add.` });
    }
    // Check everything first, so a problem in the fifth medicine doesn't leave the first four half-saved.
    const checked = [];
    const replacing = new Set();
    for (const [index, item] of items.entries()) {
      const { medication, error } = readMedication(item);
      if (error) return res.status(400).json({ error: `Medicine ${index + 1}: ${error}` });
      let replaces = null;
      if (item.replaceId !== undefined && item.replaceId !== null) {
        if (!mongoose.isValidObjectId(item.replaceId) || replacing.has(String(item.replaceId))) {
          return res.status(400).json({ error: `Medicine ${index + 1}: the medication to replace was not found.` });
        }
        replaces = await Medication.findOne({ _id: item.replaceId, owner: req.userId, profileId: req.profileId, status: "active" });
        if (!replaces) return res.status(409).json({ error: `${medication.name}: the medication it replaces is no longer active on the list. Read the prescription again.` });
        replacing.add(String(item.replaceId));
        // The new entry keeps the reminders the person had set, unless they chose new ones.
        if (item.reminderTimes === undefined) {
          medication.reminderTimes = replaces.reminderTimes;
          medication.reminderTimeZone = replaces.reminderTimeZone;
        }
      }
      checked.push({ medication, replaces });
    }
    const count = await Medication.countDocuments({ owner: req.userId, profileId: req.profileId });
    if (count + checked.length > MAX_MEDICATIONS) {
      return res.status(400).json({ error: `You can keep up to ${MAX_MEDICATIONS} medications. Delete the ones you no longer need first.` });
    }

    const added = [];
    const replaced = [];
    for (const { medication, replaces } of checked) {
      const created = await Medication.create({ ...medication, owner: req.userId, profileId: req.profileId,
        nextReminderAt: nextReminder({ ...medication, status: "active" }) });
      added.push(created);
      if (replaces) {
        await Medication.updateOne({ _id: replaces._id, owner: req.userId, profileId: req.profileId },
          { $set: { status: "discontinued", nextReminderAt: null } });
        replaced.push({ id: String(replaces._id), name: replaces.name });
      }
    }
    logEvent("prescription_applied", { requestId: req.requestId, reason: `added:${added.length},replaced:${replaced.length}` });
    return res.status(201).json({
      added: added.map((m) => ({ id: String(m._id), name: m.name, dose: m.dose, unit: m.unit, form: m.form, frequency: m.frequency, status: m.status })),
      replaced,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

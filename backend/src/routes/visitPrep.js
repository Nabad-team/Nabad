const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const VisitPrep = require("../models/VisitPrep");
const MedicalDocument = require("../models/MedicalDocument");
const { QUESTION_LIMITS } = VisitPrep;
const router = express.Router();
const run = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.use(requireAuth, express.json({ limit: "300kb" }), resolveProfile);
const scope = (req) => ({ owner: req.userId, profileId: req.profileId });
const iso = (value) => (value ? new Date(value).toISOString() : null);
const questionView = (question) => ({ id: String(question._id), text: question.text, createdAt: iso(question.createdAt), updatedAt: iso(question.updatedAt) });
const view = (sheet) => ({
  overrides: sheet?.overrides || {}, notes: sheet?.notes || "", documentIds: (sheet?.documentIds || []).map(String),
  questions: (sheet?.questions || []).map(questionView),
});
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, keyGenerator: (req) => req.userId });
router.get("/", run(async (req, res) => res.json(view(await VisitPrep.findOne(scope(req)).lean()))));
router.put("/", writeLimiter, run(async (req, res) => {
  const { overrides, notes, documentIds } = req.body || {};
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides) || Object.keys(overrides).some((key) => !["background", "medications", "symptoms"].includes(key) || typeof overrides[key] !== "string" || overrides[key].length > 20000) || typeof notes !== "string" || notes.length > 5000 || !Array.isArray(documentIds) || documentIds.length > 500 || documentIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: "Enter valid visit sheet sections, notes and documents." });
  }
  const ids = [...new Set(documentIds)];
  if (await MedicalDocument.countDocuments({ ...scope(req), _id: { $in: ids } }) !== ids.length) return res.status(400).json({ error: "A selected document is no longer available for this profile. Reload the documents and try again." });
  const sheet = await VisitPrep.findOneAndUpdate(scope(req), { $set: { overrides, notes, documentIds: ids } }, { new: true, upsert: true, runValidators: true });
  return res.json(view(sheet));
}));

// ---------- SCRUM-333: questions for my doctor ----------
//
// POST   /questions        { text }  -> 201 { question, questions }
// PATCH  /questions/:id    { text }  -> { question, questions }
// DELETE /questions/:id              -> { questions }
//
// One line of up to 300 characters, at most 30 per profile, oldest first (the order they were thought of).
// They are health data like the rest of the sheet: never logged, and only ever read for the signed-in owner's profile.
const QUESTION_ERROR = `Write a question of up to ${QUESTION_LIMITS.text} characters.`;
function readQuestion(body) {
  if (!body || typeof body.text !== "string") return null;
  const text = body.text.replace(/\s+/g, " ").trim();
  return text && text.length <= QUESTION_LIMITS.text ? text : null;
}
const questionsOf = (sheet) => (sheet?.questions || []).map(questionView);

router.post("/questions", writeLimiter, run(async (req, res) => {
  const text = readQuestion(req.body);
  if (!text) return res.status(400).json({ error: QUESTION_ERROR });
  // Make sure the sheet exists, then add the question only while there is room: the limit is part of the same update,
  // so two saves at the same moment can't go past it.
  try {
    await VisitPrep.updateOne(scope(req), { $setOnInsert: { notes: "", documentIds: [] } }, { upsert: true });
  } catch (error) {
    // Two first saves at the same moment: the other one created the sheet, which is all this step needs.
    if (error?.code !== 11000) throw error;
  }
  const sheet = await VisitPrep.findOneAndUpdate(
    { ...scope(req), [`questions.${QUESTION_LIMITS.count - 1}`]: { $exists: false } },
    { $push: { questions: { text } } },
    { new: true, runValidators: true },
  );
  if (!sheet) return res.status(400).json({ error: `You can keep up to ${QUESTION_LIMITS.count} questions for this profile. Remove one you no longer need first.` });
  return res.status(201).json({ question: questionView(sheet.questions[sheet.questions.length - 1]), questions: questionsOf(sheet) });
}));

async function findQuestion(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return {};
  const sheet = await VisitPrep.findOne({ ...scope(req), "questions._id": req.params.id });
  return { sheet, question: sheet?.questions.id(req.params.id) };
}

router.patch("/questions/:id", writeLimiter, run(async (req, res) => {
  const text = readQuestion(req.body);
  if (!text) return res.status(400).json({ error: QUESTION_ERROR });
  const { sheet, question } = await findQuestion(req);
  if (!question) return res.status(404).json({ error: "Question not found." });
  question.text = text;
  await sheet.save();
  return res.json({ question: questionView(question), questions: questionsOf(sheet) });
}));

router.delete("/questions/:id", writeLimiter, run(async (req, res) => {
  const { sheet, question } = await findQuestion(req);
  if (!question) return res.status(404).json({ error: "Question not found." });
  sheet.questions.pull(question._id);
  await sheet.save();
  return res.json({ questions: questionsOf(sheet) });
}));

module.exports = router;

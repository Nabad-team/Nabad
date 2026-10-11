// Urgency classification endpoints (SCRUM-128) and follow-up questions (SCRUM-126).
//
// POST /api/triage/classify  { symptoms }           -> first result + followUpQuestions
// POST /api/triage/refine    { symptoms, answers }  -> final result after the answers
//
// Both require a signed-in user. The server is stateless: /refine classifies the symptoms
// again itself instead of trusting a level sent by the browser.
const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { classifyUrgency } = require("../triage/urgency");
const { getFollowUpQuestions, refineUrgency, AnswerError } = require("../triage/followUps");

const router = express.Router();
router.use(requireAuth);

const DISCLAIMER = "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.";

// Returns an error message, or null if the symptom text is acceptable.
function symptomsError(symptoms) {
  if (typeof symptoms !== "string" || symptoms.trim().length < 3) {
    return "Please describe your symptoms before asking for an urgency level.";
  }
  if (symptoms.length > 2000) return "Please keep the symptom description under 2000 characters.";
  return null;
}

router.post("/classify", (req, res) => {
  const symptoms = req.body?.symptoms;
  const error = symptomsError(symptoms);
  if (error) return res.status(400).json({ error });
  const result = classifyUrgency(symptoms);
  return res.json({ ...result, followUpQuestions: getFollowUpQuestions(symptoms, result), disclaimer: DISCLAIMER });
});

router.post("/refine", (req, res) => {
  const symptoms = req.body?.symptoms;
  const error = symptomsError(symptoms);
  if (error) return res.status(400).json({ error });
  try {
    return res.json({ ...refineUrgency(symptoms, req.body?.answers), disclaimer: DISCLAIMER });
  } catch (err) {
    if (err instanceof AnswerError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

module.exports = router;

// SCRUM-128 (backlog #27): urgency classification endpoint.
// POST /api/triage/classify  { symptoms: "..." }  ->  { level, label, timeframe, action, reasons, ... }
// Only signed-in users can call it, like every other health-data route.
const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { classifyUrgency } = require("../triage/urgency");

const router = express.Router();
router.use(requireAuth);

const DISCLAIMER = "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.";

router.post("/classify", (req, res) => {
  const symptoms = req.body?.symptoms;
  if (typeof symptoms !== "string" || symptoms.trim().length < 3) {
    return res.status(400).json({ error: "Please describe your symptoms before asking for an urgency level." });
  }
  if (symptoms.length > 2000) {
    return res.status(400).json({ error: "Please keep the symptom description under 2000 characters." });
  }
  const result = classifyUrgency(symptoms);
  return res.json({ ...result, disclaimer: DISCLAIMER });
});

module.exports = router;

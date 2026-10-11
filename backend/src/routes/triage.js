// Urgency classification endpoints (SCRUM-128) and follow-up questions (SCRUM-126).
//
// POST /api/triage/classify  { symptoms }           -> first result + followUpQuestions
// POST /api/triage/refine    { symptoms, answers }  -> final result after the answers
//
// Additional configuration-driven endpoints used by the Sprint 1 triage flow:
// POST /api/triage/assess          { symptoms, location } -> rule-based guidance + optional routing
// POST /api/triage/emergency-route { location }           -> emergency contact fallback
const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { classifyUrgency } = require("../triage/urgency");
const { getFollowUpQuestions, refineUrgency, AnswerError } = require("../triage/followUps");

const router = express.Router();
router.use(requireAuth);

const DISCLAIMER = "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.";

// Clinical policy is configuration, not hard-coded application logic.
// TRIAGE_RULES_JSON should contain clinician/product-approved rules.
function loadRules() {
  try {
    const rules = JSON.parse(process.env.TRIAGE_RULES_JSON || "[]");
    if (!Array.isArray(rules)) return [];
    return rules.filter((rule) =>
      rule &&
      typeof rule.pattern === "string" &&
      rule.pattern.length > 0 &&
      ["emergency", "urgent", "routine"].includes(rule.level)
    );
  } catch {
    return [];
  }
}

function matchesRule(text, rule) {
  try {
    return new RegExp(rule.pattern, "i").test(text);
  } catch {
    return false;
  }
}

function emergencyRouting(location) {
  const country = String(location?.country || "LB").trim().toUpperCase();

  if (country === "LB" || country === "LEBANON") {
    return {
      emergency: true,
      contactName: "Lebanese Red Cross",
      contactNumber: "140",
      instructions: "If this may be an emergency, call 140 or your local emergency service now.",
      mapQuery: "emergency department near me",
    };
  }

  return {
    emergency: true,
    contactName: "Local emergency services",
    contactNumber: null,
    instructions: "If this may be an emergency, call your local emergency number now.",
    mapQuery: "emergency department near me",
  };
}

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

router.post("/assess", (req, res) => {
  const symptoms = String(req.body?.symptoms || "").trim();

  if (symptoms.length < 3) {
    return res.status(400).json({ error: "Please describe your symptoms before starting an assessment." });
  }
  if (symptoms.length > 2000) {
    return res.status(400).json({ error: "Please keep the symptom description under 2000 characters." });
  }

  const priority = { emergency: 0, urgent: 1, routine: 2 };
  const matched = loadRules()
    .filter((rule) => matchesRule(symptoms, rule))
    .sort((a, b) => priority[a.level] - priority[b.level]);

  const level = matched[0]?.level || "needs_clinical_review";

  if (level === "emergency") {
    return res.json({
      level,
      disclaimer: "This is guidance, not a diagnosis.",
      matchedRuleIds: matched.map((rule) => rule.id).filter(Boolean),
      routing: emergencyRouting(req.body?.location),
    });
  }

  return res.json({
    level,
    disclaimer: "This is guidance, not a diagnosis.",
    matchedRuleIds: matched.map((rule) => rule.id).filter(Boolean),
    guidance:
      level === "urgent"
        ? "An approved urgent-care rule matched. Follow the care guidance configured for this release."
        : level === "routine"
          ? "An approved routine-care rule matched. Follow the care guidance configured for this release."
          : "No approved clinical rule matched this description. Seek advice from a qualified healthcare professional.",
  });
});

router.post("/emergency-route", (req, res) => {
  return res.json(emergencyRouting(req.body?.location || {}));
});

module.exports = router;

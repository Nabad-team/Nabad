const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const User = require("../models/User");
const LinkedProfile = require("../models/LinkedProfile");
const HealthFact = require("../models/HealthFact");
const Medication = require("../models/Medication");
const router = express.Router();

router.use(requireAuth, resolveProfile);
router.get("/", async (req, res, next) => {
  try {
    const self = String(req.profileId) === String(req.userId);
    const scope = { owner: req.userId, profileId: req.profileId };
    const [profile, facts, medications] = await Promise.all([
      self ? User.findById(req.userId).select("name dateOfBirth emergencyContact").lean()
        : LinkedProfile.findOne({ _id: req.profileId, owner: req.userId }).select("fullName dateOfBirth emergencyContact").lean(),
      HealthFact.find({ ...scope, status: "confirmed", category: { $in: ["condition", "allergy", "bloodType"] } }).select("category value").sort({ recordedAt: 1, _id: 1 }).lean(),
      Medication.find({ ...scope, status: "active" }).select("name dose unit form frequency").sort({ name: 1, _id: 1 }).lean(),
    ]);
    if (!profile) return res.status(404).json({ error: "Profile not found." });
    // Allowlist the card fields: no account credentials, suggestions, report text or other profiles.
    return res.json({
      profile: { id: self ? "self" : String(profile._id), fullName: self ? profile.name : profile.fullName,
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "" },
      preparedAt: new Date().toISOString(),
      bloodType: facts.find(fact => fact.category === "bloodType")?.value || "",
      conditions: facts.filter(fact => fact.category === "condition").map(({ value }) => ({ code: value.code, ...(value.code === "other" ? { text: value.text } : {}) })),
      allergies: facts.filter(fact => fact.category === "allergy").map(({ value }) => ({ name: value.name, type: value.type, reaction: value.reaction || "" })),
      medications: medications.map(({ name, dose, unit, form, frequency }) => ({ name, dose, unit, form, frequency })),
      // A dependent's contact is their own. Never substitute the account owner's contact.
      emergencyContact: profile.emergencyContact ? { name: profile.emergencyContact.name, phone: profile.emergencyContact.phone } : null,
    });
  } catch (error) { next(error); }
});
module.exports = router;

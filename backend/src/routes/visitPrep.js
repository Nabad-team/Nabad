const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const VisitPrep = require("../models/VisitPrep");
const MedicalDocument = require("../models/MedicalDocument");
const router = express.Router();
const run = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.use(requireAuth, express.json({ limit: "300kb" }), resolveProfile);
const scope = (req) => ({ owner: req.userId, profileId: req.profileId });
const view = (sheet) => ({ overrides: sheet?.overrides || {}, notes: sheet?.notes || "", documentIds: (sheet?.documentIds || []).map(String) });
router.get("/", run(async (req, res) => res.json(view(await VisitPrep.findOne(scope(req)).lean()))));
router.put("/", rateLimit({ windowMs: 15 * 60 * 1000, max: 100, keyGenerator: (req) => req.userId }), run(async (req, res) => {
  const { overrides, notes, documentIds } = req.body || {};
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides) || Object.keys(overrides).some((key) => !["background", "medications", "symptoms"].includes(key) || typeof overrides[key] !== "string" || overrides[key].length > 20000) || typeof notes !== "string" || notes.length > 5000 || !Array.isArray(documentIds) || documentIds.length > 500 || documentIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: "Enter valid visit sheet sections, notes and documents." });
  }
  const ids = [...new Set(documentIds)];
  if (await MedicalDocument.countDocuments({ ...scope(req), _id: { $in: ids } }) !== ids.length) return res.status(400).json({ error: "A selected document is no longer available for this profile. Reload the documents and try again." });
  const sheet = await VisitPrep.findOneAndUpdate(scope(req), { $set: { overrides, notes, documentIds: ids } }, { new: true, upsert: true, runValidators: true });
  return res.json(view(sheet));
}));
module.exports = router;

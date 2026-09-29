const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const { normalizePhone, validPhone } = require("../models/contactSchema");
const router = express.Router();
router.use(requireAuth);
router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("emergencyContact");
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    return res.json({ contact: user.emergencyContact || null });
  } catch (error) { next(error); }
});
router.post("/", async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 || typeof phone !== "string" || phone.length > 40 || !validPhone(normalizePhone(phone))) {
      return res.status(400).json({ error: "Enter a contact name and a valid Lebanese or international phone number." });
    }
    // Atomic filter prevents concurrent submissions from silently replacing a contact.
    const user = await User.findOneAndUpdate(
      { _id: req.userId, emergencyContact: null },
      { $set: { emergencyContact: { name: name.trim(), phone: normalizePhone(phone) } } },
      { new: true, runValidators: true }
    ).select("emergencyContact");
    if (!user) return res.status(409).json({ error: "An emergency contact already exists." });
    return res.status(201).json({ contact: user.emergencyContact });
  } catch (error) { next(error); }
});
module.exports = router;

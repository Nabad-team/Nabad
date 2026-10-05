const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const { normalizePhone, validPhone } = require("../models/contactSchema");
const router = express.Router();
router.use(requireAuth);

// The emergency contact lives inside the signed-in user's own document, so every query
// filters by req.userId. An id in the body is never used: one account cannot touch another's contact.
const INVALID_CONTACT = "Enter a contact name and a valid Lebanese or international phone number.";
// Returns the cleaned { name, phone } or null if the body is invalid. Shared by add (POST) and edit (PUT).
function readContact(body) {
  const { name, phone } = body || {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) return null;
  if (typeof phone !== "string" || phone.length > 40 || !validPhone(normalizePhone(phone))) return null;
  return { name: name.trim(), phone: normalizePhone(phone) };
}

router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("emergencyContact");
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    return res.json({ contact: user.emergencyContact || null });
  } catch (error) { next(error); }
});

// Add: only when no contact exists yet.
router.post("/", async (req, res, next) => {
  try {
    const contact = readContact(req.body);
    if (!contact) return res.status(400).json({ error: INVALID_CONTACT });
    // Atomic filter prevents concurrent submissions from silently replacing a contact.
    const user = await User.findOneAndUpdate(
      { _id: req.userId, emergencyContact: null },
      { $set: { emergencyContact: contact } },
      { new: true, runValidators: true }
    ).select("emergencyContact");
    if (!user) return res.status(409).json({ error: "An emergency contact already exists." });
    return res.status(201).json({ contact: user.emergencyContact });
  } catch (error) { next(error); }
});

// Edit: replaces the name and phone of the existing contact. Both fields are required,
// so the contact is never left half-filled. 404 if there is nothing to edit yet (use POST to add).
router.put("/", async (req, res, next) => {
  try {
    const contact = readContact(req.body);
    if (!contact) return res.status(400).json({ error: INVALID_CONTACT });
    // The filter only matches if a contact exists, in the same atomic step as the update.
    const user = await User.findOneAndUpdate(
      { _id: req.userId, emergencyContact: { $ne: null } },
      { $set: { emergencyContact: contact } },
      { new: true, runValidators: true }
    ).select("emergencyContact");
    if (!user) return res.status(404).json({ error: "You have no emergency contact to edit. Add one first." });
    return res.json({ contact: user.emergencyContact });
  } catch (error) { next(error); }
});

// Remove: deletes the contact field entirely. Removing when none exists is not an error,
// so a double click or a retry after a network failure still ends in the same state.
router.delete("/", async (req, res, next) => {
  try {
    const result = await User.updateOne({ _id: req.userId }, { $unset: { emergencyContact: 1 } });
    if (result.matchedCount === 0) return res.status(401).json({ error: "Not authenticated." });
    return res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;

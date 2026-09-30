const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const LinkedProfile = require("../models/LinkedProfile");
const { requireAuth } = require("../middleware/authMiddleware");
const { normalizePhone, validPhone } = require("../models/contactSchema");
const { cookieOptions } = require("../config");
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// The signed-in user's own profile, their linked profiles (dependents) and account deletion.
// Every linked-profile query filters by owner = req.userId, so one user can never read or change another's profiles.
const router = express.Router();
router.use(requireAuth);

const RELATIONSHIPS = ["child", "parent", "spouse", "other"];
const MAX_LINKED_PROFILES = 10;
const MAX_PICTURE_BYTES = 1024 * 1024;
// Keyed by account (requireAuth runs first), so a stolen session cannot guess the password.
const deleteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyGenerator: (req) => req.userId, message: { error: "Too many account deletion attempts. Try again later." } });

const dateString = (date) => (date ? date.toISOString().slice(0, 10) : "");
const selfView = (user) => ({
  id: "self", fullName: user.name, email: user.email, phone: user.phone || "", dateOfBirth: dateString(user.dateOfBirth),
  relationship: "self", isSelf: true, profilePicture: user.profilePicture || "", authProvider: user.authProvider,
});
const linkedView = (profile) => ({
  id: String(profile._id), fullName: profile.fullName, dateOfBirth: dateString(profile.dateOfBirth),
  relationship: profile.relationship, isSelf: false, profilePicture: profile.profilePicture || "",
});

const validName = (value) => typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 100;
// A real calendar date in YYYY-MM-DD format that is not in the future.
function validDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && dateString(date) === value && date <= new Date();
}
// Only PNG or JPEG data URLs of at most 1 MB, and the bytes must really be a PNG or JPEG.
function validPicture(value) {
  const match = typeof value === "string" && /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_PICTURE_BYTES) return false;
  const png = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return match[1] === "png" ? png : jpeg;
}

// Returns the linked profile only if it belongs to the signed-in user. Ids never come from the body.
async function findOwnedProfile(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return LinkedProfile.findOne({ _id: req.params.id, owner: req.userId });
}
async function findMe(req, res) {
  const user = await User.findById(req.userId);
  if (!user) res.status(401).json({ error: "Not authenticated." });
  return user;
}

router.get("/me", asyncRoute(async (req, res) => {
  const user = await findMe(req, res);
  if (user) return res.json({ profile: selfView(user) });
}));

// Only name, phone and date of birth can change. Email and every other field in the body are ignored.
router.patch("/me", asyncRoute(async (req, res) => {
  const { fullName, phone, dateOfBirth } = req.body || {};
  const update = {};
  if (fullName !== undefined) {
    if (!validName(fullName)) return res.status(400).json({ error: "Full name is required (up to 100 characters)." });
    update.name = fullName.trim();
  }
  if (phone !== undefined) {
    if (typeof phone !== "string" || phone.length > 40 || (phone.trim() !== "" && !validPhone(normalizePhone(phone)))) {
      return res.status(400).json({ error: "Enter a valid Lebanese or international phone number." });
    }
    update.phone = phone.trim() === "" ? "" : normalizePhone(phone);
  }
  if (dateOfBirth !== undefined) {
    if (dateOfBirth !== "" && !validDateString(dateOfBirth)) return res.status(400).json({ error: "Enter a valid date of birth that is not in the future." });
    update.dateOfBirth = dateOfBirth === "" ? null : new Date(dateOfBirth);
  }
  const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true, runValidators: true });
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  return res.json({ profile: selfView(user) });
}));

router.get("/linked", asyncRoute(async (req, res) => {
  const profiles = await LinkedProfile.find({ owner: req.userId }).sort({ createdAt: 1, _id: 1 });
  return res.json({ profiles: profiles.map(linkedView) });
}));

router.post("/linked", asyncRoute(async (req, res) => {
  const { fullName, dateOfBirth, relationship } = req.body || {};
  if (!validName(fullName)) return res.status(400).json({ error: "Full name is required (up to 100 characters)." });
  if (!validDateString(dateOfBirth)) return res.status(400).json({ error: "Enter a valid date of birth that is not in the future." });
  if (!RELATIONSHIPS.includes(relationship)) return res.status(400).json({ error: "Relationship must be child, parent, spouse, or other." });
  if (await LinkedProfile.countDocuments({ owner: req.userId }) >= MAX_LINKED_PROFILES) {
    return res.status(400).json({ error: `You can link up to ${MAX_LINKED_PROFILES} dependents.` });
  }
  const profile = await LinkedProfile.create({ owner: req.userId, fullName: fullName.trim(), dateOfBirth: new Date(dateOfBirth), relationship });
  return res.status(201).json({ profile: linkedView(profile) });
}));

router.delete("/linked/:id", asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Profile not found." });
  const result = await LinkedProfile.deleteOne({ _id: req.params.id, owner: req.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Profile not found." });
  return res.status(204).end();
}));

// Profile pictures: "me" is the account owner, anything else is one of their linked profiles.
async function setPicture(req, res, profilePicture) {
  if (req.params.id === undefined) {
    const user = await User.findByIdAndUpdate(req.userId, { $set: { profilePicture } }, { new: true });
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    return res.json({ profile: selfView(user) });
  }
  const profile = await findOwnedProfile(req);
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  profile.profilePicture = profilePicture;
  await profile.save();
  return res.json({ profile: linkedView(profile) });
}
const putPicture = asyncRoute(async (req, res) => {
  const { profilePicture } = req.body || {};
  if (!validPicture(profilePicture)) return res.status(400).json({ error: "Please upload a JPG or PNG image smaller than 1 MB." });
  return setPicture(req, res, profilePicture);
});
const deletePicture = asyncRoute(async (req, res) => setPicture(req, res, ""));
router.put("/me/picture", putPicture);
router.delete("/me/picture", deletePicture);
router.put("/linked/:id/picture", putPicture);
router.delete("/linked/:id/picture", deletePicture);

// Deletes the account and everything in it. Password accounts confirm with their password,
// Google-only accounts (no password they know) with their email. Both must type DELETE.
router.delete("/me", deleteLimiter, asyncRoute(async (req, res) => {
  const { confirm, password, email } = req.body || {};
  if (confirm !== "DELETE") return res.status(400).json({ error: "Type DELETE to confirm." });
  const user = await findMe(req, res);
  if (!user) return;
  if (user.authProvider === "google") {
    if (typeof email !== "string" || email.trim().toLowerCase() !== user.email) return res.status(400).json({ error: "Email does not match." });
  } else if (typeof password !== "string" || Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(400).json({ error: "Password is incorrect." });
  }
  // Linked profiles first: if deleting the user then fails, the account still exists and can be deleted again.
  await LinkedProfile.deleteMany({ owner: user._id });
  // The emergency contact is stored inside the user document, so it is deleted with it.
  await User.deleteOne({ _id: user._id });
  res.clearCookie("accessToken", cookieOptions());
  return res.status(204).end();
}));

module.exports = router;

const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Medication = require("../models/Medication");
const { FORMS, STATUSES, LIMITS } = Medication;
const { requireAuth } = require("../middleware/authMiddleware");
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// The signed-in user's medications. Every query filters by owner = req.userId, and a medication that
// belongs to someone else answers 404 exactly like one that doesn't exist, so ids can't be probed.
// Health data: medication names, doses and notes are never logged (the logger only writes allowlisted fields).
const router = express.Router();
router.use(requireAuth);

const MAX_MEDICATIONS = 200;
// Keyed by account (requireAuth runs first). Generous for real use, stops scripted floods.
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, keyGenerator: (req) => req.userId, message: { error: "Too many changes in a short time. Please wait a few minutes and try again." } });
const NOT_FOUND = { error: "Medication not found." };

const dateString = (date) => (date ? date.toISOString().slice(0, 10) : "");
// The account owner's own profile. Linked profiles (#48) will pass their own id here.
const selfProfileId = (req) => new mongoose.Types.ObjectId(req.userId);
const view = (medication) => ({
  id: String(medication._id),
  profileId: String(medication.profileId) === String(medication.owner) ? "self" : String(medication.profileId),
  name: medication.name, dose: medication.dose, unit: medication.unit, form: medication.form, frequency: medication.frequency,
  startDate: dateString(medication.startDate), endDate: dateString(medication.endDate),
  status: medication.status, notes: medication.notes,
  createdAt: medication.createdAt, updatedAt: medication.updatedAt,
});

// A real calendar date in YYYY-MM-DD format, between 1900 and 2100.
function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || dateString(date) !== value) return null;
  const year = date.getUTCFullYear();
  return year >= 1900 && year <= 2100 ? date : null;
}

// Optional text: missing, null or "" all mean empty.
function readText(body, field, label, errors) {
  const value = body[field];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") { errors.push(`${label} must be text.`); return ""; }
  const text = value.trim();
  if (text.length > LIMITS[field]) errors.push(`${label} must be ${LIMITS[field]} characters or fewer.`);
  return text;
}

// Checks a whole medication from the request body (add and edit both send every field).
// Returns { medication } with the cleaned fields, or { error } with the first problem in plain words.
// status, owner and profileId are never read from the body.
function readMedication(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const errors = [];
  const name = readText(body, "name", "Medication name", errors);
  if (!errors.length && !name) errors.push("Enter the medication name.");
  const dose = readText(body, "dose", "Dose", errors);
  const unit = readText(body, "unit", "Unit", errors);
  const frequency = readText(body, "frequency", "How often", errors);
  const notes = readText(body, "notes", "Notes", errors);
  const form = body.form === undefined || body.form === "" ? "tablet" : body.form;
  if (!FORMS.includes(form)) errors.push("Choose a form: tablet, syrup, injection, inhaler, drops or other.");
  const startDate = parseDate(body.startDate);
  if (!startDate) errors.push("Enter a valid start date.");
  let endDate = null;
  if (body.endDate !== undefined && body.endDate !== null && body.endDate !== "") {
    endDate = parseDate(body.endDate);
    if (!endDate) errors.push("Enter a valid end date, or leave it empty.");
    else if (startDate && endDate < startDate) errors.push("The end date can't be before the start date.");
  }
  if (errors.length) return { error: errors[0] };
  return { medication: { name, dose, unit, form, frequency, startDate, endDate, notes } };
}

// Matches the medication only if it belongs to the signed-in user. null for an id that can't exist (answered as 404).
const ownedFilter = (req) => (mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id, owner: req.userId } : null);

// Active first, then discontinued; newest first within each.
router.get("/", asyncRoute(async (req, res) => {
  const medications = await Medication.find({ owner: req.userId, profileId: selfProfileId(req) }).sort({ status: 1, createdAt: -1, _id: -1 });
  return res.json({ medications: medications.map(view) });
}));

router.post("/", writeLimiter, asyncRoute(async (req, res) => {
  const { medication, error } = readMedication(req.body);
  if (error) return res.status(400).json({ error });
  if (await Medication.countDocuments({ owner: req.userId }) >= MAX_MEDICATIONS) {
    return res.status(400).json({ error: `You can keep up to ${MAX_MEDICATIONS} medications. Delete the ones you no longer need first.` });
  }
  const created = await Medication.create({ ...medication, owner: req.userId, profileId: selfProfileId(req) });
  return res.status(201).json({ medication: view(created) });
}));

router.put("/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req);
  if (!filter) return res.status(404).json(NOT_FOUND);
  const { medication, error } = readMedication(req.body);
  if (error) return res.status(400).json({ error });
  const updated = await Medication.findOneAndUpdate(filter, { $set: medication }, { new: true, runValidators: true });
  if (!updated) return res.status(404).json(NOT_FOUND);
  return res.json({ medication: view(updated) });
}));

router.patch("/:id/status", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req);
  if (!filter) return res.status(404).json(NOT_FOUND);
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Status must be active or discontinued." });
  const updated = await Medication.findOneAndUpdate(filter, { $set: { status } }, { new: true });
  if (!updated) return res.status(404).json(NOT_FOUND);
  return res.json({ medication: view(updated) });
}));

router.delete("/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req);
  if (!filter) return res.status(404).json(NOT_FOUND);
  const result = await Medication.deleteOne(filter);
  if (result.deletedCount === 0) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}));

module.exports = router;

const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const HealthFact = require("../models/HealthFact");
const { CATEGORIES, SINGLE_CATEGORIES } = HealthFact;
const { readValue, slotFor, ageText, loadHealthProfile } = require("../healthProfile");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile, profileView } = require("../middleware/profileAccess");
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// "My health" for the signed-in user and the people they look after. Mounted at /api/health-profile
// (/api/health is the server's own health check).
// Every route takes ?profileId= ("self" by default, or one of the user's linked profiles; anything else is 404),
// and every query filters by owner and profile, so another user's facts answer 404 exactly like missing ones.
// Health data: values are never logged (the logger only writes allowlisted fields).
const router = express.Router();
router.use(requireAuth);
router.use(resolveProfile);

const MAX_FACTS = 100; // per profile
// Keyed by account (requireAuth runs first), like medications.
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, keyGenerator: (req) => req.userId, message: { error: "Too many changes in a short time. Please wait a few minutes and try again." } });
const NOT_FOUND = { error: "Health information not found." };
const SUGGESTION_NOT_FOUND = { error: "Suggestion not found." };
const ALREADY_RECORDED = { error: "This is already recorded. Change or remove it instead." };

const dateString = (date) => (date ? date.toISOString().slice(0, 10) : "");
const factView = (fact) => ({
  id: String(fact._id), profileId: profileView(fact),
  category: fact.category, value: fact.value, source: fact.source, status: fact.status,
  recordedAt: fact.recordedAt, updatedAt: fact.updatedAt,
});
const medicationView = (medication) => ({
  id: String(medication._id), name: medication.name, dose: medication.dose, unit: medication.unit,
  form: medication.form, frequency: medication.frequency,
});

const scope = (req) => ({ owner: req.userId, profileId: req.profileId });
// Matches one fact of this profile with the given status. null for an id that can't exist (answered as 404).
const ownedFilter = (req, status) => (mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id, ...scope(req), status } : null);
const isDuplicate = (error) => error.code === 11000;

// The whole profile: age (from the date of birth on the profile), confirmed facts, suggestions to review,
// the active medications (read only here), and the summary Nabad's guidance uses.
router.get("/", asyncRoute(async (req, res) => {
  const { dateOfBirth, age, facts, medications, summary } = await loadHealthProfile(req.userId, req.profileId);
  return res.json({
    dateOfBirth: dateString(dateOfBirth),
    age: age ? { years: age.years, text: ageText(age) } : null,
    facts: facts.filter((fact) => fact.status === "confirmed").map(factView),
    suggestions: facts.filter((fact) => fact.status === "suggested").map(factView),
    medications: medications.map(medicationView),
    summary,
  });
}));

// Adds a fact the user entered: { category, value }. It is confirmed, with "user" as its source.
router.post("/facts", writeLimiter, asyncRoute(async (req, res) => {
  const { category, value: input } = req.body || {};
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Choose what kind of health information this is." });
  const { value, error } = readValue(category, input);
  if (error) return res.status(400).json({ error });
  if (await HealthFact.countDocuments(scope(req)) >= MAX_FACTS) {
    return res.status(400).json({ error: `You can keep up to ${MAX_FACTS} items here. Remove the ones you no longer need first.` });
  }
  try {
    const fact = await HealthFact.create({ ...scope(req), category, value, source: "user", status: "confirmed", slot: slotFor(category, value) });
    return res.status(201).json({ fact: factView(fact) });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json(ALREADY_RECORDED);
    throw err;
  }
}));

// Changes a confirmed fact's value: { value }. The category stays the same.
router.put("/facts/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req, "confirmed");
  if (!filter) return res.status(404).json(NOT_FOUND);
  const fact = await HealthFact.findOne(filter);
  if (!fact) return res.status(404).json(NOT_FOUND);
  const { value, error } = readValue(fact.category, (req.body || {}).value);
  if (error) return res.status(400).json({ error });
  const slot = slotFor(fact.category, value);
  try {
    const updated = await HealthFact.findOneAndUpdate(filter, slot ? { $set: { value, slot } } : { $set: { value }, $unset: { slot: 1 } }, { new: true });
    if (!updated) return res.status(404).json(NOT_FOUND);
    return res.json({ fact: factView(updated) });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json(ALREADY_RECORDED);
    throw err;
  }
}));

router.delete("/facts/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req, "confirmed");
  const result = filter ? await HealthFact.deleteOne(filter) : { deletedCount: 0 };
  if (result.deletedCount === 0) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}));

// Confirms a suggestion (for example from a lab report): from now on it counts like a fact the user added.
// For a single category (blood type...) it replaces the current value: the user chose it. A condition that is
// already on the list is kept as it is, and the suggestion goes.
router.post("/suggestions/:id/confirm", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req, "suggested");
  const suggestion = filter && await HealthFact.findOne(filter);
  if (!suggestion) return res.status(404).json(SUGGESTION_NOT_FOUND);
  const slot = slotFor(suggestion.category, suggestion.value);
  if (slot) {
    const existing = await HealthFact.findOne({ ...scope(req), status: "confirmed", slot });
    if (existing && !SINGLE_CATEGORIES.includes(suggestion.category)) {
      await HealthFact.deleteOne(filter);
      return res.json({ fact: factView(existing) });
    }
    if (existing) await HealthFact.deleteOne({ _id: existing._id });
  }
  try {
    const confirmed = await HealthFact.findOneAndUpdate(filter, { $set: slot ? { status: "confirmed", slot } : { status: "confirmed" } }, { new: true });
    if (!confirmed) return res.status(404).json(SUGGESTION_NOT_FOUND);
    return res.json({ fact: factView(confirmed) });
  } catch (err) {
    if (isDuplicate(err)) return res.status(409).json({ error: "This changed in another window. Please reload and try again." });
    throw err;
  }
}));

// Dismissing a suggestion deletes it: it was never confirmed, so it was never used.
router.post("/suggestions/:id/dismiss", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req, "suggested");
  const result = filter ? await HealthFact.deleteOne(filter) : { deletedCount: 0 };
  if (result.deletedCount === 0) return res.status(404).json(SUGGESTION_NOT_FOUND);
  return res.status(204).end();
}));

module.exports = router;

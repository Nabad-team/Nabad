const express = require("express");
const Provider = require("../models/Provider");
const { parseQuery } = require("../providers/query");
const { searchProviders } = require("../providers/search");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");
const ProviderFeedback = require("../models/ProviderFeedback");
const ProviderCorrection = require("../models/ProviderCorrection");
const { feedbackInput, feedbackView, providerSummaries } = require("../providers/feedback");
const { openingStatus } = require("../providers/hours");
const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const view = p => ({ id: p.slug, name: p.name, type: p.type, city: p.city, district: p.district || "", address: p.address,
  latitude: p.latitude, longitude: p.longitude, locationApproximate: p.locationApproximate,
  phone: p.phone, specialties: p.specialties, services: p.services || [], governorate: p.governorate || "", emergency24h: p.emergency24h,
  servicesReviewedAt: p.servicesReviewedAt || null, serviceSources: p.serviceSources || [],
  insurances: p.insurances || [], insuranceSources: p.insuranceSources || [], insuranceVerifiedAt: p.insuranceVerifiedAt || null,
  hoursKnown: p.hoursKnown, hours: p.hours, openingStatus: p.openingStatus, sources: p.sources, verifiedAt: p.verifiedAt,
  distanceKm: p.distanceKm == null ? null : Math.round(p.distanceKm * 10) / 10 });
router.get("/", (req, res, next) => req.query.favorites === "true" ? requireAuth(req, res, next) : next(), asyncRoute(async (req, res) => {
  let query;
  try { query = parseQuery(req.query); } catch (error) { return res.status(400).json({ error: error.message }); }
  let favorites;
  if (query.favorites) {
    const account = await User.findById(req.userId).select("favoriteProviders").lean();
    favorites = account?.favoriteProviders || [];
  }
  const result = await searchProviders(query, favorites);
  const summaries = await providerSummaries(result.providers.map(p => p.slug));
  res.json({ ...result, providers: result.providers.map(p => ({ ...view(p), feedback: summaries.get(p.slug) })) });
}));
router.get("/favorites", requireAuth, asyncRoute(async (req, res) => {
  const account = await User.findById(req.userId).select("favoriteProviders").lean();
  const providers = await Provider.find({ slug: { $in: account?.favoriteProviders || [] } }).select("slug").lean();
  res.json({ favorites: providers.map(provider => provider.slug) });
}));
const writes = rateLimit({ windowMs: 15 * 60 * 1000, max: 150, keyGenerator: req => req.userId,
  message: { error: "Too many changes. Please try again in a few minutes." } });
async function canonicalSlug(id) {
  if (id.length > 100 || !/^[a-z0-9-]+$/.test(id)) return null;
  const alias = await Provider.findOne({ legacySlugs: id }).select("slug").lean();
  if (alias) return alias.slug;
  return await Provider.exists({ slug: id }) ? id : null;
}
router.put("/:id/favorite", requireAuth, writes, asyncRoute(async (req, res) => {
  const id = await canonicalSlug(req.params.id);
  if (!id) return res.status(404).json({ error: "Provider not found." });
  // Limit and addition are one atomic update, including simultaneous requests.
  const account = await User.findOneAndUpdate({ _id: req.userId, $or: [{ "favoriteProviders.99": { $exists: false } }, { favoriteProviders: id }] },
    { $addToSet: { favoriteProviders: id } }, { new: true }).select("_id");
  if (!account) return res.status(409).json({ error: "You can save up to 100 providers. Remove one before adding another." });
  res.json({ id, favorite: true });
}));
router.delete("/:id/favorite", requireAuth, writes, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (id.length > 100 || !/^[a-z0-9-]+$/.test(id)) return res.status(404).json({ error: "Provider not found." });
  const canonical = await canonicalSlug(id);
  await User.updateOne({ _id: req.userId }, { $pull: { favoriteProviders: { $in: [...new Set([id, canonical].filter(Boolean))] } } });
  res.status(204).end();
}));
const contributions = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyGenerator: req => req.userId,
  message: { error: "Too many submissions. Please try again later." } });
const providerId = asyncRoute(async (req, res, next) => {
  req.providerSlug = await canonicalSlug(req.params.id);
  if (!req.providerSlug) return res.status(404).json({ error: "Provider not found." });
  next();
});
router.get("/:id", providerId, asyncRoute(async (req, res) => {
  const p = await Provider.findOne({ slug: req.providerSlug }).lean();
  if (!p) return res.status(404).json({ error: "Provider not found." });
  const summaries = await providerSummaries([p.slug]);
  res.json({ provider: { ...view({ ...p, openingStatus: openingStatus(p) }), feedback: summaries.get(p.slug) } });
}));
router.get("/:id/feedback/me", requireAuth, providerId, asyncRoute(async (req, res) => {
  const entry = await ProviderFeedback.findOne({ owner: req.userId, providerSlug: req.providerSlug }).lean();
  res.json({ feedback: feedbackView(entry) });
}));
router.put("/:id/feedback", requireAuth, contributions, providerId, asyncRoute(async (req, res) => {
  let fields;
  try { fields = feedbackInput(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
  const filter = { owner: req.userId, providerSlug: req.providerSlug };
  let entry;
  try {
    entry = await ProviderFeedback.findOneAndUpdate(filter, { $set: fields }, { upsert: true, new: true, runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    entry = await ProviderFeedback.findOneAndUpdate(filter, { $set: fields }, { new: true, runValidators: true });
  }
  res.json({ feedback: feedbackView(entry) });
}));
router.delete("/:id/feedback", requireAuth, contributions, providerId, asyncRoute(async (req, res) => {
  await ProviderFeedback.deleteOne({ owner: req.userId, providerSlug: req.providerSlug });
  res.status(204).end();
}));
router.get("/:id/corrections/me", requireAuth, providerId, asyncRoute(async (req, res) => {
  const rows = await ProviderCorrection.find({ owner: req.userId, providerSlug: req.providerSlug }).select("field details status updatedAt -_id").sort({ updatedAt: -1 }).lean();
  res.json({ reports: rows.map(({ field, details, status, updatedAt }) => ({ field, details, status, updatedAt })) });
}));
router.delete("/:id/corrections/:field", requireAuth, contributions, providerId, asyncRoute(async (req, res) => {
  if (!["name", "location", "phone", "hours", "insurance", "services", "other"].includes(req.params.field)) return res.status(400).json({ error: "Invalid report field." });
  await ProviderCorrection.deleteOne({ owner: req.userId, providerSlug: req.providerSlug, field: req.params.field });
  res.status(204).end();
}));
router.put("/:id/corrections", requireAuth, contributions, providerId, asyncRoute(async (req, res) => {
  const { field, details } = req.body || {};
  if (!req.body || Array.isArray(req.body) || Object.keys(req.body).some(k => !["field", "details"].includes(k)) ||
      !["name", "location", "phone", "hours", "insurance", "services", "other"].includes(field) ||
      typeof details !== "string" || !details.trim() || details.length > 1000) return res.status(400).json({ error: "Choose a field and describe the correction in at most 1000 characters." });
  const filter = { owner: req.userId, providerSlug: req.providerSlug, field };
  const update = { $set: { details: details.trim(), status: "pending" } };
  try { await ProviderCorrection.updateOne(filter, update, { upsert: true, runValidators: true }); }
  catch (error) { if (error.code !== 11000) throw error; await ProviderCorrection.updateOne(filter, update, { runValidators: true }); }
  res.json({ status: "pending", message: "Report saved for review. Published information has not been changed." });
}));
module.exports = router;

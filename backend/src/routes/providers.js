const express = require("express");
const Provider = require("../models/Provider");
const { parseQuery, filterProviders } = require("../providers/query");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const view = p => ({ id: p.slug, name: p.name, type: p.type, city: p.city, address: p.address,
  latitude: p.latitude, longitude: p.longitude, locationApproximate: p.locationApproximate,
  phone: p.phone, specialties: p.specialties, emergency24h: p.emergency24h,
  hoursKnown: p.hoursKnown, hours: p.hours, openingStatus: p.openingStatus, sources: p.sources, verifiedAt: p.verifiedAt,
  distanceKm: p.distanceKm == null ? null : Math.round(p.distanceKm * 10) / 10 });
router.get("/", (req, res, next) => req.query.favorites === "true" ? requireAuth(req, res, next) : next(), asyncRoute(async (req, res) => {
  let query;
  try { query = parseQuery(req.query); } catch (error) { return res.status(400).json({ error: error.message }); }
  const providers = await Provider.find().sort({ name: 1 }).lean();
  let candidates = providers;
  if (query.favorites) {
    const account = await User.findById(req.userId).select("favoriteProviders").lean();
    const favorites = new Set(account?.favoriteProviders || []);
    candidates = candidates.filter(provider => favorites.has(provider.slug));
  }
  const matches = filterProviders(candidates, query);
  const offset = (query.page - 1) * query.limit;
  res.json({ providers: matches.slice(offset, offset + query.limit).map(view), total: matches.length, page: query.page, limit: query.limit,
    specialties: [...new Set(providers.flatMap(p => p.specialties))].sort(),
    cities: [...new Set(providers.map(p => p.city))].sort() });
}));
router.get("/favorites", requireAuth, asyncRoute(async (req, res) => {
  const account = await User.findById(req.userId).select("favoriteProviders").lean();
  const providers = await Provider.find({ slug: { $in: account?.favoriteProviders || [] } }).select("slug").lean();
  res.json({ favorites: providers.map(provider => provider.slug) });
}));
const writes = rateLimit({ windowMs: 15 * 60 * 1000, max: 150, keyGenerator: req => req.userId,
  message: { error: "Too many changes. Please try again in a few minutes." } });
router.put("/:id/favorite", requireAuth, writes, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (id.length > 100 || !/^[a-z0-9-]+$/.test(id) || !await Provider.exists({ slug: id })) return res.status(404).json({ error: "Provider not found." });
  // Limit and addition are one atomic update, including simultaneous requests.
  const account = await User.findOneAndUpdate({ _id: req.userId, $or: [{ "favoriteProviders.99": { $exists: false } }, { favoriteProviders: id }] },
    { $addToSet: { favoriteProviders: id } }, { new: true }).select("_id");
  if (!account) return res.status(409).json({ error: "You can save up to 100 providers. Remove one before adding another." });
  res.json({ id, favorite: true });
}));
router.delete("/:id/favorite", requireAuth, writes, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (id.length > 100 || !/^[a-z0-9-]+$/.test(id)) return res.status(404).json({ error: "Provider not found." });
  await User.updateOne({ _id: req.userId }, { $pull: { favoriteProviders: id } });
  res.status(204).end();
}));
module.exports = router;

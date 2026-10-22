const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const { ownedProfileId, profileView, PROFILE_NOT_FOUND } = require("../middleware/profileAccess");
const { preferencesView, TYPES, SAFETY_TYPES } = require("../notifications");

// The signed-in user's notification history and in-app preferences. Notifications are created only by
// notify() (notifications.js), never through this API. Every query filters by owner = req.userId.
const router = express.Router();
router.use(requireAuth);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
// The header bell asks for the unread count every minute and when the tab regains focus.
const readLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, keyGenerator: (req) => req.userId, message: { error: "Too many requests in a short time. Please wait a few minutes and try again." } });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, keyGenerator: (req) => req.userId, message: { error: "Too many changes in a short time. Please wait a few minutes and try again." } });
const NOT_FOUND = { error: "Notification not found." };
const PAGE_SIZE = { default: 20, max: 50 };

const view = (notification) => ({
  id: String(notification._id), profileId: profileView(notification), type: notification.type,
  title: notification.title, message: notification.message, link: notification.link || "",
  read: Boolean(notification.readAt), readAt: notification.readAt, createdAt: notification.createdAt,
});
const ownedFilter = (req) => (mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id, owner: req.userId } : null);
const positiveInteger = (value, fallback) => (value === undefined ? fallback : /^\d{1,4}$/.test(value) && Number(value) > 0 ? Number(value) : null);

// Newest first, a page at a time. ?profileId= ("self" or a linked profile) narrows it to one person, ?unread=true
// to unread ones. Another user's dependent answers 404, like everywhere else.
router.get("/", readLimiter, asyncRoute(async (req, res) => {
  const { profileId, unread } = req.query;
  const page = positiveInteger(req.query.page, 1);
  const limit = positiveInteger(req.query.limit, PAGE_SIZE.default);
  if (!page || !limit || limit > PAGE_SIZE.max) return res.status(400).json({ error: `Page and limit must be whole numbers, with a limit of at most ${PAGE_SIZE.max}.` });
  if (unread !== undefined && !["true", "false"].includes(unread)) return res.status(400).json({ error: "unread must be true or false." });
  const filter = { owner: req.userId };
  if (profileId !== undefined) {
    const stored = typeof profileId === "string" ? await ownedProfileId(req.userId, profileId) : null;
    if (!stored) return res.status(404).json(PROFILE_NOT_FOUND);
    filter.profileId = stored;
  }
  if (unread === "true") filter.readAt = null;
  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
  ]);
  return res.json({ notifications: notifications.map(view), page, limit, total, hasMore: page * limit < total });
}));

router.get("/unread-count", readLimiter, asyncRoute(async (req, res) => {
  res.json({ count: await Notification.countDocuments({ owner: req.userId, readAt: null }) });
}));

router.get("/preferences", readLimiter, asyncRoute(async (req, res) => {
  const user = await User.findById(req.userId).select("mutedNotificationTypes");
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  return res.json({ preferences: preferencesView(user) });
}));

// Body: { "<type>": true | false, ... } for any of the types. Safety-critical types can only be true.
router.put("/preferences", writeLimiter, asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length) return res.status(400).json({ error: "Choose which notifications you want." });
  for (const [type, enabled] of Object.entries(body)) {
    if (!TYPES.includes(type)) return res.status(400).json({ error: "Unknown notification type." });
    if (typeof enabled !== "boolean") return res.status(400).json({ error: "Each notification setting must be on or off." });
    if (SAFETY_TYPES.includes(type) && !enabled) return res.status(400).json({ error: "Emergency and urgent caregiver alerts are always on." });
  }
  const user = await User.findById(req.userId).select("mutedNotificationTypes");
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  const muted = new Set(user.mutedNotificationTypes);
  for (const [type, enabled] of Object.entries(body)) {
    if (SAFETY_TYPES.includes(type)) continue;
    if (enabled) muted.delete(type); else muted.add(type);
  }
  user.mutedNotificationTypes = [...muted];
  await user.save();
  return res.json({ preferences: preferencesView(user) });
}));

router.post("/read-all", writeLimiter, asyncRoute(async (req, res) => {
  const result = await Notification.updateMany({ owner: req.userId, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ updated: result.modifiedCount });
}));

router.post("/:id/read", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req);
  if (!filter) return res.status(404).json(NOT_FOUND);
  // Keeps the first time it was read.
  const notification = await Notification.findOneAndUpdate({ ...filter, readAt: null }, { $set: { readAt: new Date() } }, { new: true })
    || await Notification.findOne(filter);
  if (!notification) return res.status(404).json(NOT_FOUND);
  return res.json({ notification: view(notification) });
}));

router.delete("/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req);
  if (!filter) return res.status(404).json(NOT_FOUND);
  const result = await Notification.deleteOne(filter);
  if (!result.deletedCount) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}));

module.exports = router;

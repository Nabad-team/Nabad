const express = require("express");
const rateLimit = require("../rateLimit");
const mongoose = require("mongoose");
const VitalReading = require("../models/VitalReading");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(requireAuth, resolveProfile);

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, keyGenerator: req => req.userId, message: { error: "Too many changes in a short time. Please wait and try again." } });
const scope = req => ({ owner: req.userId, profileId: req.profileId });
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

function readBody(body = {}) {
  const hasPressure = body.systolic !== undefined || body.diastolic !== undefined;
  if (hasPressure && (!whole(body.systolic, 50, 300) || !whole(body.diastolic, 30, 200) || body.systolic <= body.diastolic)) {
    return { error: "Enter blood pressure as whole numbers, with systolic 50–300 and higher than diastolic 30–200." };
  }
  if (body.heartRate !== undefined && !whole(body.heartRate, 20, 250)) return { error: "Enter a heart rate from 20 to 250 beats per minute." };
  if (body.temperature !== undefined && (typeof body.temperature !== "number" || !Number.isFinite(body.temperature) || body.temperature < 30 || body.temperature > 45)) return { error: "Enter a temperature from 30 to 45°C." };
  if (!hasPressure && body.heartRate === undefined && body.temperature === undefined) return { error: "Enter at least one vital reading." };
  const recordedAt = new Date(body.recordedAt);
  if (typeof body.recordedAt !== "string" || !Number.isFinite(recordedAt.getTime()) || recordedAt > new Date(Date.now() + 5 * 60 * 1000) || recordedAt < new Date(Date.now() - 366 * 86400000)) {
    return { error: "Choose a date and time within the past year, up to now." };
  }
  return { value: {
    recordedAt,
    ...(hasPressure ? { systolic: body.systolic, diastolic: body.diastolic } : {}),
    ...(body.heartRate !== undefined ? { heartRate: body.heartRate } : {}),
    ...(body.temperature !== undefined ? { temperature: Math.round(body.temperature * 10) / 10 } : {}),
  } };
}

const view = item => ({ id: String(item._id), recordedAt: item.recordedAt.toISOString(), systolic: item.systolic ?? null, diastolic: item.diastolic ?? null, heartRate: item.heartRate ?? null, temperature: item.temperature ?? null });

router.post("/", limiter, asyncRoute(async (req, res) => {
  const { value, error } = readBody(req.body);
  if (error) return res.status(400).json({ error });
  const item = await VitalReading.create({ ...scope(req), ...value });
  return res.status(201).json({ reading: view(item) });
}));

router.get("/", asyncRoute(async (req, res) => {
  const range = req.query.range || "30";
  if (!["7", "30", "all"].includes(range)) return res.status(400).json({ error: "Choose a 7 day, 30 day or all-time range." });
  const filter = scope(req);
  if (range !== "all") filter.recordedAt = { $gte: new Date(Date.now() - Number(range) * 86400000) };
  const items = await VitalReading.find(filter).sort({ recordedAt: -1, _id: -1 }).limit(1000);
  return res.json({ readings: items.map(view) });
}));

router.delete("/:id", limiter, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Reading not found." });
  const result = await VitalReading.deleteOne({ ...scope(req), _id: req.params.id });
  if (!result.deletedCount) return res.status(404).json({ error: "Reading not found." });
  return res.status(204).end();
}));

module.exports = router;
module.exports.readBody = readBody;

const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Appointment = require("../models/Appointment");
const { REMINDER_MINUTES, LIMITS } = Appointment;
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile, profileView } = require("../middleware/profileAccess");
const { reminderSchedule, validTimeZone } = require("../appointmentReminders");

const router = express.Router();
router.use(requireAuth, resolveProfile);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, keyGenerator: (req) => req.userId, message: { error: "Too many changes in a short time. Please wait a few minutes and try again." } });
const NOT_FOUND = { error: "Appointment not found." };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
function readText(body, field, label, errors, required = false) {
  const value = body[field];
  if (value === undefined || value === null) {
    if (required) errors.push(`Enter the ${label.toLowerCase()}.`);
    return "";
  }
  if (typeof value !== "string") { errors.push(`${label} must be text.`); return ""; }
  const text = value.trim();
  if (required && !text) errors.push(`Enter the ${label.toLowerCase()}.`);
  if (text.length > LIMITS[field]) errors.push(`${label} must be ${LIMITS[field]} characters or fewer.`);
  return text;
}
function readAppointment(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const errors = [];
  const title = readText(body, "title", "Appointment title", errors, true);
  const hospital = readText(body, "hospital", "Hospital", errors, true);
  const location = readText(body, "location", "Location", errors);
  const notes = readText(body, "notes", "Notes", errors);
  const appointmentDate = body.appointmentDate;
  const appointmentTime = body.appointmentTime;
  if (typeof appointmentDate !== "string" || !datePattern.test(appointmentDate)) errors.push("Enter a valid appointment date.");
  else {
    const date = new Date(`${appointmentDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== appointmentDate) errors.push("Enter a valid appointment date.");
  }
  if (typeof appointmentTime !== "string" || !timePattern.test(appointmentTime) || Number(appointmentTime.slice(0, 2)) > 23 || Number(appointmentTime.slice(3)) > 59) errors.push("Enter a valid appointment time.");
  const reminderMinutes = body.reminderMinutes === undefined ? 60 : Number(body.reminderMinutes);
  if (!REMINDER_MINUTES.includes(reminderMinutes)) errors.push("Choose a valid reminder time.");
  // The browser's IANA time zone (for example "Asia/Beirut"), so the server-side reminder fires at the right moment.
  if (body.timeZone !== undefined && !validTimeZone(body.timeZone)) errors.push("Choose a valid time zone.");
  if (errors.length) return { error: errors[0] };
  return { appointment: { title, hospital, location, appointmentDate, appointmentTime, reminderMinutes, notes }, timeZone: body.timeZone };
}
const view = (appointment) => ({
  id: String(appointment._id), profileId: profileView(appointment),
  title: appointment.title, hospital: appointment.hospital, location: appointment.location,
  appointmentDate: appointment.appointmentDate, appointmentTime: appointment.appointmentTime,
  reminderMinutes: appointment.reminderMinutes, notes: appointment.notes,
  createdAt: appointment.createdAt, updatedAt: appointment.updatedAt,
});
const ownedFilter = (req) => mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id, owner: req.userId, profileId: req.profileId } : null;

router.get("/", asyncRoute(async (req, res) => {
  const appointments = await Appointment.find({ owner: req.userId, profileId: req.profileId })
    .sort({ appointmentDate: 1, appointmentTime: 1, _id: 1 });
  res.json({ appointments: appointments.map(view) });
}));
router.post("/", writeLimiter, asyncRoute(async (req, res) => {
  const { appointment, timeZone, error } = readAppointment(req.body);
  if (error) return res.status(400).json({ error });
  const created = await Appointment.create({ ...appointment, ...reminderSchedule({ ...appointment, timeZone }), owner: req.userId, profileId: req.profileId });
  return res.status(201).json({ appointment: view(created) });
}));
router.put("/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req);
  if (!filter) return res.status(404).json(NOT_FOUND);
  const { appointment, timeZone, error } = readAppointment(req.body);
  if (error) return res.status(400).json({ error });
  // Without a time zone in the request, the one saved with the appointment is kept.
  const zone = timeZone ?? (await Appointment.findOne(filter).select("timeZone"))?.timeZone;
  const updated = await Appointment.findOneAndUpdate(filter, { $set: { ...appointment, ...reminderSchedule({ ...appointment, timeZone: zone }) } }, { new: true, runValidators: true });
  if (!updated) return res.status(404).json(NOT_FOUND);
  return res.json({ appointment: view(updated) });
}));
router.delete("/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req);
  if (!filter) return res.status(404).json(NOT_FOUND);
  const result = await Appointment.deleteOne(filter);
  if (!result.deletedCount) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}));

module.exports = router;

const mongoose = require("mongoose");

const REMINDER_MINUTES = [0, 15, 30, 60, 1440];
const LIMITS = { title: 120, hospital: 120, location: 200, notes: 1000 };

const appointmentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: LIMITS.title },
  hospital: { type: String, required: true, trim: true, maxlength: LIMITS.hospital },
  location: { type: String, trim: true, maxlength: LIMITS.location, default: "" },
  appointmentDate: { type: String, required: true },
  appointmentTime: { type: String, required: true },
  reminderMinutes: { type: Number, enum: REMINDER_MINUTES, default: 60 },
  notes: { type: String, trim: true, maxlength: LIMITS.notes, default: "" },
  // For the server-side reminder (appointmentReminders.js). appointmentDate and appointmentTime are the user's local
  // time in timeZone (sent by their browser); startsAt and remindAt are the same moments as dates, worked out on save.
  // reminderNotified is set once the reminder job has handled this schedule, and cleared by every edit.
  timeZone: { type: String, default: null },
  startsAt: { type: Date, default: null },
  remindAt: { type: Date, default: null },
  reminderNotified: { type: Boolean, default: false },
}, { timestamps: true });

appointmentSchema.index({ owner: 1, profileId: 1, appointmentDate: 1, appointmentTime: 1 });
appointmentSchema.index({ remindAt: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
module.exports.REMINDER_MINUTES = REMINDER_MINUTES;
module.exports.LIMITS = LIMITS;

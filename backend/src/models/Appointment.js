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
}, { timestamps: true });

appointmentSchema.index({ owner: 1, profileId: 1, appointmentDate: 1, appointmentTime: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
module.exports.REMINDER_MINUTES = REMINDER_MINUTES;
module.exports.LIMITS = LIMITS;

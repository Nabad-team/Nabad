const mongoose = require("mongoose");

// Water and sleep tracking, per profile like medications: owner is the account, profileId is whose
// entry it is (the owner's own profile, stored as the user id, or one of their linked profiles).
// Days are stored as UTC midnight of the user's local calendar date ("YYYY-MM-DD" in the API).

const LIMITS = { glasses: 30, target: 30, hours: 24, note: 200 };
const owned = {
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
};

// Glasses of water for one day. One entry per profile per day (unique index).
const hydrationSchema = new mongoose.Schema({
  ...owned,
  date: { type: Date, required: true },
  glasses: { type: Number, required: true, min: 0, max: LIMITS.glasses, validate: Number.isInteger },
}, { timestamps: true });
hydrationSchema.index({ owner: 1, profileId: 1, date: 1 }, { unique: true });

// Sleep, logged for the morning after (date). One entry per profile per day (unique index).
const sleepSchema = new mongoose.Schema({
  ...owned,
  date: { type: Date, required: true },
  hours: { type: Number, required: true, min: 0, max: LIMITS.hours, validate: (value) => Number.isInteger(value * 2) },
  quality: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  note: { type: String, trim: true, maxlength: LIMITS.note, default: "" },
}, { timestamps: true });
sleepSchema.index({ owner: 1, profileId: 1, date: 1 }, { unique: true });

// Per-profile settings. waterTarget is null unless the user sets one: there is never a default,
// because some patients must limit how much they drink.
const settingsSchema = new mongoose.Schema({
  ...owned,
  waterTarget: { type: Number, default: null, min: 1, max: LIMITS.target },
}, { timestamps: true });
settingsSchema.index({ owner: 1, profileId: 1 }, { unique: true });

module.exports = {
  HydrationEntry: mongoose.model("HydrationEntry", hydrationSchema),
  SleepEntry: mongoose.model("SleepEntry", sleepSchema),
  WellbeingSettings: mongoose.model("WellbeingSettings", settingsSchema),
  LIMITS,
};

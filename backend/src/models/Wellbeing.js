const mongoose = require("mongoose");

// Water and sleep tracking, per profile like medications: owner is the account, profileId is whose
// entry it is (the owner's own profile, stored as the user id, or one of their linked profiles).
// Days are stored as UTC midnight of the user's local calendar date ("YYYY-MM-DD" in the API).

// Fluids are in millilitres. entryMl: one drink. dayMl and entries: the most one day records.
// goalMl: the range for a daily goal or limit. hours and note: one night's sleep.
const LIMITS = { entryMl: [10, 2000], dayMl: 10000, entries: 60, goalMl: [100, 10000], hours: 24, note: 200 };
const GOAL_TYPES = ["atLeast", "atMost"]; // "Drink at least" / "Stay under" (for people on fluid restriction)
const GLASS_ML = 250; // what one glass was worth before fluids were stored in millilitres (see migrations/fluidsInMl.js)
const owned = {
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
};
const wholeNumber = { validator: Number.isInteger, message: "must be a whole number" };

// One drink: how much, and when it was logged.
const fluidSchema = new mongoose.Schema({
  ml: { type: Number, required: true, min: LIMITS.entryMl[0], max: LIMITS.dayMl, validate: wholeNumber },
  at: { type: Date, required: true },
}, { _id: false });

// Fluids for one day: every drink in the order logged, and their total (kept in step by each update, so the daily
// cap can be checked atomically). One entry per profile per day (unique index).
const hydrationSchema = new mongoose.Schema({
  ...owned,
  date: { type: Date, required: true },
  totalMl: { type: Number, default: 0, min: 0, max: LIMITS.dayMl },
  entries: { type: [fluidSchema], default: [] },
}, { timestamps: true });
hydrationSchema.index({ owner: 1, profileId: 1, date: 1 }, { unique: true });

// Sleep, logged for the morning after (date). hours is entered directly, or worked out from bedtime and
// wakeTime ("HH:MM", both or neither), to two decimals. One entry per profile per day (unique index).
const sleepSchema = new mongoose.Schema({
  ...owned,
  date: { type: Date, required: true },
  hours: { type: Number, required: true, min: 0, max: LIMITS.hours, validate: (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 },
  bedtime: { type: String, default: null, match: /^\d{2}:\d{2}$/ },
  wakeTime: { type: String, default: null, match: /^\d{2}:\d{2}$/ },
  quality: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  note: { type: String, trim: true, maxlength: LIMITS.note, default: "" },
}, { timestamps: true });
sleepSchema.index({ owner: 1, profileId: 1, date: 1 }, { unique: true });

// Per-profile settings. waterGoal is null unless the user sets one: there is never a default,
// because some patients must limit how much they drink.
const settingsSchema = new mongoose.Schema({
  ...owned,
  waterGoal: {
    type: new mongoose.Schema({
      type: { type: String, enum: GOAL_TYPES, required: true },
      ml: { type: Number, required: true, min: LIMITS.goalMl[0], max: LIMITS.goalMl[1], validate: wholeNumber },
    }, { _id: false }),
    default: null,
  },
}, { timestamps: true });
settingsSchema.index({ owner: 1, profileId: 1 }, { unique: true });

module.exports = {
  HydrationEntry: mongoose.model("HydrationEntry", hydrationSchema),
  SleepEntry: mongoose.model("SleepEntry", sleepSchema),
  WellbeingSettings: mongoose.model("WellbeingSettings", settingsSchema),
  LIMITS, GOAL_TYPES, GLASS_ML,
};

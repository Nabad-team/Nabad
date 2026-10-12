const mongoose = require("mongoose");

// One piece of someone's health information on "My health" (sex, a condition, an allergy...), per profile like
// medications: owner is the account, profileId is whose fact it is (the owner's own profile, stored as the user id,
// or one of their linked profiles).
// Every fact has the same shape whatever its category, so facts from other sources plug in without a redesign:
//   source: who it came from. "user" (you added it) today; later "lab_report" or "symptom_check".
//   status: "confirmed" facts are used for guidance. "suggested" ones (from a lab report, later) wait for the user
//           to confirm or dismiss them, and are never used until confirmed.
//   recordedAt: when it was first recorded. updatedAt (timestamps): when it last changed.
// The value's shape depends on the category; routes/healthProfile.js checks it (readValue).

const CATEGORIES = ["sex", "height", "weight", "bloodType", "pregnancy", "condition", "allergy", "smoking"];
// Categories with at most one confirmed fact per profile (the rest are lists).
const SINGLE_CATEGORIES = ["sex", "height", "weight", "bloodType", "pregnancy", "smoking"];
const SOURCES = ["user", "lab_report", "symptom_check"];
const STATUSES = ["confirmed", "suggested"];

const healthFactSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  category: { type: String, enum: CATEGORIES, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  source: { type: String, enum: SOURCES, required: true, default: "user" },
  status: { type: String, enum: STATUSES, required: true, default: "confirmed" },
  recordedAt: { type: Date, required: true, default: Date.now },
  // What may exist only once per profile among confirmed facts: the category for single categories ("sex"),
  // "condition:<code>" for a listed condition. Unset for allergies and "other" conditions, which can repeat.
  slot: { type: String, default: undefined },
}, { timestamps: true });

healthFactSchema.index({ owner: 1, profileId: 1, status: 1, category: 1 });
// Two tabs saving the same thing at the same moment can't create a duplicate.
healthFactSchema.index({ owner: 1, profileId: 1, slot: 1 }, { unique: true, partialFilterExpression: { slot: { $exists: true }, status: "confirmed" } });

module.exports = mongoose.model("HealthFact", healthFactSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.SINGLE_CATEGORIES = SINGLE_CATEGORIES;
module.exports.SOURCES = SOURCES;
module.exports.STATUSES = STATUSES;

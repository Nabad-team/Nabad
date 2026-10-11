const mongoose = require("mongoose");

// One medication on someone's list (stories #44, #46, #47).
// owner is the account that manages it. profileId is whose medication it is: for now always the owner's own
// profile (the user id), later also one of their linked profiles (#48), with no change to this schema.
const FORMS = ["tablet", "syrup", "injection", "inhaler", "drops", "other"];
const STATUSES = ["active", "discontinued"];
const LIMITS = { name: 100, dose: 40, unit: 20, frequency: 100, notes: 1000 };

const medicationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: LIMITS.name },
  dose: { type: String, trim: true, maxlength: LIMITS.dose, default: "" },
  unit: { type: String, trim: true, maxlength: LIMITS.unit, default: "" },
  form: { type: String, enum: FORMS, default: "tablet" },
  frequency: { type: String, trim: true, maxlength: LIMITS.frequency, default: "" },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  status: { type: String, enum: STATUSES, default: "active" },
  notes: { type: String, trim: true, maxlength: LIMITS.notes, default: "" },
}, { timestamps: true });

// Every query filters by owner and profile; the list then sorts by status and newest first.
medicationSchema.index({ owner: 1, profileId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Medication", medicationSchema);
module.exports.FORMS = FORMS;
module.exports.STATUSES = STATUSES;
module.exports.LIMITS = LIMITS;

const mongoose = require("mongoose");

// One daily check-in per medication and profile. This records a user's confirmation for that day;
// it does not infer dose times or replace the prescribing clinician's instructions.
const medicationAdherenceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  medicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  takenAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

medicationAdherenceSchema.index({ owner: 1, profileId: 1, medicationId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("MedicationAdherence", medicationAdherenceSchema);

const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true, maxlength: 100 },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
  uploadedAt: { type: Date, default: Date.now, required: true },
}, { _id: false });

const profileCoverageSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  hasInsurance: { type: Boolean, default: false, required: true },
  hasNssf: { type: Boolean, default: false, required: true },
  patientId: { type: documentSchema, default: null },
  insuranceCard: { type: documentSchema, default: null },
  nssfDocument: { type: documentSchema, default: null },
}, { timestamps: true });

profileCoverageSchema.index({ owner: 1, profileId: 1 }, { unique: true });

module.exports = mongoose.model("ProfileCoverage", profileCoverageSchema);

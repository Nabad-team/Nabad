const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  text: { type: String, required: true, maxlength: 30000 },
}, { _id: false });

const shareSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  patientName: { type: String, required: true, maxlength: 200 },
  sections: { type: [sectionSchema], required: true },
  documentIds: [{ type: mongoose.Schema.Types.ObjectId }],
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  lastViewedAt: { type: Date, default: null },
  viewCount: { type: Number, default: 0, min: 0 },
  confirmedAt: { type: Date, default: null },
  confirmedBy: { type: String, default: "", maxlength: 120 },
}, { timestamps: true });

shareSchema.index({ owner: 1, profileId: 1, createdAt: -1 });
shareSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("VisitPrepShare", shareSchema);

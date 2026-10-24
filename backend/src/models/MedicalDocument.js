const mongoose = require("mongoose");

const medicalDocumentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true, maxlength: 100 },
  documentType: { type: String, enum: ["imaging", "lab", "letter", "other"], default: "other", required: true },
  documentDate: { type: Date, default: null },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true });

medicalDocumentSchema.index({ owner: 1, profileId: 1, createdAt: -1 });

module.exports = mongoose.model("MedicalDocument", medicalDocumentSchema);

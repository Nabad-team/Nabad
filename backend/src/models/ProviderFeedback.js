const mongoose = require("mongoose");
// One current visit review per account and canonical facility. No public author identity.
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  providerSlug: { type: String, required: true, match: /^[a-z0-9-]+$/ },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  visitDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  note: { type: String, default: "", maxlength: 1000 },
  waitLevel: { type: String, enum: ["short", "moderate", "long", null], default: null },
  waitReportedAt: { type: Date, default: null },
}, { timestamps: true, strict: "throw" });
schema.index({ owner: 1, providerSlug: 1 }, { unique: true });
schema.index({ providerSlug: 1, waitReportedAt: -1 });
module.exports = mongoose.model("ProviderFeedback", schema);

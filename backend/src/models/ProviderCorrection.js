const mongoose = require("mongoose");
// Suggestions are private and never overwrite the verified directory automatically.
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  providerSlug: { type: String, required: true, match: /^[a-z0-9-]+$/ },
  field: { type: String, required: true, enum: ["name", "location", "phone", "hours", "insurance", "services", "other"] },
  details: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ["pending", "reviewed"], default: "pending" },
}, { timestamps: true, strict: "throw" });
schema.index({ owner: 1, providerSlug: 1, field: 1 }, { unique: true });
schema.index({ status: 1, updatedAt: -1 });
module.exports = mongoose.model("ProviderCorrection", schema);

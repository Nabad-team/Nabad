const mongoose = require("mongoose");
// Anonymous aggregates only: no identifiers, symptoms, urgency levels, IPs or cookies.
const schema = new mongoose.Schema({
  _id: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  assessments: { type: Number, min: 0, default: 0 },
  sessionsStarted: { type: Number, min: 0, default: 0 },
  followupAssessments: { type: Number, min: 0, default: 0 },
  expiresAt: { type: Date, required: true },
}, { strict: "throw", versionKey: false, bufferCommands: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("UsageDaily", schema);

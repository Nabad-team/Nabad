const mongoose = require("mongoose");
// Per-account daily AI limits (dailyAiLimits.js). Counts only: which account, which Beirut day, how many times each
// AI feature was used. Never a question, symptom, file, answer or profile id. Deleted automatically after 2 days.
const count = { type: Number, min: 0, default: 0 };
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  symptomChecks: count,
  assistantMessages: count,
  historyQuestions: count,
  prescriptionReads: count,
  reportAnalyses: count,
  // Follow-up rounds left for today's symptom checks: a check and its follow-up questions count as one.
  freeFollowUps: count,
  expiresAt: { type: Date, required: true },
}, { strict: "throw", versionKey: false, bufferCommands: false });
schema.index({ owner: 1, day: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("AiUsageDaily", schema);

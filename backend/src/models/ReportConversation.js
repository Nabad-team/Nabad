const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true, maxlength: 4000 },
  evidence: { type: [String], default: [] },
  citations: { type: [new mongoose.Schema({
    // version/reviewExpiresAt are optional only for conversations saved before
    // versioned citations were introduced. Every newly retrieved source has both.
    id: { type: String, required: true }, version: { type: String }, title: { type: String, required: true }, sourceUrl: { type: String, required: true },
    publisher: { type: String, required: true }, reviewedAt: { type: String, required: true }, reviewExpiresAt: { type: String },
  }, { _id: false })], default: [] },
  disclaimer: { type: String, default: "" },
}, { _id: false });

const reportConversationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, maxlength: 120 },
  messages: { type: [messageSchema], default: [] },
  reportResult: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

reportConversationSchema.index({ owner: 1, profileId: 1, updatedAt: -1 });

module.exports = mongoose.model("ReportConversation", reportConversationSchema);

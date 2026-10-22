const mongoose = require("mongoose");
const validator = require("validator");

// One person in someone's care circle (careCircle.js). The inviter is the account being looked after; the member is
// the caregiver's account. It starts as a pending invitation to an email address and becomes active when someone
// signed in with that email accepts it. Any account can invite and be invited, and be in several circles.
// Members are only ever told that a symptom check needs attention, never what it was about.
const STATUSES = ["pending", "active"];
const MAX_MEMBERS = 5;
const INVITE_DAYS = 7;

const careCircleSchema = new mongoose.Schema({
  inviter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  status: { type: String, enum: STATUSES, default: "pending" },
  inviteEmail: { type: String, required: true, lowercase: true, trim: true, validate: { validator: (value) => validator.isEmail(value), message: "Please provide a valid email." } },
  // SHA-256 of the one-time token in the emailed link, never the token. Removed when the invitation is accepted.
  inviteTokenHash: { type: String, default: undefined },
  // While pending only: MongoDB deletes the invitation once it has expired. Removed when accepted.
  expiresAt: { type: Date, default: undefined },
  acceptedAt: { type: Date, default: null },
}, { timestamps: true });

careCircleSchema.index({ inviter: 1, status: 1 });
careCircleSchema.index({ member: 1, status: 1 });
// Re-inviting the same address replaces the pending invitation; nobody is in the same circle twice.
careCircleSchema.index({ inviter: 1, inviteEmail: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
careCircleSchema.index({ inviter: 1, member: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
careCircleSchema.index({ inviteTokenHash: 1 }, { unique: true, partialFilterExpression: { inviteTokenHash: { $type: "string" } } });
careCircleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("CareCircle", careCircleSchema);
module.exports.STATUSES = STATUSES;
module.exports.MAX_MEMBERS = MAX_MEMBERS;
module.exports.INVITE_DAYS = INVITE_DAYS;

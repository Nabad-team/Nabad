const mongoose = require("mongoose");

// In-app notifications (see notifications.js: notify() is the only way to create one). Per profile like health data:
// owner is the account, profileId whose notification it is (the owner's own profile, stored as the user id, or one
// of their linked profiles). Only a short title and message are stored, never symptom text or other health details.
const TYPES = ["appointment_reminder", "emergency_alert", "caregiver_urgent", "document_ready", "system"];
// Safety-critical types are always on: preferences can't turn them off.
const SAFETY_TYPES = ["emergency_alert", "caregiver_urgent"];
const MUTABLE_TYPES = TYPES.filter((type) => !SAFETY_TYPES.includes(type));
const LIMITS = { title: 80, message: 200, link: 200, dedupeKey: 200 };
const RETENTION_DAYS = 90;

const notificationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: TYPES, required: true },
  title: { type: String, required: true, trim: true, maxlength: LIMITS.title },
  message: { type: String, required: true, trim: true, maxlength: LIMITS.message },
  // A page inside Nabad, such as "/appointments". Never an outside address.
  link: { type: String, default: "", maxlength: LIMITS.link, match: /^(\/(?!\/)[\w\-./?=&#%]*)?$/ },
  readAt: { type: Date, default: null },
  // The same event always gives the same key, so it can never be notified twice (unique per account).
  dedupeKey: { type: String, required: true, maxlength: LIMITS.dedupeKey },
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ owner: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ owner: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ owner: 1, readAt: 1 });
// MongoDB removes each notification 90 days after it was created.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.TYPES = TYPES;
module.exports.SAFETY_TYPES = SAFETY_TYPES;
module.exports.MUTABLE_TYPES = MUTABLE_TYPES;
module.exports.LIMITS = LIMITS;
module.exports.RETENTION_DAYS = RETENTION_DAYS;

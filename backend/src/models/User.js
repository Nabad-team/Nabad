const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    authVersion: { type: Number, default: 0 },

    // --- Login security (Task 4) ---
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // --- Password reset (Task 3) — fields ready to use ---
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // --- Two-factor auth (Task 2) — fields ready to use ---
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null }, // AES-GCM encrypted with TOTP_ENCRYPTION_KEY
    twoFactorTempTokenHash: { type: String, default: null },
    twoFactorTempExpires: { type: Date, default: null },
    twoFactorPendingSecret: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

module.exports = mongoose.model("User", userSchema);


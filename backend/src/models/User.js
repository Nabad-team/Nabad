const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: { validator: (value) => validator.isEmail(value), message: "Please provide a valid email." },
    },
    passwordHash: { type: String, required: true },
    authProvider: { type: String, enum: ["password", "google"], default: "password" },
    googleId: { type: String },
    authVersion: { type: Number, default: 0 },
    onboardingCompleted: { type: Boolean, default: false },

    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorCodeHash: { type: String, default: null },
    twoFactorCodeExpires: { type: Date, default: null },
    twoFactorCodeAttempts: { type: Number, default: 0 },
    twoFactorCodeLastSent: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique only among users that actually have a Google ID, so any number of
// email/password users (no googleId) can exist.
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: "string" } } });

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");
const validator = require("validator");
const { contactSchema, normalizePhone, validPhone } = require("./contactSchema");

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
    // Sparse unique indexes skip absent fields, but not explicit null values.
    googleId: { type: String, unique: true, sparse: true, default: undefined },
    emergencyContact: { type: contactSchema, default: undefined },
    // Editable on the profile page. An empty phone or null date means "not set".
    phone: { type: String, default: "", set: normalizePhone, validate: { validator: (value) => value === "" || validPhone(value), message: "Invalid phone." } },
    dateOfBirth: { type: Date, default: null, validate: { validator: (date) => date === null || date <= new Date(), message: "Date of birth cannot be in the future." } },
    profilePicture: { type: String, default: "" },
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

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

module.exports = mongoose.model("User", userSchema);

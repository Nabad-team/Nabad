const mongoose = require("mongoose");
const { contactSchema } = require("./contactSchema");
// Schema foundation for the linked-profile API owned by the profiles teammate.
const linkedProfileSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  fullName: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  dateOfBirth: { type: Date, required: true, validate: { validator: (date) => date <= new Date(), message: "Date of birth cannot be in the future." } },
  relationship: { type: String, enum: ["child", "parent", "spouse", "other"], required: true },
  profilePicture: { type: String, default: "" },
  emergencyContact: { type: contactSchema, default: undefined },
}, { timestamps: true });
module.exports = mongoose.model("LinkedProfile", linkedProfileSchema);

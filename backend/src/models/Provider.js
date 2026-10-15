const mongoose = require("mongoose");

const interval = new mongoose.Schema({
  day: { type: Number, required: true, min: 0, max: 6, validate: Number.isInteger },
  start: { type: Number, required: true, min: 0, max: 1439, validate: Number.isInteger },
  end: { type: Number, required: true, min: 1, max: 1440, validate: Number.isInteger },
}, { _id: false });
interval.pre("validate", function () {
  if (this.start === this.end) this.invalidate("end", "Start and end must differ; use 0–1440 for a full day.");
});
const schema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, match: /^[a-z0-9-]+$/ },
  name: { type: String, required: true, maxlength: 200 },
  type: { type: String, required: true, enum: ["hospital", "clinic"] },
  city: { type: String, required: true },
  address: { type: String, required: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  locationApproximate: { type: Boolean, default: false },
  phone: { type: String, default: "" },
  specialties: { type: [String], default: [] },
  // null = not verified, never infer a closed facility or a non-existent ER.
  emergency24h: { type: Boolean, default: null },
  hoursKnown: { type: Boolean, default: false },
  hours: { type: [interval], default: [] },
  sources: { type: [String], required: true },
  verifiedAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ city: 1, specialties: 1 });
module.exports = mongoose.model("Provider", schema);

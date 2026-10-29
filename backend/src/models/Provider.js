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
  legacySlugs: { type: [String], default: [], validate: values => values.length <= 10 && values.every(value => /^[a-z0-9-]+$/.test(value)) },
  name: { type: String, required: true, maxlength: 200 },
  type: { type: String, required: true, enum: ["hospital", "clinic"] },
  city: { type: String, default: "" },
  district: { type: String, default: "" },
  governorate: { type: String, default: "" },
  address: { type: String, default: "" },
  // A listed facility can be searchable before its map location is verified.
  latitude: { type: Number, default: null, min: -90, max: 90 },
  longitude: { type: Number, default: null, min: -180, max: 180 },
  location: { type: { type: String, enum: ["Point"] }, coordinates: { type: [Number], default: undefined } },
  locationApproximate: { type: Boolean, default: false },
  phone: { type: String, default: "" },
  specialties: { type: [String], default: [] },
  // A positive list of sourced capabilities; absence means unverified, not unavailable.
  services: { type: [String], default: [] },
  insurances: { type: [String], default: [], validate: values => values.length <= 40 && values.every(v => /^[a-z0-9-]+$/.test(v)) },
  insuranceSources: { type: [String], default: [] },
  insuranceVerifiedAt: { type: Date, default: null },
  servicesReviewedAt: { type: Date, default: null },
  serviceSources: { type: [String], default: [] },
  // null = not verified, never infer a closed facility or a non-existent ER.
  emergency24h: { type: Boolean, default: null },
  hoursKnown: { type: Boolean, default: false },
  hours: { type: [interval], default: [] },
  sources: { type: [String], required: true },
  verifiedAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ city: 1, specialties: 1 });
schema.index({ location: "2dsphere" });
schema.index({ name: "text", specialties: "text", services: "text", city: "text" }, { default_language: "english" });
schema.index({ governorate: 1 });
schema.index({ district: 1 });
schema.index({ legacySlugs: 1 });
schema.index({ services: 1 });
schema.index({ insurances: 1 });
schema.pre("validate", function () {
  if (this.insurances.length && (!this.insuranceVerifiedAt || !this.insuranceSources.length || !this.insuranceSources.every(url => /^https:\/\//.test(url)))) this.invalidate("insurances", "Insurance listings require HTTPS sources and a verification date.");
  if (this.legacySlugs.includes(this.slug)) this.invalidate("legacySlugs", "A provider cannot retire its own slug.");
  if ((this.latitude == null) !== (this.longitude == null)) this.invalidate("latitude", "Provide both coordinates or neither.");
  this.location = this.latitude == null || this.longitude == null ? undefined : { type: "Point", coordinates: [this.longitude, this.latitude] };
});
module.exports = mongoose.model("Provider", schema);

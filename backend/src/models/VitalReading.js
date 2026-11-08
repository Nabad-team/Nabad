const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recordedAt: { type: Date, required: true },
  systolic: { type: Number, min: 50, max: 300, validate: Number.isInteger },
  diastolic: { type: Number, min: 30, max: 200, validate: Number.isInteger },
  heartRate: { type: Number, min: 20, max: 250, validate: Number.isInteger },
  temperature: { type: Number, min: 30, max: 45 },
}, { timestamps: true });

schema.index({ owner: 1, profileId: 1, recordedAt: -1 });

module.exports = mongoose.model("VitalReading", schema);

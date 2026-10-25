const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  overrides: {
    background: { type: String, maxlength: 20000 },
    medications: { type: String, maxlength: 20000 },
    symptoms: { type: String, maxlength: 20000 },
  },
  notes: { type: String, default: "", maxlength: 5000 },
  documentIds: [{ type: mongoose.Schema.Types.ObjectId }],
}, { timestamps: true });
schema.index({ owner: 1, profileId: 1 }, { unique: true });
module.exports = mongoose.model("VisitPrep", schema);

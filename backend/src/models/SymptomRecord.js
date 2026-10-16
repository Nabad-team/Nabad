const mongoose = require("mongoose");

// A symptom record belongs to the signed-in account (owner)
// and to either the owner's own profile or one of their linked profiles.
//
// Symptom descriptions are health data and must never be written to logs.

const LIMITS = {
  description: 2000,
};

const symptomRecordSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: LIMITS.description,
    },

    // Stores the urgency result returned by the symptom engine.
    // We keep this flexible because the engine may return several
    // pieces of information such as level, action and timeframe.
    urgencyResult: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Records are always queried by owner and profile.
// Newest records appear first.
symptomRecordSchema.index({
  owner: 1,
  profileId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "SymptomRecord",
  symptomRecordSchema
);

module.exports.LIMITS = LIMITS;
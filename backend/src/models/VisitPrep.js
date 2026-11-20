const mongoose = require("mongoose");

// SCRUM-333: questions the person wants to ask their doctor, saved at any time and shown in the visit sheet,
// the shared doctor link and the printout.
const QUESTION_LIMITS = { text: 300, count: 30 };

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, minlength: 1, maxlength: QUESTION_LIMITS.text },
}, { timestamps: true });

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
  questions: {
    type: [questionSchema], default: [],
    validate: { validator: (values) => values.length <= QUESTION_LIMITS.count, message: "too many questions" },
  },
}, { timestamps: true });
schema.index({ owner: 1, profileId: 1 }, { unique: true });
module.exports = mongoose.model("VisitPrep", schema);
module.exports.QUESTION_LIMITS = QUESTION_LIMITS;

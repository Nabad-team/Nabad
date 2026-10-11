const mongoose = require("mongoose");
const normalizePhone = (value) => typeof value === "string" ? value.replace(/[\s().-]/g, "") : value;
const validPhone = (value) => /^\+[1-9]\d{7,14}$/.test(value) || /^\d{7,8}$/.test(value);
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  phone: { type: String, required: true, set: normalizePhone, validate: { validator: validPhone, message: "Invalid contact phone." } },
}, { _id: false });
module.exports = { contactSchema, normalizePhone, validPhone };

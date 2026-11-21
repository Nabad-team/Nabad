/* Idempotent production-safe demo fixture. Requires an explicit password and only accepts example.invalid. */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");
const HealthFact = require("../src/models/HealthFact");
const Medication = require("../src/models/Medication");
const Appointment = require("../src/models/Appointment");
const VitalReading = require("../src/models/VitalReading");
const { HydrationEntry, SleepEntry, WellbeingSettings } = require("../src/models/Wellbeing");
const { hashPassword } = require("../src/passwordHashing");

const email = (process.env.DEMO_ACCOUNT_EMAIL || "demo@example.invalid").trim().toLowerCase();
const password = process.env.DEMO_ACCOUNT_PASSWORD;
if (!email.endsWith("@example.invalid")) throw new Error("The demo email must use the reserved example.invalid domain.");
if (!password || password.length < 14) throw new Error("Set DEMO_ACCOUNT_PASSWORD to a temporary password of at least 14 characters.");
if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");

const day = (offset) => { const value = new Date(); value.setUTCHours(0, 0, 0, 0); value.setUTCDate(value.getUTCDate() + offset); return value; };
const dateText = (offset) => day(offset).toISOString().slice(0, 10);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate({ email }, { $set: {
    name: "Maya Example", passwordHash, authProvider: "password", emailVerified: true,
    onboardingCompleted: true, gettingStartedHidden: true, dateOfBirth: new Date("1990-06-15T00:00:00.000Z"), phone: "",
  } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  const scope = { owner: user._id, profileId: user._id };
  await Promise.all([
    HealthFact.deleteMany(scope), Medication.deleteMany(scope), Appointment.deleteMany(scope), VitalReading.deleteMany(scope),
    HydrationEntry.deleteMany(scope), SleepEntry.deleteMany(scope), WellbeingSettings.deleteMany(scope),
  ]);
  await HealthFact.create([
    { ...scope, category: "sex", value: "female", source: "user", status: "confirmed", slot: "sex" },
    { ...scope, category: "height", value: 165, source: "user", status: "confirmed", slot: "height" },
    { ...scope, category: "weight", value: 62.5, source: "user", status: "confirmed", slot: "weight" },
    { ...scope, category: "bloodType", value: "unknown", source: "user", status: "confirmed", slot: "bloodType" },
    { ...scope, category: "allergy", value: { type: "food", name: "Sample allergy", reaction: "Example reaction" }, source: "user", status: "confirmed" },
  ]);
  await Medication.create({ ...scope, name: "Example medication", dose: "1", unit: "tablet", form: "tablet", frequency: "Once daily", startDate: day(-30), status: "active" });
  await Appointment.create({ ...scope, title: "Example follow-up", hospital: "Sample Health Centre", location: "Beirut", appointmentDate: dateText(14), appointmentTime: "10:30", reminderMinutes: 60 });
  await VitalReading.create({ ...scope, recordedAt: day(-1), systolic: 118, diastolic: 76, heartRate: 72, temperature: 36.7 });
  await HydrationEntry.create({ ...scope, date: day(0), totalMl: 750, entries: [{ ml: 250, at: new Date() }, { ml: 500, at: new Date() }] });
  await SleepEntry.create({ ...scope, date: day(0), hours: 7.5, bedtime: "23:00", wakeTime: "06:30", quality: 4, note: "Clearly fake sample entry" });
  await WellbeingSettings.create({ ...scope, waterGoal: { type: "atLeast", ml: 2000 } });
  process.stdout.write(`Demo account seeded: ${email}\n`);
})().finally(() => mongoose.disconnect());

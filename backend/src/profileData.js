const Medication = require("./models/Medication");
const { HydrationEntry, SleepEntry, WellbeingSettings } = require("./models/Wellbeing");

// Every kind of health data stored per profile. A new per-profile model goes here, so removing a
// dependent and deleting an account can never leave it behind.
const PROFILE_MODELS = [Medication, HydrationEntry, SleepEntry, WellbeingSettings];

// Deletes the health data of one profile (pass profileId) or of the whole account (all profiles it owns).
async function deleteProfileData(owner, profileId) {
  const filter = profileId === undefined ? { owner } : { owner, profileId };
  await Promise.all(PROFILE_MODELS.map((Model) => Model.deleteMany(filter)));
}

module.exports = { deleteProfileData, PROFILE_MODELS };

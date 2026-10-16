const Medication = require(
  "./models/Medication"
);

const SymptomRecord = require(
  "./models/SymptomRecord"
);

const HealthFact = require(
  "./models/HealthFact"
);

const {
  HydrationEntry,
  SleepEntry,
  WellbeingSettings,
} = require("./models/Wellbeing");

// Every kind of health data stored per profile.
//
// A new per-profile model goes here so removing
// a dependent or deleting an account cannot
// leave its health data behind.

const PROFILE_MODELS = [
  Medication,
  SymptomRecord,
  HydrationEntry,
  SleepEntry,
  WellbeingSettings,
  HealthFact,
];

// Deletes the health data of one profile.
//
// If profileId is not provided,
// all health data owned by the account
// is deleted.

async function deleteProfileData(
  owner,
  profileId
) {
  const filter =
    profileId === undefined
      ? { owner }
      : {
          owner,
          profileId,
        };

  await Promise.all(
    PROFILE_MODELS.map((Model) =>
      Model.deleteMany(filter)
    )
  );
}

module.exports = {
  deleteProfileData,
  PROFILE_MODELS,
};
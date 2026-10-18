const { HydrationEntry, WellbeingSettings, GLASS_ML } = require("../models/Wellbeing");

// Water used to be counted in glasses; it is now stored in millilitres (one glass = 250 ml).
//   A day's { glasses: N } becomes one drink of N × 250 ml, logged at the time the day was last changed, added to
//   anything already logged in millilitres that day.
//   A goal of N glasses becomes "Drink at least N × 250 ml".
// Each document is converted in a single atomic update that also removes the old field, so running this again
// (after a crash halfway, or at every start) finds nothing left to do and changes nothing.
// Runs at startup before the server takes requests (server.js). Returns how many documents it converted.
async function migrateFluidsToMl() {
  const legacyMl = { $multiply: ["$glasses", GLASS_ML] };
  const days = await HydrationEntry.collection.updateMany({ glasses: { $exists: true } }, [
    {
      $set: {
        totalMl: { $add: [{ $ifNull: ["$totalMl", 0] }, legacyMl] },
        entries: {
          $concatArrays: [
            { $cond: [{ $gt: ["$glasses", 0] }, [{ ml: legacyMl, at: { $ifNull: ["$updatedAt", "$date"] } }], []] },
            { $ifNull: ["$entries", []] },
          ],
        },
      },
    },
    { $unset: "glasses" },
  ]);
  const goals = await WellbeingSettings.collection.updateMany({ waterTarget: { $exists: true } }, [
    {
      $set: {
        waterGoal: {
          $cond: [
            { $gt: [{ $ifNull: ["$waterTarget", 0] }, 0] },
            { type: "atLeast", ml: { $multiply: ["$waterTarget", GLASS_ML] } },
            { $ifNull: ["$waterGoal", null] },
          ],
        },
      },
    },
    { $unset: "waterTarget" },
  ]);
  return { days: days.modifiedCount, goals: goals.modifiedCount };
}

module.exports = { migrateFluidsToMl };

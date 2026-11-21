const HealthFact = require("./models/HealthFact");
const User = require("./models/User");
const LinkedProfile = require("./models/LinkedProfile");
const { notify } = require("./notifications");
const { logEvent, errorDetails } = require("./logger");

const COPY = {
  first_document: { title: "Your documents have a home", message: "Your first document is organized and ready when you need it.", link: "/medical-documents" },
  health_basics: { title: "Health basics complete", message: "The five health basics are filled in. You can change them at any time.", link: "/my-health" },
  first_visit_summary: { title: "Your first visit summary is ready", message: "Your visit notes are organized in one place for your appointment.", link: "/visit-prep" },
};

async function milestone(owner, profileId, name) {
  const copy = COPY[name];
  if (!copy) throw new TypeError("Unknown organizational milestone.");
  const key = `${name}:${profileId}`;
  try {
    const claimed = await User.updateOne({ _id: owner, organizationalMilestones: { $ne: key } }, { $addToSet: { organizationalMilestones: key } });
    if (!claimed.modifiedCount) return null;
    return await notify(owner, profileId, "system", { ...copy, dedupeKey: `organizational-milestone:${key}` });
  } catch (error) {
    // The organizing action already succeeded. An optional calm message must never turn that save into a failure.
    logEvent("organizational_milestone_notification_failed", errorDetails(error));
    return null;
  }
}

async function healthBasicsIfComplete(owner, profileId) {
  const profile = String(owner) === String(profileId)
    ? await User.findById(owner).select("dateOfBirth").lean()
    : await LinkedProfile.findOne({ _id: profileId, owner }).select("dateOfBirth").lean();
  if (!profile?.dateOfBirth) return null;
  const categories = await HealthFact.distinct("category", { owner, profileId, status: "confirmed", category: { $in: ["sex", "height", "weight", "bloodType"] } });
  return categories.length === 4 ? milestone(owner, profileId, "health_basics") : null;
}

module.exports = { milestone, healthBasicsIfComplete };

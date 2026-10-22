const mongoose = require("mongoose");
const LinkedProfile = require("../models/LinkedProfile");

const PROFILE_NOT_FOUND = { error: "Profile not found." };

// The shared ownership check. Returns the stored profileId for `requested` ("self" or undefined is the owner's
// own profile, stored as the user id; anything else must be the id of one of the owner's linked profiles),
// or null when it isn't the owner's (another user's dependent, a missing or malformed id).
// Server code may also pass a stored profileId (an ObjectId), which can be the owner's own id.
async function ownedProfileId(owner, requested) {
  const stored = requested instanceof mongoose.Types.ObjectId;
  if (requested === undefined || requested === "self" || (stored && String(requested) === String(owner))) return new mongoose.Types.ObjectId(String(owner));
  if ((typeof requested !== "string" && !stored) || !mongoose.isValidObjectId(requested)) return null;
  const profile = await LinkedProfile.exists({ _id: requested, owner });
  return profile ? profile._id : null;
}

// Whose health data a request is about, from ?profileId=: "self" (the default, stored as the user id)
// or the id of one of the signed-in user's linked profiles. Sets req.profileId.
// Anything else (another user's dependent, a missing or malformed id) answers 404, so ids can't be probed.
// Runs after requireAuth.
async function resolveProfile(req, res, next) {
  try {
    const requested = req.query.profileId;
    if (requested !== undefined && typeof requested !== "string") return res.status(404).json(PROFILE_NOT_FOUND);
    const profileId = await ownedProfileId(req.userId, requested);
    if (!profileId) return res.status(404).json(PROFILE_NOT_FOUND);
    req.profileId = profileId;
    return next();
  } catch (error) { return next(error); }
}

// "self" for the account owner's own profile, otherwise the linked profile's id.
const profileView = (doc) => (String(doc.profileId) === String(doc.owner) ? "self" : String(doc.profileId));

module.exports = { resolveProfile, ownedProfileId, profileView, PROFILE_NOT_FOUND };

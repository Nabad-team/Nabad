const mongoose = require("mongoose");
const LinkedProfile = require("../models/LinkedProfile");

const PROFILE_NOT_FOUND = { error: "Profile not found." };

// Whose health data a request is about, from ?profileId=: "self" (the default, stored as the user id)
// or the id of one of the signed-in user's linked profiles. Sets req.profileId.
// Anything else (another user's dependent, a missing or malformed id) answers 404, so ids can't be probed.
// Runs after requireAuth.
async function resolveProfile(req, res, next) {
  try {
    const requested = req.query.profileId;
    if (requested === undefined || requested === "self") {
      req.profileId = new mongoose.Types.ObjectId(req.userId);
      return next();
    }
    if (typeof requested !== "string" || !mongoose.isValidObjectId(requested)) return res.status(404).json(PROFILE_NOT_FOUND);
    const profile = await LinkedProfile.exists({ _id: requested, owner: req.userId });
    if (!profile) return res.status(404).json(PROFILE_NOT_FOUND);
    req.profileId = profile._id;
    return next();
  } catch (error) { return next(error); }
}

// "self" for the account owner's own profile, otherwise the linked profile's id.
const profileView = (doc) => (String(doc.profileId) === String(doc.owner) ? "self" : String(doc.profileId));

module.exports = { resolveProfile, profileView };

const Notification = require("./models/Notification");
const User = require("./models/User");
const { ownedProfileId } = require("./middleware/profileAccess");

const { TYPES, SAFETY_TYPES, MUTABLE_TYPES } = Notification;

// The single way to create a notification. Other features call this, never Notification.create.
//   owner:     the account (user id).
//   profileId: whose notification it is: "self", the owner's id, or one of the owner's linked profiles
//              (checked with the shared ownership check).
//   type:      one of Notification.TYPES.
//   data:      { title, message, link?, dedupeKey }. Keep title and message minimal: who and what, never symptom
//              text or other health details ("Sami's symptom check needs attention"). link is a page in Nabad.
//              The same event must always give the same dedupeKey (for example "appointment:<id>:<start>").
// Returns the new notification, or null when none was created: the user turned the type off (safety types can't
// be), the profile isn't the owner's, the account no longer exists, or the dedupeKey was already used.
// Running it twice for the same event is safe: the unique (owner, dedupeKey) index makes the second call a no-op,
// even when two calls race.
async function notify(owner, profileId, type, data = {}) {
  if (!TYPES.includes(type)) throw new TypeError(`Unknown notification type: ${type}`);
  if (typeof data.dedupeKey !== "string" || !data.dedupeKey) throw new TypeError("A notification needs a dedupeKey.");
  const user = await User.findById(owner).select("mutedNotificationTypes").lean();
  if (!user) return null;
  if (!SAFETY_TYPES.includes(type) && (user.mutedNotificationTypes || []).includes(type)) return null;
  const storedProfileId = await ownedProfileId(owner, profileId);
  if (!storedProfileId) return null;

  const notification = new Notification({
    owner, profileId: storedProfileId, type,
    title: data.title, message: data.message, link: data.link || "", dedupeKey: data.dedupeKey, createdAt: new Date(),
  });
  await notification.validate();
  try {
    const result = await Notification.updateOne(
      { owner: notification.owner, dedupeKey: notification.dedupeKey },
      { $setOnInsert: notification.toObject() },
      { upsert: true }
    );
    return result.upsertedCount ? notification : null;
  } catch (error) {
    // Another call inserted the same key between our check and insert.
    if (error.code === 11000) return null;
    throw error;
  }
}

// The user's in-app preferences: every type with whether it is on, and whether it can be changed.
function preferencesView(user) {
  const muted = user.mutedNotificationTypes || [];
  return TYPES.map((type) => ({ type, enabled: SAFETY_TYPES.includes(type) || !muted.includes(type), alwaysOn: SAFETY_TYPES.includes(type) }));
}

module.exports = { notify, preferencesView, TYPES, SAFETY_TYPES, MUTABLE_TYPES };

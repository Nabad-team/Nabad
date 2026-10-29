const User = require("./models/User");
const LinkedProfile = require("./models/LinkedProfile");
const CareCircle = require("./models/CareCircle");
const Provider = require("./models/Provider");
const Medication = require("./models/Medication");
const MedicationAdherence = require("./models/MedicationAdherence");
const HealthFact = require("./models/HealthFact");
const SymptomRecord = require("./models/SymptomRecord");
const Appointment = require("./models/Appointment");
const ReportConversation = require("./models/ReportConversation");
const Notification = require("./models/Notification");
const MedicalDocument = require("./models/MedicalDocument");
const { HydrationEntry, SleepEntry, WellbeingSettings } = require("./models/Wellbeing");
const { preferencesView } = require("./notifications");

// "Download my data" (story #72): one JSON file of everything Nabad stores about an account.
//
// The export registry. Every model is either exported below or listed in EXCLUDED_MODELS with the reason, and every
// field of an exported model is either in `fields` (database field → name in the file, optionally with a formatter)
// or in `omit` with the reason it never leaves the server. tests/dataExport.test.js fails when a model or a field is
// in neither, so a new feature can't be left out of the export (or leak a secret into it) by accident.
const FORMAT_VERSION = 1;

const id = (value) => String(value);
const base64Data = (value) => {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (value?.buffer && Number.isInteger(value.position)) return Buffer.from(value.buffer).subarray(0, value.position).toString("base64");
  return "";
};
// Calendar dates stored as UTC midnight (date of birth, water and sleep days): "YYYY-MM-DD".
const day = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

// Fields that every collection has, never exported: the owner is always this account, and records are grouped under
// the profile they belong to.
const COMMON_OMIT = {
  __v: "Mongoose's internal document version.",
  owner: "Always this account.",
  profileId: "Records are listed under the profile they belong to.",
};
const TIMESTAMPS = { createdAt: "createdAt", updatedAt: "updatedAt" };

// Health data kept per profile (the account owner's own, or a linked family profile's).
const PROFILE_COLLECTIONS = [
  {
    key: "visitPreparation", model: require("./models/VisitPrep"), single: true,
    fields: { _id: ["id", id], overrides: "overrides", notes: "notes", documentIds: ["documentIds", (values) => values.map(String)], ...TIMESTAMPS },
  },
  {
    key: "medications",
    model: Medication,
    fields: { _id: ["id", id], name: "name", dose: "dose", unit: "unit", form: "form", frequency: "frequency", startDate: "startDate", endDate: "endDate", status: "status", notes: "notes", ...TIMESTAMPS },
  },
  {
    key: "medicationCheckIns",
    model: MedicationAdherence,
    fields: { _id: ["id", id], medicationId: ["medicationId", id], date: "date", takenAt: "takenAt", ...TIMESTAMPS },
  },
  {
    key: "myHealthFacts",
    model: HealthFact,
    fields: { _id: ["id", id], category: "category", value: "value", source: "source", status: "status", recordedAt: "recordedAt", ...TIMESTAMPS },
    omit: { slot: "An internal key that stops the same fact being saved twice; worked out from the category." },
  },
  {
    key: "waterEntries",
    model: HydrationEntry,
    sort: { date: 1 },
    fields: { _id: ["id", id], date: ["date", day], totalMl: "totalMl", entries: "drinks", ...TIMESTAMPS },
  },
  {
    key: "sleepEntries",
    model: SleepEntry,
    sort: { date: 1 },
    fields: { _id: ["id", id], date: ["date", day], hours: "hours", bedtime: "bedtime", wakeTime: "wakeTime", quality: "quality", note: "note", ...TIMESTAMPS },
  },
  {
    key: "waterAndSleepGoals",
    model: WellbeingSettings,
    single: true,
    fields: { waterGoal: "waterGoal", ...TIMESTAMPS },
    omit: { _id: "Internal database id of the settings." },
  },
  {
    key: "symptomRecords",
    model: SymptomRecord,
    fields: { _id: ["id", id], description: "description", urgencyResult: "urgencyResult", conversation: "conversation", ...TIMESTAMPS },
  },
  {
    key: "appointments",
    model: Appointment,
    fields: {
      _id: ["id", id], title: "title", hospital: "hospital", location: "location", appointmentDate: "date", appointmentTime: "time",
      timeZone: "timeZone", reminderMinutes: "reminderMinutesBefore", notes: "notes", ...TIMESTAMPS,
    },
    omit: {
      startsAt: "Worked out from the date, time and time zone, for the reminder job.",
      remindAt: "Worked out from the date, time and reminder, for the reminder job.",
      reminderNotified: "The reminder job's own record that it has sent the reminder.",
    },
  },
  {
    key: "healthAssistantConversations",
    model: ReportConversation,
    fields: { _id: ["id", id], title: "title", messages: "messages", reportResult: "reportResult", ...TIMESTAMPS },
  },
  {
    key: "notifications",
    model: Notification,
    fields: { _id: ["id", id], type: "type", title: "title", message: "message", link: "link", phone: "phone", readAt: "readAt", createdAt: "createdAt" },
    omit: { dedupeKey: "An internal key that stops the same event being notified twice." },
  },
  {
    key: "medicalDocuments",
    model: MedicalDocument,
    select: "+data",
    fields: {
      _id: ["id", id], filename: "filename", mimeType: "mimeType", documentType: "documentType",
      documentDate: ["documentDate", day], size: "size", data: ["dataBase64", base64Data], ...TIMESTAMPS,
    },
  },
];

// The account itself. emergencyContact, favoriteProviders and notificationPreferences are moved to the top level of
// the file (buildExport).
const ACCOUNT = {
  key: "account",
  model: User,
  fields: {
    name: "name", email: "email", phone: "phone", dateOfBirth: ["dateOfBirth", day], authProvider: "signInMethod", emailVerified: "emailVerified",
    profilePicture: "profilePicture", emergencyContact: "emergencyContact", favoriteProviders: "favoriteProviders",
    mutedNotificationTypes: ["notificationPreferences", (muted) => preferencesView({ mutedNotificationTypes: muted || [] }).map(({ type, enabled }) => ({ type, enabled }))],
    ...TIMESTAMPS,
  },
  omit: {
    _id: "Internal database id of the account.",
    passwordHash: "Secret: the password's hash.",
    googleId: "Google's internal id for the account, used only to match Google sign-ins.",
    authVersion: "Internal: changes to sign out every session.",
    onboardingCompleted: "Internal: whether the welcome steps were shown.",
    failedLoginAttempts: "Security internals: sign-in lockout.",
    lockUntil: "Security internals: sign-in lockout.",
    emailVerifyTokenHash: "Secret: hash of the email verification link.",
    emailVerifyExpires: "Security internals: email verification link.",
    emailVerifyLastSent: "Security internals: email verification link.",
    resetPasswordTokenHash: "Secret: hash of the password reset link.",
    resetPasswordExpires: "Security internals: password reset link.",
    twoFactorEnabled: "Two-step verification data.",
    twoFactorCodeHash: "Secret: hash of a sign-in code.",
    twoFactorCodeExpires: "Two-step verification data.",
    twoFactorCodeAttempts: "Two-step verification data.",
    twoFactorCodeLastSent: "Two-step verification data.",
    twoFactorFailedAttempts: "Two-step verification data.",
    twoFactorLockedUntil: "Two-step verification data.",
    twoFactorCodeSends: "Two-step verification data.",
    trustedDevices: "Secret: hashes of remembered-device tokens.",
  },
};

const LINKED_PROFILES = {
  key: "linkedProfiles",
  model: LinkedProfile,
  fields: {
    _id: ["id", id], fullName: "fullName", dateOfBirth: ["dateOfBirth", day], relationship: "relationship",
    profilePicture: "profilePicture", emergencyContact: "emergencyContact", ...TIMESTAMPS,
  },
};

// The people this account invited to its care circle. The circles it belongs to are exported with the inviter's
// name only (circleView in buildExport): never their email or anything else of theirs.
const CARE_CIRCLE = {
  key: "careCircle",
  model: CareCircle,
  fields: {
    status: "status", inviteEmail: "invitedEmail", member: ["member", (member) => (member ? { name: member.name, email: member.email } : null)],
    createdAt: "invitedAt", acceptedAt: "joinedAt", expiresAt: "invitationExpiresAt",
  },
  omit: {
    _id: "Internal database id of the invitation.",
    inviter: "This account.",
    inviteTokenHash: "Secret: hash of the invitation link.",
    updatedAt: "When the record last changed; the invitation and joining dates are exported.",
  },
};

const PROVIDER_CONTRIBUTIONS = [
  { key: "providerFeedback", model: require("./models/ProviderFeedback"),
    fields: { _id: ["id", id], providerSlug: "providerId", rating: "rating", visitDate: "visitDate", note: "note", waitLevel: "waitLevel", waitReportedAt: "waitReportedAt", ...TIMESTAMPS } },
  { key: "providerCorrections", model: require("./models/ProviderCorrection"),
    fields: { _id: ["id", id], providerSlug: "providerId", field: "field", details: "details", status: "status", ...TIMESTAMPS } },
];
const ACCOUNT_COLLECTIONS = [ACCOUNT, LINKED_PROFILES, CARE_CIRCLE, ...PROVIDER_CONTRIBUTIONS];
const EXPORTED = [...ACCOUNT_COLLECTIONS, ...PROFILE_COLLECTIONS];

// Models that hold nothing about any account.
const EXCLUDED_MODELS = {
  UsageDaily: "Anonymous daily service totals contain no account or profile identifiers and cannot be attributed to an individual account.",
  Provider: "The public directory of hospitals and clinics. The account's favorites are exported as favoriteProviders.",
};

function pick(doc, { fields }) {
  const out = {};
  for (const [path, spec] of Object.entries(fields)) {
    const [name, format] = Array.isArray(spec) ? spec : [spec];
    const value = doc[path] === undefined ? null : doc[path];
    out[name] = format ? format(value) : value;
  }
  return out;
}

const SORT = { createdAt: 1, _id: 1 };
const selfView = (user) => ({ id: "self", fullName: user.name, relationship: "self", dateOfBirth: day(user.dateOfBirth) });
const circleView = (entry) => ({ invitedBy: entry.inviter.name, joinedAt: entry.acceptedAt });
const emptyEntry = (profile) => ({ profile, ...Object.fromEntries(PROFILE_COLLECTIONS.map(({ key, single }) => [key, single ? null : []])) });

// Everything stored about the account, as a plain object ready for JSON. Every query filters by this account, so
// nothing of another user's can be in it. Returns null when the account no longer exists.
async function buildExport(userId, now = new Date()) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  const [linked, invited, joined, ...records] = await Promise.all([
    LinkedProfile.find({ owner: user._id }).sort(SORT).lean(),
    CareCircle.find({ inviter: user._id }).sort(SORT).populate("member", "name email").lean(),
    CareCircle.find({ member: user._id, status: "active" }).sort({ acceptedAt: 1, _id: 1 }).populate("inviter", "name").lean(),
    ...PROFILE_COLLECTIONS.map(({ model, sort = SORT, select }) => model.find({ owner: user._id }).sort(sort).select(select || "").lean()),
    ...PROVIDER_CONTRIBUTIONS.map(({ model }) => model.find({ owner: user._id }).sort(SORT).lean()),
  ]);

  const { emergencyContact, favoriteProviders: favorites, notificationPreferences, ...account } = pick(user, ACCOUNT);
  const favoriteProviders = favorites || [];
  const providers = await Provider.find({ slug: { $in: favoriteProviders } }).select("slug name").lean();
  const providerNames = new Map(providers.map((provider) => [provider.slug, provider.name]));

  // One entry per profile, the account owner's first. Records of a profile that no longer exists (it should never
  // happen: removing a profile removes its data) are still the account's, so they are listed too.
  const entries = new Map([
    [String(user._id), emptyEntry(selfView(user))],
    ...linked.map((profile) => [String(profile._id), emptyEntry(pick(profile, LINKED_PROFILES))]),
  ]);
  PROFILE_COLLECTIONS.forEach((collection, index) => {
    for (const doc of records[index]) {
      const key = String(doc.profileId);
      if (!entries.has(key)) entries.set(key, emptyEntry({ id: key, removed: true }));
      const view = pick(doc, collection);
      if (collection.single) entries.get(key)[collection.key] = view;
      else entries.get(key)[collection.key].push(view);
    }
  });

  return {
    format: "Nabad data export",
    formatVersion: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    account,
    emergencyContact,
    notificationPreferences,
    favoriteProviders: favoriteProviders.map((slug) => ({ id: slug, name: providerNames.get(slug) || null })),
    careCircle: {
      peopleIInvited: invited.map((entry) => pick(entry, CARE_CIRCLE)),
      circlesIBelongTo: joined.filter((entry) => entry.inviter).map(circleView),
    },
    profiles: [...entries.values()],
    ...Object.fromEntries(PROVIDER_CONTRIBUTIONS.map((collection, index) =>
      [collection.key, records[PROFILE_COLLECTIONS.length + index].map(row => pick(row, collection))])),
  };
}

module.exports = { buildExport, EXPORTED, PROFILE_COLLECTIONS, ACCOUNT_COLLECTIONS, EXCLUDED_MODELS, COMMON_OMIT, FORMAT_VERSION };

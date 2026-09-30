// In-memory stand-in for lib/profileApi.js, used only by tests.
// It behaves like the backend (same functions, same error messages), so page tests can
// add dependents, save profiles and delete the account without a server.
// Use it in a test file with:
//   jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
// and call resetFakeProfiles() in beforeEach.

export const RELATIONSHIPS = ["child", "parent", "spouse", "other"];
export const MAX_LINKED_PROFILES = 10;

// The demo account's password, for the delete-account tests.
export const FAKE_PASSWORD = "demo1234";

const DEMO_SELF_PROFILE = {
  id: "self",
  fullName: "Demo User",
  dateOfBirth: "",
  relationship: "self",
  isSelf: true,
  email: "demo@nabad.app",
  phone: "",
  profilePicture: "",
  authProvider: "password",
};

let self;
let linked;
let nextId;
let failLoading;
export let accountDeleted;
// How many times the profile was loaded, so tests can check it was not loaded at all.
export let profileLoads;

// Starts every test with the demo user, no dependents and a working "server".
// Pass { authProvider: "google" } (or any other profile fields) to change the account owner.
export function resetFakeProfiles(selfFields = {}) {
  self = { ...DEMO_SELF_PROFILE, ...selfFields };
  linked = [];
  nextId = 1;
  failLoading = false;
  accountDeleted = false;
  profileLoads = 0;
}
resetFakeProfiles();

// Makes loading fail, like a server or network error.
export function failFakeLoading() {
  failLoading = true;
}

function checkSignedIn() {
  if (accountDeleted) {
    throw Object.assign(new Error("Session expired. Please log in again."), { status: 401 });
  }
}

export async function getMyProfile() {
  profileLoads++;
  checkSignedIn();
  if (failLoading) throw new Error("Request failed.");
  return { ...self };
}

export async function updateMyProfile(data) {
  checkSignedIn();
  self = { ...self, fullName: data.fullName, phone: data.phone, dateOfBirth: data.dateOfBirth };
  return { ...self };
}

export async function listLinkedProfiles() {
  checkSignedIn();
  if (failLoading) throw new Error("Request failed.");
  return linked.map((profile) => ({ ...profile }));
}

export async function addLinkedProfile(data) {
  checkSignedIn();
  if (!RELATIONSHIPS.includes(data.relationship)) {
    throw new Error("Relationship must be child, parent, spouse, or other.");
  }
  if (linked.length >= MAX_LINKED_PROFILES) {
    throw new Error(`You can link up to ${MAX_LINKED_PROFILES} dependents.`);
  }
  const profile = {
    id: "p" + nextId++,
    fullName: data.fullName.trim(),
    dateOfBirth: data.dateOfBirth,
    relationship: data.relationship,
    isSelf: false,
    profilePicture: "",
  };
  linked = [...linked, profile];
  return { ...profile };
}

export async function removeLinkedProfile(id) {
  checkSignedIn();
  if (!linked.some((profile) => profile.id === id)) throw new Error("Profile not found.");
  linked = linked.filter((profile) => profile.id !== id);
}

export async function deleteAccount(secret, { google = false } = {}) {
  checkSignedIn();
  if (google) {
    if (String(secret).trim().toLowerCase() !== self.email) throw new Error("Email does not match.");
  } else if (secret !== FAKE_PASSWORD) {
    throw new Error("Password is incorrect.");
  }
  linked = [];
  accountDeleted = true;
}

export async function updateProfilePicture(profileId, profilePicture) {
  checkSignedIn();
  if (profileId === "self") {
    self = { ...self, profilePicture };
    return { ...self };
  }
  const profile = linked.find((p) => p.id === profileId);
  if (!profile) throw new Error("Profile not found.");
  profile.profilePicture = profilePicture;
  return { ...profile };
}

export async function removeProfilePicture(profileId) {
  return updateProfilePicture(profileId, "");
}

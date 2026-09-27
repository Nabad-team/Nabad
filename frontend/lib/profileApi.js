// TEMPORARY MOCK: this file fakes the future backend for profiles.
// It saves data in the browser's localStorage so the demo survives page refreshes.
// Every function is async (returns a Promise) like a real API call, so later we can
// replace the insides with real fetch() calls without changing any page.

import { todayString } from "./dates";

const STORAGE_KEY = "nabad-profiles";

export const RELATIONSHIPS = ["child", "parent", "spouse", "other"];

// The most dependents one account can link.
export const MAX_LINKED_PROFILES = 10;

// The account owner's profile, used when nothing is stored yet.
const DEMO_SELF_PROFILE = {
  id: "self",
  fullName: "Demo User",
  dateOfBirth: "",
  relationship: "self",
  isSelf: true,
  email: "demo@nabad.app",
  phone: "",
  profilePicture: "",
};

// Reads the list of profiles from localStorage (seeding the demo user if empty).
// Throws an error if the stored data is not in the shape we expect.
function loadProfiles() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    let data;

    try {
      data = JSON.parse(saved);
    } catch {
      throw new Error("Saved profile data is unreadable");
    }

    if (!data || !Array.isArray(data.profiles)) {
      throw new Error("Saved profile data is unreadable");
    }

    return data.profiles;
  }

  const profiles = [DEMO_SELF_PROFILE];
  saveProfiles(profiles);

  return profiles;
}

function saveProfiles(profiles) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ profiles })
  );
}

// Returns the account owner's profile from a list,
// or throws if it is missing.
function findSelf(profiles) {
  const self = profiles.find(
    (profile) => profile.isSelf
  );

  if (!self) {
    throw new Error("Your profile was not found");
  }

  return self;
}

export async function getMyProfile() {
  return findSelf(loadProfiles());
}

// Only name, phone, and date of birth can change.
// Email is read-only.
export async function updateMyProfile(data) {
  const profiles = loadProfiles();

  findSelf(profiles);

  const updatedProfiles = profiles.map((profile) =>
    profile.isSelf
      ? {
          ...profile,
          fullName: data.fullName,
          phone: data.phone,
          dateOfBirth: data.dateOfBirth,
        }
      : profile
  );

  saveProfiles(updatedProfiles);

  return findSelf(updatedProfiles);
}

export async function listLinkedProfiles() {
  return loadProfiles().filter(
    (profile) => !profile.isSelf
  );
}

export async function addLinkedProfile(data) {
  if (!data.fullName || !data.fullName.trim()) {
    throw new Error("Full name is required");
  }

  if (!data.dateOfBirth) {
    throw new Error("Date of birth is required");
  }

  // Dates in YYYY-MM-DD format can be compared as plain strings.
  if (data.dateOfBirth > todayString()) {
    throw new Error(
      "Date of birth cannot be in the future"
    );
  }

  if (!RELATIONSHIPS.includes(data.relationship)) {
    throw new Error(
      "Relationship must be child, parent, spouse, or other"
    );
  }

  const profiles = loadProfiles();

  if (
    profiles.filter((profile) => !profile.isSelf)
      .length >= MAX_LINKED_PROFILES
  ) {
    throw new Error(
      `You can link up to ${MAX_LINKED_PROFILES} dependents`
    );
  }

  const newProfile = {
    // Date.now() alone can repeat if two profiles
    // are added in the same millisecond,
    // so random letters are added to keep ids unique.
    id:
      "p-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 7),

    fullName: data.fullName.trim(),
    dateOfBirth: data.dateOfBirth,
    relationship: data.relationship,
    isSelf: false,
    profilePicture: "",
  };

  saveProfiles([
    ...profiles,
    newProfile,
  ]);

  return newProfile;
}

export async function removeLinkedProfile(id) {
  const profiles = loadProfiles();

  const profile = profiles.find(
    (p) => p.id === id
  );

  if (!profile) {
    throw new Error("Profile not found");
  }

  if (profile.isSelf) {
    throw new Error(
      "You cannot remove your own profile"
    );
  }

  saveProfiles(
    profiles.filter((p) => p.id !== id)
  );
}

// The mock has no real accounts,
// so it accepts only the demo password "demo1234".
export async function deleteAccount(password) {
  if (!password) {
    throw new Error("Password is required");
  }

  if (password !== "demo1234") {
    throw new Error("Incorrect password");
  }

  localStorage.removeItem(STORAGE_KEY);
}

// Saves a profile picture as a data URL in localStorage.
export async function updateProfilePicture(
  profileId,
  profilePicture
) {
  const profiles = loadProfiles();

  const profileExists = profiles.some(
    (profile) => profile.id === profileId
  );

  if (!profileExists) {
    throw new Error("Profile not found");
  }

  const updatedProfiles = profiles.map(
    (profile) =>
      profile.id === profileId
        ? {
            ...profile,
            profilePicture,
          }
        : profile
  );

  saveProfiles(updatedProfiles);

  return updatedProfiles.find(
    (profile) =>
      profile.id === profileId
  );
}

// Removes the stored profile picture.
export async function removeProfilePicture(
  profileId
) {
  const profiles = loadProfiles();

  const profileExists = profiles.some(
    (profile) => profile.id === profileId
  );

  if (!profileExists) {
    throw new Error("Profile not found");
  }

  const updatedProfiles = profiles.map(
    (profile) =>
      profile.id === profileId
        ? {
            ...profile,
            profilePicture: "",
          }
        : profile
  );

  saveProfiles(updatedProfiles);

  return updatedProfiles.find(
    (profile) =>
      profile.id === profileId
  );
}
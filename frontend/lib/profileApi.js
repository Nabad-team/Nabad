// Profiles API: the signed-in user's own profile, their linked profiles (dependents)
// and account deletion. The data lives on the backend (/api/profile/...).
// Each function returns the same shape the pages used with the old localStorage mock,
// so the pages did not have to change.

import { request } from "./api";

export const RELATIONSHIPS = ["child", "parent", "spouse", "other"];

// The most dependents one account can link (the backend enforces the same limit).
export const MAX_LINKED_PROFILES = 10;

// The account owner's profile has the id "self"; linked profiles use their database id.
function pictureUrl(profileId) {
  return profileId === "self"
    ? "/profile/me/picture"
    : "/profile/linked/" + encodeURIComponent(profileId) + "/picture";
}

export async function getMyProfile() {
  return (await request("/profile/me")).profile;
}

// Only name, phone, and date of birth can change.
// Email is read-only.
export async function updateMyProfile(data) {
  const body = { fullName: data.fullName, phone: data.phone, dateOfBirth: data.dateOfBirth };
  return (await request("/profile/me", { method: "PATCH", body: JSON.stringify(body) })).profile;
}

export async function listLinkedProfiles() {
  return (await request("/profile/linked")).profiles;
}

export async function addLinkedProfile(data) {
  const body = { fullName: data.fullName, dateOfBirth: data.dateOfBirth, relationship: data.relationship };
  return (await request("/profile/linked", { method: "POST", body: JSON.stringify(body) })).profile;
}

export async function removeLinkedProfile(id) {
  await request("/profile/linked/" + encodeURIComponent(id), { method: "DELETE" });
}

// Deletes the account and all its data. Password accounts confirm with their password;
// Google-only accounts have no password they know, so they confirm with their email instead.
export async function deleteAccount(secret, { google = false } = {}) {
  const body = google ? { confirm: "DELETE", email: secret } : { confirm: "DELETE", password: secret };
  await request("/profile/me", { method: "DELETE", body: JSON.stringify(body) });
}

// Saves a profile picture (a PNG or JPEG data URL) for the owner ("self") or a dependent.
export async function updateProfilePicture(profileId, profilePicture) {
  return (await request(pictureUrl(profileId), { method: "PUT", body: JSON.stringify({ profilePicture }) })).profile;
}

// Removes the stored profile picture.
export async function removeProfilePicture(profileId) {
  return (await request(pictureUrl(profileId), { method: "DELETE" })).profile;
}

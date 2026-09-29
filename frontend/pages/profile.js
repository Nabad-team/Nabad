import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import ProfileHeader from "../components/ProfileHeader";
import Dialog from "../components/Dialog";
import EmergencyContact from "../components/EmergencyContact";
import { useActiveProfile } from "../context/ActiveProfileContext";
import {
  getMyProfile,
  updateMyProfile,
  addLinkedProfile,
  removeLinkedProfile,
  deleteAccount,
  RELATIONSHIPS,
  MAX_LINKED_PROFILES,
} from "../lib/profileApi";
import { todayString, calculateAge } from "../lib/dates";

const TEAL = "#0f766e";
const RED = "#b91c1c";

const buttonStyle = {
  padding: "10px 20px",
  borderRadius: 8,
  border: `2px solid ${TEAL}`,
  background: TEAL,
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const outlineButtonStyle = { ...buttonStyle, background: "white", color: TEAL };

// Red buttons are used only for actions that delete data.
const dangerButtonStyle = { ...buttonStyle, background: RED, border: `2px solid ${RED}` };

const smallOutlineButtonStyle = { ...outlineButtonStyle, padding: "2px 10px", marginLeft: 8, fontSize: 14 };

const inputStyle = { width: "100%", padding: 8, margin: "6px 0 4px", boxSizing: "border-box" };

// Checks the form and returns an object of error messages, e.g. { phone: "..." }.
// An empty object means everything is valid.
function validate(form) {
  const errors = {};

  if (!form.fullName.trim()) {
    errors.fullName = "Full name is required";
  }

  // Phone is optional. Ignore spaces, dashes, and brackets, then accept either
  // an international number (+ and 8 to 15 digits, e.g. +961 71 123 456)
  // or a Lebanese local number (7 or 8 digits, e.g. 71 123 456 or 03 123 456).
  const phone = form.phone.replace(/[\s\-()]/g, "");
  if (phone && !/^(\+\d{8,15}|0?\d{7,8})$/.test(phone)) {
    errors.phone = "Enter a valid Lebanese or international phone number";
  }

  // Dates in "YYYY-MM-DD" format can be compared as plain strings.
  if (form.dateOfBirth && form.dateOfBirth > todayString()) {
    errors.dateOfBirth = "Date of birth cannot be in the future";
  }

  return errors;
}

// Checks the "Add dependent" form. Every field is required.
function validateDependent(form) {
  const errors = {};

  if (!form.fullName.trim()) {
    errors.fullName = "Full name is required";
  }

  if (!form.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required";
  } else if (form.dateOfBirth > todayString()) {
    errors.dateOfBirth = "Date of birth cannot be in the future";
  }

  if (!form.relationship) {
    errors.relationship = "Relationship is required";
  }

  return errors;
}

const EMPTY_DEPENDENT = { fullName: "", dateOfBirth: "", relationship: "" };

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", dateOfBirth: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");

  // Linked profiles (dependents) come from the shared ActiveProfile context.
  const { selfProfile, activeProfile, linkedProfiles, switchProfile, refreshProfiles, resetActiveProfile } =
    useActiveProfile();
  const [isAddingDependent, setIsAddingDependent] = useState(false);
  const [dependentForm, setDependentForm] = useState(EMPTY_DEPENDENT);
  const [dependentErrors, setDependentErrors] = useState({});
  const [dependentError, setDependentError] = useState("");
  const [dependentMessage, setDependentMessage] = useState("");
  const reachedLimit = linkedProfiles.length >= MAX_LINKED_PROFILES;

  // The dependent waiting for "Remove" to be confirmed, or null when no dialog is open.
  const [profileToRemove, setProfileToRemove] = useState(null);
  const [removeError, setRemoveError] = useState("");

  // "Delete my account" dialog.
  const router = useRouter();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Load the profile once. .catch() makes sure a failed load shows a message
  // instead of "Loading..." forever.
  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch(() => setLoadError("Could not load your profile. Please refresh the page."));
  }, []);

  function startEditing() {
    // Copy the saved values into the form so edits don't change the profile until saved.
    setForm({ fullName: profile.fullName, phone: profile.phone, dateOfBirth: profile.dateOfBirth });
    setErrors({});
    setMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setErrors({});
    setSaveError("");
    setIsEditing(false);
  }

  // Updates one field of the form, e.g. updateField("phone", "71123456").
  function updateField(name, value) {
    setForm({ ...form, [name]: value });
  }

  async function handleSave(e) {
    e.preventDefault();
    const newErrors = validate(form);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateMyProfile({ ...form, fullName: form.fullName.trim() });
      setProfile(updated);
      // Update the profile switcher so it shows the new name too.
      refreshProfiles();
      setIsEditing(false);
      setMessage("Profile saved successfully.");
    } catch {
      setSaveError("Could not save your profile. Please try again.");
    } finally {
      // Runs whether saving worked or not, so the button never stays on "Saving...".
      setSaving(false);
    }
  }

  function startAddingDependent() {
    setDependentForm(EMPTY_DEPENDENT);
    setDependentErrors({});
    setDependentError("");
    setDependentMessage("");
    setIsAddingDependent(true);
  }

  function updateDependentField(name, value) {
    setDependentForm({ ...dependentForm, [name]: value });
  }

  async function handleAddDependent(e) {
    e.preventDefault();
    const newErrors = validateDependent(dependentForm);
    setDependentErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    setDependentError("");
    try {
      await addLinkedProfile({ ...dependentForm, fullName: dependentForm.fullName.trim() });
      await refreshProfiles();
      setIsAddingDependent(false);
      setDependentMessage("Dependent added.");
    } catch (err) {
      // The API explains what went wrong, e.g. "You can link up to 10 dependents".
      setDependentError(err.message);
    }
  }

  function askToRemove(dependent) {
    setRemoveError("");
    setDependentMessage("");
    setProfileToRemove(dependent);
  }

  async function handleRemove() {
    const removed = profileToRemove;
    try {
      await removeLinkedProfile(removed.id);
      // If we were acting as this dependent, go back to the account owner's own profile.
      if (activeProfile.id === removed.id) {
        switchProfile(selfProfile.id);
      }
      await refreshProfiles();
      setProfileToRemove(null);
      setDependentMessage(`${removed.fullName}'s profile was removed.`);
    } catch (err) {
      setRemoveError(err.message);
    }
  }

  function openDeleteAccount() {
    setDeletePassword("");
    setDeleteConfirmText("");
    setDeleteError("");
    setIsDeletingAccount(true);
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    // The button is disabled until "DELETE" is typed, but check here too in case the form is submitted another way.
    if (deleteConfirmText !== "DELETE") {
      return;
    }
    setDeleteError("");
    try {
      await deleteAccount(deletePassword);
      resetActiveProfile();
      // The landing page reads "?deleted=1" and shows a confirmation message.
      router.push("/?deleted=1");
    } catch (err) {
      // e.g. "Incorrect password". Nothing was deleted.
      setDeleteError(err.message);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px", fontFamily: "sans-serif", color: "#1f2937" }}>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <ProfileHeader />
      {/* The details on this page are always the account owner's, so explain that
          while acting as a dependent (the banner above names who is active). */}
      {activeProfile && !activeProfile.isSelf && (
        <p style={{ color: "#6b7280", marginTop: -20 }}>
          You're managing {activeProfile.fullName}'s care. Account settings below belong to you.
        </p>
      )}
      <h1>My Profile</h1>

      {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}
      {!profile && !loadError && <p>Loading...</p>}

      {message && <p style={{ color: TEAL, fontWeight: "bold" }}>{message}</p>}

      {profile && <h2 style={{ color: TEAL }}>Account owner</h2>}

      {profile && !isEditing && (
        <div>
          <p><strong>Full name:</strong> {profile.fullName}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Phone:</strong> {profile.phone || "Not set"}</p>
          <p><strong>Date of birth:</strong> {profile.dateOfBirth || "Not set"}</p>
          <button type="button" onClick={startEditing} style={buttonStyle}>Edit</button>
        </div>
      )}

      {profile && isEditing && (
        // noValidate turns off the browser's own checks so our validate() messages are shown.
        <form onSubmit={handleSave} noValidate>
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            value={form.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            style={inputStyle}
          />
          {errors.fullName && <p style={{ color: "crimson", marginTop: 0 }}>{errors.fullName}</p>}

          <p><strong>Email:</strong> {profile.email} (cannot be changed)</p>

          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="e.g. 71 123 456 or +961 71 123 456"
            style={inputStyle}
          />
          {errors.phone && <p style={{ color: "crimson", marginTop: 0 }}>{errors.phone}</p>}

          <label htmlFor="dateOfBirth">Date of birth</label>
          <input
            id="dateOfBirth"
            type="date"
            max={todayString()}
            value={form.dateOfBirth}
            onChange={(e) => updateField("dateOfBirth", e.target.value)}
            style={inputStyle}
          />
          {errors.dateOfBirth && <p style={{ color: "crimson", marginTop: 0 }}>{errors.dateOfBirth}</p>}

          {saveError && <p style={{ color: "crimson" }}>{saveError}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
            <button type="submit" disabled={saving} style={buttonStyle}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={cancelEditing} style={outlineButtonStyle}>Cancel</button>
          </div>
        </form>
      )}

      <section style={{ marginTop: 40 }}>
        <h2 style={{ color: TEAL }}>Account security</h2>
        <p>Manage your sign-in verification settings.</p>
        <a href="/security" style={{ color: TEAL }}>Open security settings</a>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ color: TEAL }}>Linked profiles</h2>
        {dependentMessage && <p style={{ color: TEAL, fontWeight: "bold" }}>{dependentMessage}</p>}

        {linkedProfiles.length === 0 && <p style={{ color: "#6b7280" }}>No linked profiles yet.</p>}
        {linkedProfiles.length > 0 && (
          <ul style={{ paddingLeft: 20 }}>
            {linkedProfiles.map((dependent) => (
              <li key={dependent.id} style={{ marginBottom: 6 }}>
                <strong>{dependent.fullName}</strong>, {dependent.relationship}, age {calculateAge(dependent.dateOfBirth)}
                {/* The self profile is never in this list, so it can never be removed here. */}
                <button
                  type="button"
                  onClick={() => askToRemove(dependent)}
                  aria-label={`Remove ${dependent.fullName}`}
                  style={smallOutlineButtonStyle}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {reachedLimit && (
          <p style={{ color: "#6b7280" }}>You can link up to {MAX_LINKED_PROFILES} dependents.</p>
        )}

        {!isAddingDependent && (
          <button type="button" onClick={startAddingDependent} disabled={reachedLimit} style={buttonStyle}>
            Add dependent
          </button>
        )}

        {isAddingDependent && (
          <form onSubmit={handleAddDependent} noValidate>
            <label htmlFor="dependentName">Full name</label>
            <input
              id="dependentName"
              value={dependentForm.fullName}
              onChange={(e) => updateDependentField("fullName", e.target.value)}
              style={inputStyle}
            />
            {dependentErrors.fullName && <p style={{ color: "crimson", marginTop: 0 }}>{dependentErrors.fullName}</p>}

            <label htmlFor="dependentDateOfBirth">Date of birth</label>
            <input
              id="dependentDateOfBirth"
              type="date"
              max={todayString()}
              value={dependentForm.dateOfBirth}
              onChange={(e) => updateDependentField("dateOfBirth", e.target.value)}
              style={inputStyle}
            />
            {dependentErrors.dateOfBirth && <p style={{ color: "crimson", marginTop: 0 }}>{dependentErrors.dateOfBirth}</p>}

            <label htmlFor="dependentRelationship">Relationship</label>
            <select
              id="dependentRelationship"
              value={dependentForm.relationship}
              onChange={(e) => updateDependentField("relationship", e.target.value)}
              style={inputStyle}
            >
              <option value="">Choose...</option>
              {RELATIONSHIPS.map((relationship) => (
                <option key={relationship} value={relationship}>{relationship}</option>
              ))}
            </select>
            {dependentErrors.relationship && <p style={{ color: "crimson", marginTop: 0 }}>{dependentErrors.relationship}</p>}

            {dependentError && <p style={{ color: "crimson" }}>{dependentError}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
              <button type="submit" style={buttonStyle}>Save dependent</button>
              <button type="button" onClick={() => setIsAddingDependent(false)} style={outlineButtonStyle}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <EmergencyContact />

      <section style={{ border: `2px solid ${RED}`, borderRadius: 12, padding: 20, marginTop: 40 }}>
        <h2 style={{ marginTop: 0, color: RED }}>Danger zone</h2>
        <p style={{ color: "#6b7280" }}>Deleting your account is permanent and cannot be undone.</p>
        <button type="button" onClick={openDeleteAccount} style={dangerButtonStyle}>Delete my account</button>
      </section>

      {profileToRemove && (
        <Dialog title="Remove linked profile">
          <p>
            Remove {profileToRemove.fullName}'s profile? This deletes all of their data and cannot be undone.
          </p>
          {removeError && <p style={{ color: "crimson" }}>{removeError}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
            <button type="button" onClick={handleRemove} style={dangerButtonStyle}>Remove</button>
            <button type="button" onClick={() => setProfileToRemove(null)} style={outlineButtonStyle}>Cancel</button>
          </div>
        </Dialog>
      )}

      {isDeletingAccount && (
        <Dialog title="Delete your account?">
          <p style={{ marginBottom: 4 }}>This permanently deletes:</p>
          <ul style={{ marginTop: 0 }}>
            <li>Your account</li>
            <li>Your profile</li>
            <li>All linked profiles</li>
            <li>Your emergency contacts</li>
          </ul>
          <form onSubmit={handleDeleteAccount} noValidate>
            <label htmlFor="deletePassword">Password</label>
            <input
              id="deletePassword"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              style={inputStyle}
            />

            <label htmlFor="deleteConfirmText">Type DELETE to confirm</label>
            <input
              id="deleteConfirmText"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
              style={inputStyle}
            />

            {deleteError && <p style={{ color: "crimson" }}>{deleteError}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
              {/* Stays disabled until exactly "DELETE" (capital letters) is typed. */}
              <button
                type="submit"
                disabled={deleteConfirmText !== "DELETE"}
                style={{ ...dangerButtonStyle, opacity: deleteConfirmText === "DELETE" ? 1 : 0.5 }}
              >
                Delete my account
              </button>
              <button type="button" onClick={() => setIsDeletingAccount(false)} style={outlineButtonStyle}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}

      <p style={{ marginTop: 24 }}>
        <a href="/dashboard" style={{ color: TEAL }}>Back to dashboard</a>
      </p>
    </main>
  );
}

import { useEffect, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import Dialog from "../components/Dialog";
import EmergencyContact from "../components/EmergencyContact";
import DataExport from "../components/DataExport";
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
import { todayString, calculateAge, formatDate } from "../lib/dates";
import { signOut } from "../lib/session";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { TwoHearts } from "../components/illustrations";
import AccessibilitySettings from "../components/AccessibilitySettings";
import NotificationPreferences from "../components/NotificationPreferences";
import { useAccessibility } from "../context/AccessibilityContext";

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
  // Same rule as the backend (validPhone in backend/src/models/contactSchema.js).
  const phone = form.phone.replace(/[\s\-().]/g, "");
  if (phone && !/^(\+[1-9]\d{7,14}|\d{7,8})$/.test(phone)) {
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
  const { preferences } = useAccessibility();
  const simplified = preferences.simplifiedMode;
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  // The password, or the email for accounts that only sign in with Google (they have no password).
  const [deleteCredential, setDeleteCredential] = useState("");
  const isGoogleAccount = profile?.authProvider === "google";
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
    setDeleteCredential("");
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
      await deleteAccount(deleteCredential, { google: isGoogleAccount });
      resetActiveProfile();
      // Signing out stops the inactivity timer and signs out other tabs too.
      // The landing page reads "?deleted=1" and shows a confirmation message.
      await signOut("/?deleted=1");
    } catch (err) {
      // e.g. "Password is incorrect." Nothing was deleted.
      setDeleteError(err.message);
    }
  }

  return (
    <PageLayout title="My profile" header={<ProfileHeader />}>
      {/* The details on this page are always the account owner's, so explain that
          while acting as a dependent (the banner above names who is active). */}
      {activeProfile && !activeProfile.isSelf && (
        <p className="text-muted">
          You're managing {activeProfile.fullName}'s care. Account settings below belong to you.
        </p>
      )}
      <PageTitle>{simplified ? "Profile" : "My profile"}</PageTitle>

      {loadError && <Alert tone="danger" as="p" role="alert">{loadError}</Alert>}
      {!profile && !loadError && <HeartbeatLoader />}

      {message && <Alert tone="success" as="p" role="status" className="profile-message">{message}</Alert>}

      {profile && (
        <section aria-labelledby="owner-heading">
          <h2 id="owner-heading">{simplified ? "Your details" : "Account owner"}</h2>

          {!isEditing && (
            <>
              <div className="details">
                <p><span className="details__label">Full name</span>{profile.fullName}</p>
                <p><span className="details__label">Email</span>{profile.email}</p>
                <p><span className="details__label">Phone</span>{profile.phone || "Not set"}</p>
                <p><span className="details__label">Date of birth</span>{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : "Not set"}</p>
              </div>
              <Button variant="secondary" onClick={startEditing}>{simplified ? "Change" : "Edit"}</Button>
            </>
          )}

          {isEditing && (
            // noValidate turns off the browser's own checks so our validate() messages are shown.
            <form onSubmit={handleSave} noValidate className="form">
              <Input
                id="fullName"
                label="Full name"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                error={errors.fullName}
              />

              <p><span className="details__label">Email (cannot be changed)</span>{profile.email}</p>

              <Input
                id="phone"
                label="Phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="e.g. 71 123 456 or +961 71 123 456"
                error={errors.phone}
              />

              <Input
                id="dateOfBirth"
                label="Date of birth"
                type="date"
                max={todayString()}
                value={form.dateOfBirth}
                onChange={(e) => updateField("dateOfBirth", e.target.value)}
                error={errors.dateOfBirth}
              />

              {saveError && <Alert tone="danger" as="p" role="alert">{saveError}</Alert>}
              <div className="form-actions">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="secondary" onClick={cancelEditing}>Cancel</Button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="section" aria-labelledby="security-heading">
        <h2 id="security-heading">{simplified ? "Sign-in safety" : "Account security"}</h2>
        <p>{simplified ? "Keep your account safe." : "Manage your sign-in verification settings."}</p>
        <a href="/security" aria-label={simplified ? "Open sign-in safety settings" : undefined}>
          {simplified ? "Open safety settings" : "Open security settings"}
        </a>
      </section>

      <NotificationPreferences />

      <AccessibilitySettings />

      <section className="section" aria-labelledby="linked-heading">
        <h2 id="linked-heading">{simplified ? "People you help" : "Linked profiles"}</h2>
        {dependentMessage && <Alert tone="success" as="p" role="status" className="profile-message">{dependentMessage}</Alert>}

        {linkedProfiles.length === 0 && (
          <EmptyState illustration={<TwoHearts size="5rem" />} title="No linked profiles yet.">
            {simplified ? "Add a person you help." : "Add someone you look after. You can then switch to their profile from the menu at the top."}
          </EmptyState>
        )}
        {linkedProfiles.length > 0 && (
          <ul className="plain-list">
            {linkedProfiles.map((dependent) => (
              <li key={dependent.id}>
                <span>
                  <strong>{dependent.fullName}</strong>, {dependent.relationship}, age {calculateAge(dependent.dateOfBirth)}
                </span>
                {/* The self profile is never in this list, so it can never be removed here. */}
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => askToRemove(dependent)}
                  aria-label={`Remove ${dependent.fullName}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {reachedLimit && (
          <p className="text-muted">You can link up to {MAX_LINKED_PROFILES} dependents.</p>
        )}

        {!isAddingDependent && (
          <Button variant="secondary" onClick={startAddingDependent} disabled={reachedLimit}>
            {simplified ? "Add person" : "Add dependent"}
          </Button>
        )}

        {isAddingDependent && (
          <form onSubmit={handleAddDependent} noValidate className="form">
            <Input
              id="dependentName"
              label="Full name"
              value={dependentForm.fullName}
              onChange={(e) => updateDependentField("fullName", e.target.value)}
              error={dependentErrors.fullName}
            />

            <Input
              id="dependentDateOfBirth"
              label="Date of birth"
              type="date"
              max={todayString()}
              value={dependentForm.dateOfBirth}
              onChange={(e) => updateDependentField("dateOfBirth", e.target.value)}
              error={dependentErrors.dateOfBirth}
            />

            <Input
              as="select"
              id="dependentRelationship"
              label="Relationship"
              value={dependentForm.relationship}
              onChange={(e) => updateDependentField("relationship", e.target.value)}
              error={dependentErrors.relationship}
            >
              <option value="">Choose...</option>
              {RELATIONSHIPS.map((relationship) => (
                <option key={relationship} value={relationship}>{relationship}</option>
              ))}
            </Input>

            {dependentError && <Alert tone="danger" as="p" role="alert">{dependentError}</Alert>}
            <div className="form-actions">
              <Button type="submit">Save dependent</Button>
              <Button variant="secondary" onClick={() => setIsAddingDependent(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </section>

      <EmergencyContact />

      <DataExport isGoogleAccount={isGoogleAccount} />

      <Card tone="danger" aria-labelledby="danger-heading" className="section">
        <h2 id="danger-heading">Danger zone</h2>
        <p className="text-muted">Deleting your account is permanent and cannot be undone.</p>
        <Button variant="danger" onClick={openDeleteAccount}>Delete my account</Button>
      </Card>

      {profileToRemove && (
        <Dialog title="Remove linked profile">
          <p>
            Remove {profileToRemove.fullName}'s profile? This deletes all of their data and cannot be undone.
          </p>
          {removeError && <Alert tone="danger" as="p" role="alert">{removeError}</Alert>}
          <div className="button-row dialog__actions">
            <Button onClick={handleRemove}>Remove</Button>
            <Button variant="secondary" onClick={() => setProfileToRemove(null)}>Cancel</Button>
          </div>
        </Dialog>
      )}

      {isDeletingAccount && (
        <Dialog title="Delete your account?">
          <p className="dialog__list-intro">This permanently deletes:</p>
          <ul>
            <li>Your account</li>
            <li>Your profile</li>
            <li>All linked profiles</li>
            <li>Your emergency contacts</li>
            <li>Your medications</li>
          </ul>
          <form onSubmit={handleDeleteAccount} noValidate className="form">
            {/* Google-only accounts have no password, so they type their email instead. */}
            <Input
              id="deleteCredential"
              label={isGoogleAccount ? "Email" : "Password"}
              type={isGoogleAccount ? "email" : "password"}
              autoComplete={isGoogleAccount ? "off" : "current-password"}
              value={deleteCredential}
              onChange={(e) => setDeleteCredential(e.target.value)}
            />

            <Input
              id="deleteConfirmText"
              label="Type DELETE to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
            />

            {deleteError && <Alert tone="danger" as="p" role="alert">{deleteError}</Alert>}
            <div className="form-actions">
              {/* Stays disabled until exactly "DELETE" (capital letters) is typed. */}
              <Button type="submit" variant="danger" disabled={deleteConfirmText !== "DELETE"}>
                Delete my account
              </Button>
              <Button variant="secondary" onClick={() => setIsDeletingAccount(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      <p className="section">
        <a href="/dashboard">Back to dashboard</a>
      </p>
    </PageLayout>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
ProfilePage.requireSignIn = true;

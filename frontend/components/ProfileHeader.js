import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import Avatar from "./Avatar";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { signOut } from "../lib/session";
import { useSignedIn } from "./SessionTimeout";
import {
  updateProfilePicture,
  removeProfilePicture,
} from "../lib/profileApi";

const TEAL = "#0f766e";
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export default function ProfileHeader() {
  const { selfProfile, linkedProfiles, activeProfile, switchProfile, refreshProfiles } =
    useActiveProfile();

  const signedIn = useSignedIn();
  const fileInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState("");
  const [savedPicture, setSavedPicture] = useState(
    activeProfile?.profilePicture || ""
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setPreviewUrl("");
    setSavedPicture(activeProfile?.profilePicture || "");
    setError("");
  }, [activeProfile?.id, activeProfile?.profilePicture]);

  async function handlePictureChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    setError("");

    // Only allow JPG/JPEG and PNG files.
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a JPG or PNG image.");
      e.target.value = "";
      return;
    }

    // Keep the file small: the backend accepts pictures up to 1 MB.
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be smaller than 1 MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const imageData = reader.result;

        await updateProfilePicture(activeProfile.id, imageData);

        // Show the new picture immediately.
        setSavedPicture(imageData);
        setPreviewUrl(imageData);
        // Reload the shared profiles so the picture is still there after switching profiles.
        refreshProfiles();
      } catch (err) {
        setError(err.message);
      }
    };

    reader.onerror = () => {
      setError("Could not read the selected image.");
    };

    reader.readAsDataURL(file);
  }

  async function handleRemovePicture() {
    try {
      await removeProfilePicture(activeProfile.id);

      setSavedPicture("");
      setPreviewUrl("");
      setError("");
      refreshProfiles();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const displayedPicture = previewUrl || savedPicture;

  const hasPicture =
    Boolean(previewUrl) || Boolean(savedPicture);

  return (
    <header style={{ marginBottom: 32 }}>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Logo />

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {selfProfile && activeProfile && (
            <select
              aria-label="Active profile"
              value={activeProfile.id}
              onChange={(e) => switchProfile(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 8,
                border: `2px solid ${TEAL}`,
                color: TEAL,
                maxWidth: "100%",
              }}
            >
              <option value={selfProfile.id}>
                {selfProfile.fullName} (you)
              </option>

              {linkedProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.fullName} ({profile.relationship})
                </option>
              ))}
            </select>
          )}

          {signedIn && (
            <a href="/security" style={{ padding: 8, color: TEAL, fontWeight: "bold" }}>
              Security
            </a>
          )}

          {/* Signs out in every open tab (see lib/session.js). Only shown while signed in. */}
          {signedIn && (
            <button
              type="button"
              onClick={() => signOut()}
              style={{
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${TEAL}`,
                background: "white",
                color: TEAL,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </nav>

      {activeProfile && (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Avatar name={activeProfile.fullName} src={displayedPicture} size={100} borderColor={TEAL} />

          <div>
            <input
              ref={fileInputRef}
              data-testid="profile-picture-input"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handlePictureChange}
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: TEAL,
                color: "white",
                cursor: "pointer",
                marginRight: 8,
              }}
            >
              {hasPicture ? "Change picture" : "Upload picture"}
            </button>

            {hasPicture && (
              <button
                type="button"
                onClick={handleRemovePicture}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: `1px solid ${TEAL}`,
                  background: "white",
                  color: TEAL,
                  cursor: "pointer",
                }}
              >
                Remove picture
              </button>
            )}

            {error && (
              <p
                style={{
                  color: "crimson",
                  marginTop: 8,
                }}
              >
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {activeProfile && !activeProfile.isSelf && (
        <p
          role="status"
          style={{
            background: TEAL,
            color: "white",
            fontWeight: "bold",
            padding: "10px 16px",
            borderRadius: 8,
            marginBottom: 0,
          }}
        >
          Acting as: {activeProfile.fullName} ({activeProfile.relationship})
        </p>
      )}
    </header>
  );
}
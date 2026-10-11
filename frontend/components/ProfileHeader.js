import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { signOut } from "../lib/session";
import { useSignedIn } from "./SessionTimeout";
import {
  updateProfilePicture,
  removeProfilePicture,
} from "../lib/profileApi";

// The avatar ring uses the logo teal (the same value as --color-primary).
const TEAL = "#0f766e";
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

// showPicture: false hides the picture controls (the dashboard keeps them on the profile page only).
export default function ProfileHeader({ showPicture = true }) {
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
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Logo />

          {/* A direct child of the header row, so on phones it can move to its own full-width row
              below the logo and the names show in full (see .profile-switcher in components.css). */}
          {selfProfile && activeProfile && (
            <div className="profile-switcher">
              <select
                aria-label="Active profile"
                className="input profile-select"
                value={activeProfile.id}
                onChange={(e) => switchProfile(e.target.value)}
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
            </div>
          )}

          <nav aria-label="Account" className="site-nav">
            {signedIn && (
              <a href="/security" className="site-nav__link">
                Security
              </a>
            )}

            {/* Signs out in every open tab (see lib/session.js). Only shown while signed in. */}
            {signedIn && (
              <Button variant="secondary" size="small" onClick={() => signOut()}>
                Sign out
              </Button>
            )}
          </nav>
        </div>
      </header>

      {activeProfile && (showPicture || !activeProfile.isSelf) && (
        <div className="container profile-strip">
          {showPicture && (
            <div className="profile-strip__picture">
              <Avatar name={activeProfile.fullName} src={displayedPicture} size={72} borderColor={TEAL} />

              <div>
                <input
                  ref={fileInputRef}
                  data-testid="profile-picture-input"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handlePictureChange}
                  style={{ display: "none" }}
                />

                <div className="button-row">
                  <Button variant="secondary" size="small" onClick={() => fileInputRef.current?.click()}>
                    {hasPicture ? "Change picture" : "Upload picture"}
                  </Button>

                  {hasPicture && (
                    <Button variant="secondary" size="small" onClick={handleRemovePicture}>
                      Remove picture
                    </Button>
                  )}
                </div>

                {error && <p className="field__error profile-strip__error">{error}</p>}
              </div>
            </div>
          )}

          {!activeProfile.isSelf && (
            <Alert tone="info" as="p" role="status" className="acting-as">
              Acting as: {activeProfile.fullName} ({activeProfile.relationship})
            </Alert>
          )}
        </div>
      )}
    </>
  );
}

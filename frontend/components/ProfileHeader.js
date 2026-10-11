import { useEffect, useRef, useState } from "react";
import AppHeader from "./AppHeader";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import { useActiveProfile } from "../context/ActiveProfileContext";
import {
  updateProfilePicture,
  removeProfilePicture,
} from "../lib/profileApi";

// The avatar ring uses the logo teal (the same value as --color-primary).
const TEAL = "#0f766e";
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

// The header of signed-in pages: the bar with navigation and menus (components/AppHeader.js), then the
// active profile's picture controls and, when acting for a family member, the "Acting as" banner.
// showPicture: false hides the picture controls (the dashboard keeps them on the profile page only).
export default function ProfileHeader({ showPicture = true }) {
  const { activeProfile, refreshProfiles } = useActiveProfile() || {};
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
      <AppHeader />

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

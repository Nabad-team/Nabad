import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { updateProfilePicture, removeProfilePicture } from "../lib/profileApi";

// The avatar ring uses the Nabad spruce green (the same value as --color-primary).
const SPRUCE = "#1d4434";
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

// A profile's picture with "Upload picture" / "Change picture" and "Remove picture". My profile shows it in the
// Account owner card (the account owner's picture) and, while acting for a family member, in Linked profiles.
//   profile: whose picture. Defaults to the active profile.
export default function ProfilePicture({ profile: chosenProfile }) {
  const { activeProfile, refreshProfiles } = useActiveProfile() || {};
  const profile = chosenProfile || activeProfile;
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [savedPicture, setSavedPicture] = useState(profile?.profilePicture || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setPreviewUrl("");
    setSavedPicture(profile?.profilePicture || "");
    setError("");
  }, [profile?.id, profile?.profilePicture]);

  if (!profile) return null;

  function handlePictureChange(e) {
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
        await updateProfilePicture(profile.id, imageData);
        // Show the new picture immediately.
        setSavedPicture(imageData);
        setPreviewUrl(imageData);
        // Reload the shared profiles so the picture is still there after switching profiles.
        refreshProfiles?.();
      } catch (err) {
        setError(err.message);
      }
    };
    reader.onerror = () => setError("Could not read the selected image.");
    reader.readAsDataURL(file);
  }

  async function handleRemovePicture() {
    try {
      await removeProfilePicture(profile.id);
      setSavedPicture("");
      setPreviewUrl("");
      setError("");
      refreshProfiles?.();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err.message);
    }
  }

  const displayedPicture = previewUrl || savedPicture;
  const hasPicture = Boolean(displayedPicture);

  return (
    <div className="profile-picture">
      <Avatar name={profile.fullName} src={displayedPicture} size={72} borderColor={SPRUCE} />
      <div>
        <input
          ref={fileInputRef}
          data-testid="profile-picture-input"
          type="file"
          accept="image/jpeg,image/png"
          onChange={handlePictureChange}
          hidden
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
        {error && <p className="field__error profile-picture__error">{error}</p>}
      </div>
    </div>
  );
}

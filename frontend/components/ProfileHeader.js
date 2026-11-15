import AppHeader from "./AppHeader";
import Alert from "./ui/Alert";
import { useActiveProfile } from "../context/ActiveProfileContext";

// The header of signed-in pages: the bar with navigation and menus (components/AppHeader.js) and, when acting
// for a family member, the "Acting as" banner. The profile picture lives on My profile (components/ProfilePicture.js).
export default function ProfileHeader() {
  const { activeProfile } = useActiveProfile() || {};

  return (
    <>
      <AppHeader />

      {activeProfile && !activeProfile.isSelf && (
        <div className="container container--wide profile-strip">
          <Alert tone="info" as="p" role="status" className="acting-as">
            Acting as: {activeProfile.fullName} ({activeProfile.relationship})
          </Alert>
        </div>
      )}
    </>
  );
}

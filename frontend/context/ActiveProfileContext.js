import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getMyProfile, listLinkedProfiles } from "../lib/profileApi";
import { useSessionStatus } from "../components/SessionTimeout";

// localStorage key that remembers which profile the user is acting as.
const ACTIVE_PROFILE_KEY = "nabad-active-profile-id";

// A React context lets any page read the active profile without passing it down as props.
const ActiveProfileContext = createContext(null);

// Must be inside <SessionTimeout> (see _app.js): profiles are loaded once the user is signed in
// and forgotten when they sign out, so the next person on this browser never sees them.
export function ActiveProfileProvider({ children }) {
  const status = useSessionStatus();
  const statusRef = useRef(status);
  statusRef.current = status;
  const [selfProfile, setSelfProfile] = useState(null);
  const [linkedProfiles, setLinkedProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState("self");
  const [error, setError] = useState("");

  // Loads the account owner and all dependents from the profile API.
  async function refreshProfiles() {
    try {
      const [self, linked] = await Promise.all([getMyProfile(), listLinkedProfiles()]);
      // The user may have signed out while this was loading.
      if (statusRef.current !== "signedIn") return;
      setSelfProfile(self);
      setLinkedProfiles(linked);
      setError("");
    } catch {
      if (statusRef.current === "signedIn") setError("Could not load your profile. Please refresh the page.");
    }
  }

  // localStorage only exists in the browser, so the saved choice is read here and not during rendering.
  useEffect(() => {
    const savedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (savedId) {
      setActiveProfileId(savedId);
    }
  }, []);

  useEffect(() => {
    if (status === "signedIn") {
      refreshProfiles();
    } else if (status === "signedOut" || status === "ended") {
      forgetProfiles(status === "ended");
    }
  }, [status]);

  function switchProfile(id) {
    setActiveProfileId(id);
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  }

  // Forgets the loaded profiles, and (after signing out or deleting the account) the saved choice.
  function forgetProfiles(forgetChoice) {
    if (forgetChoice) {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
      setActiveProfileId("self");
    }
    setSelfProfile(null);
    setLinkedProfiles([]);
    setError("");
  }

  // Called after the account is deleted.
  function resetActiveProfile() {
    forgetProfiles(true);
  }

  // If the saved id no longer matches a dependent (for example it was removed),
  // fall back to the account owner's own profile.
  const activeProfile =
    linkedProfiles.find((profile) => profile.id === activeProfileId) || selfProfile;

  const value = {
    selfProfile,
    linkedProfiles,
    activeProfile,
    switchProfile,
    refreshProfiles,
    resetActiveProfile,
    error,
    loading: !selfProfile && !error,
  };

  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

// Pages call useActiveProfile() to get the value shared by the provider above.
export function useActiveProfile() {
  return useContext(ActiveProfileContext);
}

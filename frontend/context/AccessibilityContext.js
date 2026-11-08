import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nabad-accessibility-preferences";
const DEFAULT_PREFERENCES = {
  textSize: "default",
  highContrast: false,
  simplifiedMode: false,
};

const AccessibilityContext = createContext({
  preferences: DEFAULT_PREFERENCES,
  preferencesSaved: true,
  updatePreferences: () => {},
});

function normalizePreferences(saved) {
  return {
    textSize: ["default", "large", "extra-large"].includes(saved?.textSize) ? saved.textSize : "default",
    highContrast: saved?.highContrast === true,
    simplifiedMode: saved?.simplifiedMode === true,
  };
}

function readPreferences() {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return normalizePreferences(saved);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AccessibilityProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(true);

  useEffect(() => {
    setPreferences(readPreferences());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.textSize = preferences.textSize;
    document.documentElement.dataset.highContrast = preferences.highContrast ? "true" : "false";
    document.documentElement.dataset.simplifiedMode = preferences.simplifiedMode ? "true" : "false";
    // Device storage may be blocked; the current session must still be usable.
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); setPreferencesSaved(true); }
    catch { setPreferencesSaved(false); }
  }, [hydrated, preferences]);

  function updatePreferences(changes) {
    setPreferences((current) => normalizePreferences({ ...current, ...changes }));
  }

  const value = useMemo(
    () => ({ preferences, preferencesSaved, updatePreferences }),
    [preferences, preferencesSaved]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}

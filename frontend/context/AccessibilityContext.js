import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nabad-accessibility-preferences";
const DEFAULT_PREFERENCES = {
  textSize: "default",
  highContrast: false,
  simplifiedMode: false,
};

const AccessibilityContext = createContext({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {},
});

function readPreferences() {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return { ...DEFAULT_PREFERENCES, ...(saved || {}) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AccessibilityProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferences(readPreferences());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.textSize = preferences.textSize;
    document.documentElement.dataset.highContrast = preferences.highContrast ? "true" : "false";
    document.documentElement.dataset.simplifiedMode = preferences.simplifiedMode ? "true" : "false";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [hydrated, preferences]);

  function updatePreferences(changes) {
    setPreferences((current) => ({ ...current, ...changes }));
  }

  const value = useMemo(
    () => ({ preferences, updatePreferences }),
    [preferences]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}

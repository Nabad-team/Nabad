import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Dialog from "./Dialog";
import { getSession } from "../lib/api";
import {
  recordActivity,
  lastActivity,
  signOut,
  onSignOutInOtherTab,
  onSignOutInThisTab,
  inactivityLoginUrl,
  SESSION_ENDED_LOGIN_URL,
  minutesText,
} from "../lib/session";

const TEAL = "#0f766e";

// Things that count as "the user is still here".
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

// Lets any component ask about the sign-in state:
// "checking" until the server answers, then "signedIn" or "signedOut".
// "ended" means this tab just signed out (timeout or Sign out) and is on its way to /login.
const SessionStatusContext = createContext("signedOut");
export function useSessionStatus() {
  return useContext(SessionStatusContext);
}
// For example to show the Sign out button.
export function useSignedIn() {
  return useSessionStatus() === "signedIn";
}

// Signs the user out after a period of inactivity (30 minutes by default).
// The timeout values come from the server (GET /api/auth/session), which also enforces them:
// the server session expires if the browser stops reporting activity.
// Wraps every page in _app.js, but the timer only runs while signed in.
export default function SessionTimeout({ children }) {
  const router = useRouter();
  // The timeout settings from the server, or null while signed out.
  const [settings, setSettings] = useState(null);
  // The last answer while signed out, and the page it was for.
  const [answer, setAnswer] = useState({ path: null, status: "checking" });
  const [showWarning, setShowWarning] = useState(false);
  const settingsRef = useRef(null);
  const pathRef = useRef(router.asPath);
  pathRef.current = router.asPath;
  const staySignedInRef = useRef(() => {});

  // An answer given for another page counts as "checking". Otherwise, right after logging in,
  // the new page would briefly see the login page's "signedOut" and send the user back to /login.
  const status = settings ? "signedIn" : answer.path === router.asPath ? answer.status : "checking";

  // Checks whether the user is signed in: on first load and after each page change
  // (for example right after logging in). A 401 means signed out, so the timer stays off.
  useEffect(() => {
    if (settingsRef.current) return;
    let cancelled = false;
    const path = router.asPath;
    getSession()
      .then((result) => {
        if (cancelled) return;
        recordActivity();
        settingsRef.current = result;
        setSettings(result);
      })
      .catch(() => {
        if (!cancelled) setAnswer({ path, status: "signedOut" });
      });
    return () => {
      cancelled = true;
    };
  }, [router.asPath]);

  useEffect(() => {
    if (!settings) return;
    const { idleTimeoutMs, warningBeforeMs, absoluteExpiresAt } = settings;
    // Activity is reported to the server at most this often, so the server session stays alive.
    const heartbeatMs = Math.min(60 * 1000, idleTimeoutMs / 10);
    let lastHeartbeat = Date.now();
    let heartbeatTimer = null;
    let lastWrite = 0;
    let warningVisible = false;
    let ended = false;

    function stop() {
      ended = true;
      settingsRef.current = null;
      setSettings(null);
      setAnswer({ path: pathRef.current, status: "ended" });
      setShowWarning(false);
    }

    function end(url) {
      if (ended) return;
      stop();
      signOut(url);
    }

    function heartbeat() {
      heartbeatTimer = null;
      lastHeartbeat = Date.now();
      getSession().catch((err) => {
        if (err.status === 401) end(SESSION_ENDED_LOGIN_URL);
      });
    }

    function handleActivity() {
      // While the warning is open, only the "Stay signed in" button keeps the user signed in.
      if (ended || warningVisible) return;
      const now = Date.now();
      if (now - lastWrite >= 1000) {
        lastWrite = now;
        recordActivity(now);
      }
      // One pending heartbeat covers all activity until it is sent, so the last activity always reaches the server.
      if (!heartbeatTimer) heartbeatTimer = setTimeout(heartbeat, Math.max(0, lastHeartbeat + heartbeatMs - now));
    }

    // Checks every second how long all tabs together have been inactive.
    function tick() {
      const now = Date.now();
      if (now >= absoluteExpiresAt) return end(SESSION_ENDED_LOGIN_URL);
      const idleFor = now - lastActivity();
      if (idleFor >= idleTimeoutMs) return end(inactivityLoginUrl(idleTimeoutMs));
      warningVisible = idleFor >= idleTimeoutMs - warningBeforeMs;
      setShowWarning(warningVisible);
    }

    staySignedInRef.current = () => {
      warningVisible = false;
      setShowWarning(false);
      recordActivity();
      heartbeat();
    };

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, handleActivity, { passive: true }));
    const interval = setInterval(tick, 1000);
    // The other tab already signed out on the server, so this tab only needs to leave the page.
    const stopListening = onSignOutInOtherTab((url) => {
      stop();
      router.replace(url);
    });
    // Signing out in this tab (the Sign out button): stop the timer; signOut() does the navigation.
    const stopListeningHere = onSignOutInThisTab(stop);

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, handleActivity));
      clearInterval(interval);
      clearTimeout(heartbeatTimer);
      stopListening();
      stopListeningHere();
    };
  }, [settings]);

  return (
    <SessionStatusContext.Provider value={status}>
      {children}
      {settings && showWarning && (
        // The pages set their font on <main>; this dialog is outside it, so it sets the same font itself.
        <div style={{ fontFamily: "sans-serif" }}>
          <Dialog title="Are you still there?">
            <p>You'll be signed out in {minutesText(Math.round(settings.warningBeforeMs / 60000))} for your privacy.</p>
            <button
              type="button"
              onClick={() => staySignedInRef.current()}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: TEAL, color: "white", fontWeight: "bold", cursor: "pointer" }}
            >
              Stay signed in
            </button>
          </Dialog>
        </div>
      )}
    </SessionStatusContext.Provider>
  );
}

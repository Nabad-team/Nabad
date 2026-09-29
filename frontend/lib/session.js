// Shared sign-in session helpers used by the inactivity timer and the Sign out button.
// localStorage is shared by every open tab, so writing a key here is how tabs talk to each other:
// activity in any tab keeps all tabs signed in, and signing out in one tab signs out all of them.

import Router from "next/router";
import { logout } from "./api";

export const LAST_ACTIVITY_KEY = "nabad-last-activity";
export const SIGN_OUT_KEY = "nabad-signout";
const THIS_TAB_SIGN_OUT_EVENT = "nabad-signout-this-tab";

// Where each kind of sign-out sends the user.
export function inactivityLoginUrl(idleTimeoutMs) {
  return "/login?reason=inactivity&minutes=" + Math.round(idleTimeoutMs / 60000);
}
export const SESSION_ENDED_LOGIN_URL = "/login?reason=expired";
// Where a page that needs sign-in sends a signed-out visitor; they come back here after logging in.
export function signInRequiredUrl(path) {
  return "/login?next=" + encodeURIComponent(path);
}

// The page to open after logging in. Only a path on our own site is allowed, never an outside URL
// (otherwise a link like /login?next=https://evil.example could send users to a fake site).
// The URL parser applies the same rules as the browser, so tricks like "//evil.example",
// "/\evil.example" or a hidden tab in "/\t/evil.example" are caught too.
const SAFE_BASE = "https://nabad.invalid";
export function safeNextPath(next, fallback = "/dashboard") {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  let url;
  try {
    url = new URL(next, SAFE_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== SAFE_BASE) return fallback;
  return url.pathname + url.search + url.hash;
}

// "1 minute", "30 minutes".
export function minutesText(minutes) {
  return minutes + (minutes === 1 ? " minute" : " minutes");
}

// Remembers "the user did something just now" for all tabs.
export function recordActivity(time = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(time));
  } catch {}
}

export function lastActivity() {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

// Ends the session on the server (which also invalidates the cookie for every tab),
// tells this tab and the other tabs, then goes to the login page.
export async function signOut(url = "/login") {
  // "storage" events only reach the other tabs, so this tab is told with its own event.
  // It comes first so pages that need sign-in hide their content straight away.
  window.dispatchEvent(new Event(THIS_TAB_SIGN_OUT_EVENT));
  try {
    await logout();
  } catch {}
  try {
    // A new value every time, so the other tabs always get a "storage" event.
    localStorage.setItem(SIGN_OUT_KEY, JSON.stringify({ url, at: Date.now() }));
  } catch {}
  Router.replace(url);
}

// Runs onSignOut(url) when another tab signs out. Returns a function that stops listening.
export function onSignOutInOtherTab(onSignOut) {
  function handleStorage(event) {
    if (event.key !== SIGN_OUT_KEY || !event.newValue) return;
    let url = "/login";
    try {
      url = JSON.parse(event.newValue).url || url;
    } catch {}
    onSignOut(url);
  }
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

// Runs onSignOut() when signOut() is called in this tab. Returns a function that stops listening.
export function onSignOutInThisTab(onSignOut) {
  window.addEventListener(THIS_TAB_SIGN_OUT_EVENT, onSignOut);
  return () => window.removeEventListener(THIS_TAB_SIGN_OUT_EVENT, onSignOut);
}

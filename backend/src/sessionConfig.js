// The one place where session timeouts are configured.
// Defaults: signed out after 30 minutes of inactivity, and after 12 hours no matter what.
// For a live demo, override them in backend/.env, e.g. SESSION_IDLE_TIMEOUT=2m and SESSION_WARNING_BEFORE=1m.
// The frontend reads these values from GET /api/auth/session, so they are never duplicated there.

// Turns "30m", "12h", "90s" or "1d" into milliseconds.
function durationToMs(value, fallback = 15 * 60 * 1000) {
  const match = String(value || "").trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const multiplier = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[match[2].toLowerCase()];
  return amount * multiplier;
}

// Read on every call (not once at startup) so tests can change them.
function sessionConfig() {
  return {
    // Signed out this long after the last activity (sliding expiry).
    idleTimeoutMs: durationToMs(process.env.SESSION_IDLE_TIMEOUT, 30 * 60 * 1000),
    // Signed out this long after signing in, even if active.
    absoluteTimeoutMs: durationToMs(process.env.SESSION_ABSOLUTE_TIMEOUT, 12 * 60 * 60 * 1000),
    // How long before the idle sign-out the browser shows the warning dialog.
    warningBeforeMs: durationToMs(process.env.SESSION_WARNING_BEFORE, 2 * 60 * 1000),
  };
}

module.exports = { durationToMs, sessionConfig };

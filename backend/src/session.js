const jwt = require("jsonwebtoken");
const { cookieOptions } = require("./config");
const { sessionConfig } = require("./sessionConfig");

// Time left in a session: the idle timeout, but never past the 12-hour maximum.
function sessionLifetimeMs(sessionStart) {
  const { idleTimeoutMs, absoluteTimeoutMs } = sessionConfig();
  return Math.min(idleTimeoutMs, sessionStart + absoluteTimeoutMs - Date.now());
}

// sessionStart (ms) is when the user signed in. It is kept in the token as "sst"
// so the 12-hour maximum still applies after the token is renewed.
function signAccessToken(user, sessionStart = Date.now()) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  const expiresInSeconds = Math.max(1, Math.floor(sessionLifetimeMs(sessionStart) / 1000));
  return jwt.sign({ sub: user._id, ver: user.authVersion || 0, sst: Math.floor(sessionStart / 1000) }, process.env.JWT_SECRET, { expiresIn: expiresInSeconds });
}
function setAuthCookie(res, token) {
  const { exp } = jwt.decode(token);
  res.cookie("accessToken", token, { ...cookieOptions(), maxAge: exp * 1000 - Date.now() });
}

module.exports = { signAccessToken, setAuthCookie };

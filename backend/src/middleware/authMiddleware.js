
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { signAccessToken, setAuthCookie } = require("../session");
const { sessionConfig } = require("../sessionConfig");

// Protects a route: requires a valid access token cookie.
// Each successful request renews the cookie for another idle period (sliding expiry),
// but a session never lasts longer than the absolute maximum (12 hours by default).
async function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    // A pending 2FA challenge must never authenticate a protected request.
    if (payload.purpose || typeof payload.sub !== "string") return res.status(401).json({ error: "Not authenticated." });
    const user = await User.findById(payload.sub).select("authVersion");
    if (!user || (payload.ver || 0) !== (user.authVersion || 0)) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    // Tokens issued before this change have no "sst", so their issue time counts as the session start.
    const sessionStart = (payload.sst || payload.iat) * 1000;
    if (Date.now() - sessionStart >= sessionConfig().absoluteTimeoutMs) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    setAuthCookie(res, signAccessToken(user, sessionStart));
    req.userId = payload.sub;
    req.sessionStart = sessionStart;
    next();
  } catch (err) {
    if (!["JsonWebTokenError", "TokenExpiredError", "NotBeforeError", "CastError"].includes(err.name)) return next(err);
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

module.exports = { requireAuth };

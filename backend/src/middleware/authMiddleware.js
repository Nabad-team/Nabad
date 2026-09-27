
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protects a route: requires a valid access token cookie.
async function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("authVersion");
    if (!user || (payload.ver || 0) !== (user.authVersion || 0)) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

module.exports = { requireAuth };

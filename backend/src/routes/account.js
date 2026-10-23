const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { buildExport } = require("../dataExport");
const { checkUserPassword } = require("../passwordHashing");
const { MAX_BYTES: MAX_PASSWORD_BYTES } = require("../passwordPolicy");
const { requireAuth } = require("../middleware/authMiddleware");
const { cookieOptions } = require("../config");
const { sendEmail } = require("../email");
const { logEvent } = require("../logger");

// "Download my data" (story #72). The user first confirms it's them (POST /export/confirm: the password, or the email
// for Google-only accounts, like account deletion), which allows one download in the next few minutes from this
// session (GET /export). The user is emailed after every download. Only the event and the file's size are logged.
const router = express.Router();
router.use(requireAuth);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const CONFIRM_MINUTES = 5;
const CONFIRM_COOKIE = "dataExportConfirm";
const CONFIRM_PURPOSE = "data_export";
const EXPORTS_PER_HOUR = 3;
// Keyed by account (requireAuth runs first), so a stolen session can't guess the password.
const confirmLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyGenerator: (req) => req.userId, message: { error: "Too many attempts. Please wait 15 minutes and try again." } });
// Only downloads that happened count.
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: EXPORTS_PER_HOUR, keyGenerator: (req) => req.userId, skipFailedRequests: true,
  message: { error: `You can download your data up to ${EXPORTS_PER_HOUR} times an hour. Please try again later.` },
});

// Sent only to the export routes.
const confirmCookieOptions = () => ({ ...cookieOptions(), path: "/api/account/export" });
const sessionStartSeconds = (req) => Math.floor(req.sessionStart / 1000);
const CONFIRM_REQUIRED = { error: "Please confirm it's you before downloading your data.", confirmRequired: true };

// The confirmation is for this account, this session and its current sign-ins (a password change signs out every
// session and ends it too).
function confirmed(req, user) {
  try {
    const payload = jwt.verify(req.cookies?.[CONFIRM_COOKIE] || "", process.env.JWT_SECRET, { algorithms: ["HS256"] });
    return payload.purpose === CONFIRM_PURPOSE && payload.sub === req.userId
      && payload.ver === (user.authVersion || 0) && payload.sst === sessionStartSeconds(req);
  } catch {
    return false;
  }
}

// Body: { password } or, for Google-only accounts, { email }.
router.post("/export/confirm", confirmLimiter, asyncRoute(async (req, res) => {
  const { password, email } = req.body || {};
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  if (user.authProvider === "google") {
    if (typeof email !== "string" || email.trim().toLowerCase() !== user.email) return res.status(400).json({ error: "Email does not match." });
  } else if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES || !(await checkUserPassword(user, password))) {
    return res.status(400).json({ error: "Password is incorrect." });
  }
  const token = jwt.sign(
    { sub: req.userId, purpose: CONFIRM_PURPOSE, ver: user.authVersion || 0, sst: sessionStartSeconds(req) },
    process.env.JWT_SECRET,
    { expiresIn: CONFIRM_MINUTES * 60 }
  );
  res.cookie(CONFIRM_COOKIE, token, { ...confirmCookieOptions(), maxAge: CONFIRM_MINUTES * 60 * 1000 });
  return res.status(204).end();
}));

router.get("/export", exportLimiter, asyncRoute(async (req, res) => {
  const user = await User.findById(req.userId).select("email authVersion");
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  if (!confirmed(req, user)) return res.status(403).json(CONFIRM_REQUIRED);
  const now = new Date();
  const data = await buildExport(user._id, now);
  if (!data) return res.status(401).json({ error: "Not authenticated." });
  const body = JSON.stringify(data, null, 2);
  // One download per confirmation.
  res.clearCookie(CONFIRM_COOKIE, confirmCookieOptions());
  res.set({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="nabad-data-${now.toISOString().slice(0, 10)}.json"`,
    "Cache-Control": "no-store",
  });
  res.send(body);
  logEvent("data_exported", { requestId: req.requestId, bytes: Buffer.byteLength(body, "utf8") });
  sendEmail(req, {
    to: user.email,
    subject: "A copy of your Nabad data was downloaded",
    text: [
      "A copy of your Nabad data was downloaded. If this wasn't you, change your password.",
      `When: ${now.toUTCString()}`,
    ].join("\n\n"),
  }, "data_export_email_not_sent");
}));

module.exports = router;
module.exports.EXPORTS_PER_HOUR = EXPORTS_PER_HOUR;
module.exports.CONFIRM_COOKIE = CONFIRM_COOKIE;

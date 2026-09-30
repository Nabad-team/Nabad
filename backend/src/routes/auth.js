const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const { signAccessToken, setAuthCookie } = require("../session");
const { sessionConfig } = require("../sessionConfig");
const { cookieOptions, twoFactorOnSignup, TRUSTED_DEVICE_COOKIE, trustedDeviceCookieOptions } = require("../config");
const { logEvent, logError } = require("../logger");
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const router = express.Router();
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const TWO_FACTOR_CODE_TTL_MS = 10 * 60 * 1000;
const TWO_FACTOR_RESEND_MS = 60 * 1000;
const TWO_FACTOR_MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const GOOGLE_2FA_MESSAGE = "Google accounts are protected by Google sign-in and do not use email codes.";
const SMTP_TIMEOUT_MS = 10 * 1000;
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRUSTED_DEVICES = 10;

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many login attempts. Try again later." } });
const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many verification attempts. Try again later." } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: "Too many reset attempts. Try again later." } });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: "Too many signup attempts. Try again later." } });
const googleLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many Google sign-in attempts. Try again later." } });

function hash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function mailer() {
  const from = process.env.MAIL_FROM || process.env.EMAIL_FROM;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !from) throw new Error("Email delivery is not configured.");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", requireTLS: cookieOptions().secure,
    connectionTimeout: SMTP_TIMEOUT_MS, greetingTimeout: SMTP_TIMEOUT_MS, socketTimeout: SMTP_TIMEOUT_MS,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
// Email is never awaited by a request: a slow or blocked SMTP server must not hold the response.
// Only the error name and code are logged; SMTP error messages can echo server responses.
function logEmailFailure(req, error) {
  logEvent("email_failed", { requestId: req?.requestId, errorType: error?.name || "Error", errorCode: error?.code });
}
function sendInBackground(req, transport, message) {
  transport.sendMail(message).catch((error) => logEmailFailure(req, error));
}
function generateTwoFactorCode() { return crypto.randomInt(0, 1000000).toString().padStart(6, "0"); }
async function issueTwoFactorCode(req, user) {
  const now = Date.now();
  if (user.twoFactorCodeLastSent && now - user.twoFactorCodeLastSent.getTime() < TWO_FACTOR_RESEND_MS) {
    const error = new Error("Please wait before requesting another verification code.");
    error.status = 429;
    error.retryAfter = Math.ceil((TWO_FACTOR_RESEND_MS - (now - user.twoFactorCodeLastSent.getTime())) / 1000);
    throw error;
  }
  const transport = mailer();
  const code = generateTwoFactorCode();
  user.twoFactorCodeHash = hash(code);
  user.twoFactorCodeExpires = new Date(now + TWO_FACTOR_CODE_TTL_MS);
  user.twoFactorCodeAttempts = 0;
  user.twoFactorCodeLastSent = new Date(now);
  await user.save();
  sendInBackground(req, transport, {
    from: process.env.MAIL_FROM || process.env.EMAIL_FROM,
    to: user.email,
    subject: "Your Nabad verification code",
    text: "Your Nabad verification code is " + code + ". It expires in 10 minutes and can be used only once."
  });
}
function twoFactorChallenge(user) {
  return jwt.sign({ sub: user._id, purpose: "2fa", ver: user.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "10m" });
}
// True when the request carries a remembered-device token for this user that has not expired.
function isTrustedDevice(user, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  const candidate = Buffer.from(hash(token));
  return (user.trustedDevices || []).some((device) => device.expiresAt > new Date() && crypto.timingSafeEqual(Buffer.from(device.tokenHash), candidate));
}
// Stores a hash of a new random token (keeping the newest MAX_TRUSTED_DEVICES) and gives the browser the token.
async function rememberDevice(user, res) {
  const token = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ _id: user._id }, { $pull: { trustedDevices: { expiresAt: { $lte: new Date() } } } });
  await User.updateOne({ _id: user._id }, { $push: { trustedDevices: { $each: [{ tokenHash: hash(token), expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS) }], $sort: { expiresAt: 1 }, $slice: -MAX_TRUSTED_DEVICES } } });
  res.cookie(TRUSTED_DEVICE_COOKIE, token, { ...trustedDeviceCookieOptions(), maxAge: TRUSTED_DEVICE_TTL_MS });
}
async function completeTwoFactor(challenge, code, res, remember) {
  const payload = jwt.verify(challenge, process.env.JWT_SECRET);
  if (payload.purpose !== "2fa") throw new Error("Invalid verification challenge.");
  const user = await User.findById(payload.sub);
  if (!user || (payload.ver || 0) !== (user.authVersion || 0) || !user.twoFactorEnabled || !user.twoFactorCodeHash || !user.twoFactorCodeExpires) throw new Error("Invalid or expired verification code.");
  if (user.twoFactorCodeExpires.getTime() <= Date.now()) {
    user.twoFactorCodeHash = null; user.twoFactorCodeExpires = null; user.twoFactorCodeAttempts = 0; await user.save();
    throw new Error("This verification code has expired. Request a new code.");
  }
  const candidate = hash(code);
  const valid = /^\d{6}$/.test(String(code || "")) && crypto.timingSafeEqual(Buffer.from(user.twoFactorCodeHash), Buffer.from(candidate));
  if (!valid) {
    user.twoFactorCodeAttempts = (user.twoFactorCodeAttempts || 0) + 1;
    if (user.twoFactorCodeAttempts >= TWO_FACTOR_MAX_ATTEMPTS) {
      user.twoFactorCodeHash = null; user.twoFactorCodeExpires = null; user.twoFactorCodeAttempts = 0; await user.save();
      throw new Error("Too many incorrect attempts. This verification code has been cancelled. Request a new code.");
    }
    await user.save();
    throw new Error("Invalid verification code.");
  }
  const verifiedUser = await User.findOneAndUpdate(
    { _id: user._id, authVersion: user.authVersion || 0, twoFactorEnabled: true, twoFactorCodeHash: candidate, twoFactorCodeExpires: { $gt: new Date() } },
    { $set: { twoFactorCodeHash: null, twoFactorCodeExpires: null, twoFactorCodeAttempts: 0, twoFactorCodeLastSent: null } },
    { new: true }
  );
  if (!verifiedUser) throw new Error("Invalid or expired verification code.");
  if (remember === true) await rememberDevice(verifiedUser, res);
  setAuthCookie(res, signAccessToken(verifiedUser));
  return { id: verifiedUser._id, name: verifiedUser.name, email: verifiedUser.email };
}

async function exchangeGoogleCode(code) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) throw new Error("Google sign-in is not configured.");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code" })
  });
  if (!tokenResponse.ok) throw new Error("Google authorization failed.");
  const tokens = await tokenResponse.json();
  const infoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + tokens.access_token } });
  if (!infoResponse.ok) throw new Error("Unable to verify Google account.");
  const profile = await infoResponse.json();
  if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error("Google account email could not be verified.");
  if (!tokens.id_token) throw new Error("Google identity verification failed.");
  const tokenInfo = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(tokens.id_token));
  if (!tokenInfo.ok) throw new Error("Google identity verification failed.");
  const verified = await tokenInfo.json();
  if (verified.aud !== process.env.GOOGLE_CLIENT_ID || verified.sub !== profile.sub) throw new Error("Google identity verification failed.");
  return { googleId: profile.sub, email: profile.email.trim().toLowerCase(), name: String(profile.name || profile.email.split("@")[0]).trim() };
}

router.post("/signup", signupLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 || typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Name, email, and password are required." });
    if (!validator.isEmail(email)) return res.status(400).json({ error: "Please provide a valid email." });
    if (password.length < 8 || Buffer.byteLength(password) > 72) return res.status(400).json({ error: "Password must be at least 8 characters and at most 72 bytes." });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ error: "An account with this email already exists." });
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), twoFactorEnabled: twoFactorOnSignup() });
    setAuthCookie(res, signAccessToken(user));
    return res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { logError(req, err); if (err.code === 11000) return res.status(409).json({ error: "An account with this email already exists." }); return res.status(500).json({ error: "Something went wrong. Please try again." }); }
});

router.get("/google", googleLimiter, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) return res.status(503).json({ error: "Google sign-in is not configured." });
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie("googleOAuthState", state, { ...cookieOptions(), maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.GOOGLE_REDIRECT_URI, response_type: "code", scope: "openid email profile", state, access_type: "online", prompt: "select_account" });
  return res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
});

router.get("/google/callback", googleLimiter, async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== req.cookies?.googleOAuthState) return res.status(400).send("Google sign-in could not be verified.");
    res.clearCookie("googleOAuthState", cookieOptions());
    const profile = await exchangeGoogleCode(code);
    let user = await User.findOne({ googleId: profile.googleId });
    if (!user) {
      // Never link by email: signup does not prove email ownership, so a matching account may not belong to this Google user.
      const existing = await User.findOne({ email: profile.email }).select("googleId");
      if (existing) {
        logEvent("google_signin_refused", { requestId: req.requestId, reason: existing.googleId ? "google_id_conflict" : "email_exists", userId: String(existing._id) });
        return res.redirect(process.env.CLIENT_ORIGIN + "/login?error=" + (existing.googleId ? "google_signin_failed" : "google_account_exists"));
      }
      user = await User.create({ name: profile.name, email: profile.email, googleId: profile.googleId, authProvider: "google", passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12) });
    }
    // No email code here: Google has already verified the person, with its own 2-step verification.
    setAuthCookie(res, signAccessToken(user));
    return res.redirect(process.env.CLIENT_ORIGIN + "/dashboard");
  } catch (err) {
    logError(req, err);
    return res.redirect((process.env.CLIENT_ORIGIN || "http://localhost:3000") + "/login?error=google_signin_failed");
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || !email || typeof password !== "string" || !password || Buffer.byteLength(password) > 72) return res.status(400).json({ error: "Email and password are required." });
    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    const genericError = { error: "Invalid email or password." };
    if (!user) return res.status(401).json(genericError);
    if (user.isLocked()) return res.status(423).json({ error: "Account temporarily locked due to failed attempts. Try again later." });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) { user.lockUntil = new Date(Date.now() + LOCK_TIME_MS); user.failedLoginAttempts = 0; }
      await user.save();
      return res.status(401).json(genericError);
    }
    user.failedLoginAttempts = 0; user.lockUntil = null; await user.save();
    if (user.twoFactorEnabled && !isTrustedDevice(user, req.cookies?.[TRUSTED_DEVICE_COOKIE])) {
      await issueTwoFactorCode(req, user);
      return res.json({ twoFactorRequired: true, challenge: twoFactorChallenge(user), codeDelivery: "email", expiresInSeconds: 600 });
    }
    setAuthCookie(res, signAccessToken(user));
    return res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    logError(req, err);
    if (err.status === 429) return res.status(429).json({ error: err.message, retryAfter: err.retryAfter });
    if (err.message === "Email delivery is not configured.") return res.status(503).json({ error: "Two-factor email delivery is not configured." });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/2fa/verify", codeLimiter, async (req, res) => {
  try { return res.json({ user: await completeTwoFactor(req.body.challenge, req.body.code, res, req.body.rememberDevice) }); }
  catch (err) { return res.status(401).json({ error: err.message || "Invalid or expired verification code." }); }
});

router.post("/2fa/resend", codeLimiter, async (req, res) => {
  try {
    const payload = jwt.verify(req.body.challenge, process.env.JWT_SECRET);
    if (payload.purpose !== "2fa") return res.status(401).json({ error: "Invalid verification challenge." });
    const user = await User.findById(payload.sub);
    if (!user || (payload.ver || 0) !== (user.authVersion || 0) || !user.twoFactorEnabled) return res.status(401).json({ error: "Invalid verification challenge." });
    await issueTwoFactorCode(req, user);
    return res.json({ message: "A new verification code was sent.", expiresInSeconds: 600 });
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: err.message, retryAfter: err.retryAfter });
    return res.status(401).json({ error: err.message || "Unable to send a new verification code." });
  }
});

router.post("/2fa/setup", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.authProvider === "google") return res.status(400).json({ error: GOOGLE_2FA_MESSAGE });
    await issueTwoFactorCode(req, user);
    return res.json({ message: "A verification code was sent to your email.", expiresInSeconds: 600 });
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: err.message, retryAfter: err.retryAfter });
    return res.status(503).json({ error: "Unable to send the verification code." });
  }
});

router.post("/2fa/enable", codeLimiter, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user?.authProvider === "google") return res.status(400).json({ error: GOOGLE_2FA_MESSAGE });
    if (!user || !user.twoFactorCodeHash || !user.twoFactorCodeExpires) return res.status(400).json({ error: "Start two-factor setup first." });
    if (user.twoFactorCodeExpires.getTime() <= Date.now()) return res.status(400).json({ error: "The verification code has expired. Start setup again." });
    const candidate = hash(req.body.code);
    const valid = /^\d{6}$/.test(String(req.body.code || "")) && crypto.timingSafeEqual(Buffer.from(user.twoFactorCodeHash), Buffer.from(candidate));
    if (!valid) {
      user.twoFactorCodeAttempts = (user.twoFactorCodeAttempts || 0) + 1;
      if (user.twoFactorCodeAttempts >= TWO_FACTOR_MAX_ATTEMPTS) { user.twoFactorCodeHash = null; user.twoFactorCodeExpires = null; user.twoFactorCodeAttempts = 0; }
      await user.save();
      return res.status(400).json({ error: user.twoFactorCodeHash ? "Invalid verification code." : "Too many incorrect attempts. The verification code has been cancelled." });
    }
    user.twoFactorEnabled = true; user.twoFactorCodeHash = null; user.twoFactorCodeExpires = null; user.twoFactorCodeAttempts = 0; user.twoFactorCodeLastSent = null;
    await user.save();
    return res.json({ twoFactorEnabled: true });
  } catch (err) { return res.status(400).json({ error: err.message || "Unable to enable two-factor authentication." }); }
});

router.post("/2fa/disable", codeLimiter, requireAuth, asyncRoute(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user || !user.twoFactorEnabled) return res.status(400).json({ error: "Two-factor authentication is not enabled." });
  if (!(await bcrypt.compare(req.body.password || "", user.passwordHash))) return res.status(400).json({ error: "Password is incorrect." });
  user.twoFactorEnabled = false; user.twoFactorCodeHash = null; user.twoFactorCodeExpires = null; user.twoFactorCodeAttempts = 0; user.twoFactorCodeLastSent = null;
  user.trustedDevices = [];
  await user.save();
  res.clearCookie(TRUSTED_DEVICE_COOKIE, trustedDeviceCookieOptions());
  return res.json({ twoFactorEnabled: false });
}));

// A new token overwrites the previous hash, so only the latest link works.
async function sendPasswordReset(email, transport) {
  const user = await User.findOne({ email });
  if (!user) return;
  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordTokenHash = hash(token); user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS); await user.save();
  const origin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.EMAIL_FROM, to: user.email, subject: "Reset your Nabad password", text: "Use this link within one hour to reset your password: " + origin + "/reset-password?token=" + token });
}

router.post("/forgot-password", resetLimiter, (req, res) => {
  const generic = { message: "If an account matches that email, reset instructions will be sent." };
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!validator.isEmail(email)) return res.json(generic);
  let transport;
  try { transport = mailer(); } catch (err) { logError(req, err); return res.status(503).json({ error: "Password reset email is temporarily unavailable. Please try again later." }); }
  // Respond before the account lookup so the reply and its timing are the same whether or not the email exists.
  res.json(generic);
  sendPasswordReset(email, transport).catch((error) => logEmailFailure(req, error));
});

router.post("/reset-password", resetLimiter, asyncRoute(async (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== "string" || !token || typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) return res.status(400).json({ error: "A reset link and a password of 8 characters to 72 bytes are required." });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { resetPasswordTokenHash: hash(token), resetPasswordExpires: { $gt: new Date() } },
    { $set: { passwordHash, resetPasswordTokenHash: null, resetPasswordExpires: null, failedLoginAttempts: 0, lockUntil: null, twoFactorCodeHash: null, twoFactorCodeExpires: null, trustedDevices: [] }, $inc: { authVersion: 1 } }
  );
  if (!user) return res.status(400).json({ error: "This reset link is invalid or expired. Request a new one." });
  return res.json({ message: "Password updated. You can now log in." });
}));

router.post("/logout", asyncRoute(async (req, res) => {
  const token = req.cookies?.accessToken;
  if (token) {
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }); } catch {}
    if (payload && !payload.purpose && typeof payload.sub === "string" && /^[a-f0-9]{24}$/i.test(payload.sub)) {
      // A stale cookie must not repeatedly revoke newer sessions. Preserve the team's all-device logout.
      await User.updateOne({ _id: payload.sub, $or: [{ authVersion: payload.ver || 0 }, ...((payload.ver || 0) === 0 ? [{ authVersion: { $exists: false } }] : [])] }, { $inc: { authVersion: 1 } });
    }
  }
  res.clearCookie("accessToken", cookieOptions());
  return res.json({ message: "Logged out." });
}));

router.get("/me", requireAuth, asyncRoute(async (req, res) => {
  const user = await User.findById(req.userId).select("name email twoFactorEnabled authProvider onboardingCompleted");
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user });
}));

// Called by the browser's inactivity timer: confirms the user is signed in, renews the
// session (requireAuth re-issues the cookie) and tells the browser the timeout settings.
router.get("/session", requireAuth, (req, res) => {
  const { idleTimeoutMs, warningBeforeMs, absoluteTimeoutMs } = sessionConfig();
  return res.json({ idleTimeoutMs, warningBeforeMs, absoluteExpiresAt: req.sessionStart + absoluteTimeoutMs });
});

router.post("/onboarding/complete", requireAuth, asyncRoute(async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { onboardingCompleted: true });
  return res.json({ onboardingCompleted: true });
}));

module.exports = router;

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many login attempts. Try again later." } });
const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Too many code attempts. Try again later." } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: "Too many reset attempts. Try again later." } });

function signAccessToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  return jwt.sign({ sub: user._id, ver: user.authVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "15m" });
}
function setAuthCookie(res, token) {
  res.cookie("accessToken", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 15 * 60 * 1000 });
}
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function totpKey() {
  const key = process.env.TOTP_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error("TOTP_ENCRYPTION_KEY must be a 32-byte hex key.");
  return Buffer.from(key, "hex");
}
function encryptSecret(secret) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", totpKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}
function decryptSecret(value) {
  const [iv, tag, encrypted] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", totpKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
}
function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0; let value = 0; let output = "";
  for (const byte of buffer) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0; let value = 0; const output = [];
  for (const char of input.replace(/=+$/g, "")) { const index = alphabet.indexOf(char); if (index < 0) throw new Error("Invalid secret"); value = (value << 5) | index; bits += 5; if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(output);
}
function totp(secret, counter) {
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
function verifyTotp(secret, code) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  const current = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((drift) => crypto.timingSafeEqual(Buffer.from(totp(secret, current + drift)), Buffer.from(String(code))));
}
function mailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.MAIL_FROM) throw new Error("Email delivery is not configured.");
  return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required." });
    if (!validator.isEmail(email)) return res.status(400).json({ error: "Please provide a valid email." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "An account with this email already exists." });
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12) });
    setAuthCookie(res, signAccessToken(user));
    return res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { console.error("Signup error:", err); return res.status(500).json({ error: "Something went wrong. Please try again." }); }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const user = await User.findOne({ email: String(email).toLowerCase() });
    const genericError = { error: "Invalid email or password." };
    if (!user) return res.status(401).json(genericError);
    if (user.isLocked()) return res.status(423).json({ error: "Account temporarily locked due to failed attempts. Try again later." });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) { user.lockUntil = new Date(Date.now() + LOCK_TIME_MS); user.failedLoginAttempts = 0; }
      await user.save(); return res.status(401).json(genericError);
    }
    user.failedLoginAttempts = 0; user.lockUntil = null; await user.save();
    if (user.twoFactorEnabled) {
      const challenge = jwt.sign({ sub: user._id, purpose: "2fa" }, process.env.JWT_SECRET, { expiresIn: "5m" });
      return res.json({ twoFactorRequired: true, challenge });
    }
    setAuthCookie(res, signAccessToken(user));
    return res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { console.error("Login error:", err); return res.status(500).json({ error: "Something went wrong. Please try again." }); }
});

router.post("/2fa/verify", codeLimiter, async (req, res) => {
  try {
    const payload = jwt.verify(req.body.challenge, process.env.JWT_SECRET);
    if (payload.purpose !== "2fa") return res.status(401).json({ error: "Invalid or expired sign-in challenge." });
    const user = await User.findById(payload.sub);
    if (!user || !user.twoFactorEnabled || !verifyTotp(decryptSecret(user.twoFactorSecret), req.body.code)) return res.status(401).json({ error: "Invalid or expired sign-in challenge or code." });
    setAuthCookie(res, signAccessToken(user));
    return res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch { return res.status(401).json({ error: "Invalid or expired sign-in challenge." }); }
});

router.post("/2fa/setup", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  const secret = base32Encode(crypto.randomBytes(20));
  try { user.twoFactorPendingSecret = encryptSecret(secret); } catch (err) { return res.status(503).json({ error: "Two-factor setup is not configured on this server." }); }
  await user.save();
  const label = encodeURIComponent(`Nabad:${user.email}`);
  return res.json({ secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=Nabad&algorithm=SHA1&digits=6&period=30` });
});
router.post("/2fa/enable", codeLimiter, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user || !user.twoFactorPendingSecret) return res.status(400).json({ error: "Start two-factor setup first." });
  let pendingSecret;
  try { pendingSecret = decryptSecret(user.twoFactorPendingSecret); } catch { return res.status(503).json({ error: "Two-factor setup is not configured on this server." }); }
  if (!verifyTotp(pendingSecret, req.body.code)) return res.status(400).json({ error: "Enter a valid code from your authenticator app." });
  user.twoFactorSecret = user.twoFactorPendingSecret; user.twoFactorPendingSecret = null; user.twoFactorEnabled = true; await user.save();
  return res.json({ twoFactorEnabled: true });
});
router.post("/2fa/disable", codeLimiter, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user || !user.twoFactorEnabled || !(await bcrypt.compare(req.body.password || "", user.passwordHash)) || !verifyTotp(decryptSecret(user.twoFactorSecret), req.body.code)) return res.status(400).json({ error: "Password or authenticator code is incorrect." });
  user.twoFactorEnabled = false; user.twoFactorSecret = null; user.twoFactorPendingSecret = null; await user.save();
  return res.json({ twoFactorEnabled: false });
});

router.post("/forgot-password", resetLimiter, async (req, res) => {
  const generic = { message: "If an account matches that email, reset instructions will be sent." };
  try {
    const transport = mailer();
    const email = String(req.body.email || "").toLowerCase();
    if (!validator.isEmail(email)) return res.json(generic);
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetPasswordTokenHash = hash(token); user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); await user.save();
      const origin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
      await transport.sendMail({ from: process.env.MAIL_FROM, to: user.email, subject: "Reset your Nabad password", text: `Use this link within one hour to reset your password: ${origin}/reset-password?token=${token}` });
    }
    return res.json(generic);
  } catch (err) { console.error("Password reset request error:", err.message); return res.status(503).json({ error: "Password reset email is temporarily unavailable. Please try again later." }); }
});
router.post("/reset-password", resetLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) return res.status(400).json({ error: "A reset link and a password of at least 8 characters are required." });
  const user = await User.findOne({ resetPasswordTokenHash: hash(token), resetPasswordExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: "This reset link is invalid or expired. Request a new one." });
  user.passwordHash = await bcrypt.hash(password, 12); user.authVersion = (user.authVersion || 0) + 1; user.resetPasswordTokenHash = null; user.resetPasswordExpires = null; user.failedLoginAttempts = 0; user.lockUntil = null; await user.save();
  return res.json({ message: "Password updated. You can now log in." });
});

router.post("/logout", (req, res) => { res.clearCookie("accessToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" }); return res.json({ message: "Logged out." }); });
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select("name email twoFactorEnabled");
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user });
});
module.exports = router;

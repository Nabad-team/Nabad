const crypto = require("crypto");
const User = require("./models/User");
const { UserError } = require("./userError");

// Brute-force protection for the email sign-in code (2FA), per account and stored in the database, so it
// holds across restarts, deploys, several server instances and any number of IP addresses:
//   - wrong codes are counted across every code sent; 10 within an hour lock the 2FA step for 30 minutes
//   - at most 5 codes are sent per hour, resends included
//   - codes are stored as HMAC-SHA256 with a server secret, so a database leak alone can't be used to test
//     the million possible codes against a stored hash
// Codes and their hashes are never logged.

const HOUR_MS = 60 * 60 * 1000;
const MAX_WRONG_CODES = 10;
const LOCK_MS = 30 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const LOCKED_MESSAGE = "Too many incorrect codes. For your security, please try again in 30 minutes.";

// TWO_FACTOR_CODE_SECRET is required in production (config.js). Elsewhere (development, tests) a random secret
// for this process is used when it isn't set: codes then stop working after a restart, which is fine there.
const fallbackSecret = crypto.randomBytes(32).toString("hex");
function codeSecret() {
  const secret = process.env.TWO_FACTOR_CODE_SECRET;
  return typeof secret === "string" && secret.trim() !== "" ? secret : fallbackSecret;
}
function hashCode(code) {
  return crypto.createHmac("sha256", codeSecret()).update(String(code)).digest("hex");
}
// Constant-time check of a typed code against the stored hash. Anything but 6 digits is wrong.
function codeMatches(code, storedHash) {
  if (!/^\d{6}$/.test(String(code || "")) || typeof storedHash !== "string") return false;
  const candidate = Buffer.from(hashCode(code));
  const stored = Buffer.from(storedHash);
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

const isLocked = (user, now = Date.now()) => Boolean(user.twoFactorLockedUntil && user.twoFactorLockedUntil.getTime() > now);
const lockedError = () => new UserError(LOCKED_MESSAGE, 429, { retryAfter: LOCK_MS / 1000 });

// Records one wrong code. Returns true only for the request that started a lockout (so the alert email is
// sent once per lockout), false otherwise. The counter is emptied when the lock starts: after it ends, the
// account starts again from zero.
async function recordWrongCode(userId) {
  const now = new Date();
  // Two updates: MongoDB can't $pull and $push the same array in one.
  await User.updateOne({ _id: userId }, { $pull: { twoFactorFailedAttempts: { $lte: new Date(now - HOUR_MS) } } });
  await User.updateOne({ _id: userId }, { $push: { twoFactorFailedAttempts: { $each: [now], $slice: -MAX_WRONG_CODES } } });
  const locked = await User.findOneAndUpdate(
    {
      _id: userId,
      [`twoFactorFailedAttempts.${MAX_WRONG_CODES - 1}`]: { $exists: true },
      $or: [{ twoFactorLockedUntil: null }, { twoFactorLockedUntil: { $lte: now } }],
    },
    { $set: { twoFactorLockedUntil: new Date(now.getTime() + LOCK_MS), twoFactorFailedAttempts: [] } },
  );
  return Boolean(locked);
}

// "1 minute", "12 minutes"
const minutesText = (ms) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
};

// Takes one of the account's 5 sends for this hour, or throws a 429 saying when the next one is possible.
// The condition and the push are one atomic update, so codes requested at the same moment can't exceed 5.
async function reserveCodeSend(userId) {
  const now = new Date();
  await User.updateOne({ _id: userId }, { $pull: { twoFactorCodeSends: { $lte: new Date(now - HOUR_MS) } } });
  const reserved = await User.updateOne(
    { _id: userId, [`twoFactorCodeSends.${MAX_SENDS_PER_HOUR - 1}`]: { $exists: false } },
    { $push: { twoFactorCodeSends: now } },
  );
  if (reserved.modifiedCount === 1) return;
  const user = await User.findById(userId).select("twoFactorCodeSends");
  const oldest = Math.min(...(user?.twoFactorCodeSends || [now]).map((date) => date.getTime()));
  const waitMs = oldest + HOUR_MS - now.getTime();
  throw new UserError(
    `For your security, we send at most ${MAX_SENDS_PER_HOUR} codes an hour. You can request a new code in ${minutesText(waitMs)}.`,
    429, { retryAfter: Math.max(1, Math.ceil(waitMs / 1000)) },
  );
}

// The security alert sent once when a lockout starts.
function lockoutAlert(user) {
  const origin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  return {
    from: process.env.MAIL_FROM || process.env.EMAIL_FROM,
    to: user.email,
    subject: "Incorrect sign-in codes on your Nabad account",
    text: "We noticed several incorrect sign-in codes on your Nabad account. If this wasn't you, reset your password.\n\n"
      + "You can reset it here: " + origin + "/forgot-password",
  };
}

module.exports = {
  HOUR_MS, MAX_WRONG_CODES, LOCK_MS, MAX_SENDS_PER_HOUR, LOCKED_MESSAGE,
  hashCode, codeMatches, isLocked, lockedError, recordWrongCode, reserveCodeSend, lockoutAlert,
};

// The one password check for every place a user picks a password: signup, reset-password and any future
// change-password. Follows NIST SP 800-63B and the OWASP Authentication Cheat Sheet: a minimum length,
// any characters allowed, no forced character mixes, and a blocklist of common, personal and breached passwords.
// The frontend mirrors these rules in frontend/lib/passwordPolicy.js; a frontend test checks they agree.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { logEvent } = require("./logger");

const MIN_LENGTH = 12;
// bcrypt only uses the first 72 bytes, so anything longer would be silently cut short. Rejecting instead
// keeps the whole password meaningful. In UTF-8 that is 72 English letters, about 36 Arabic letters, or 18 emoji.
const MAX_BYTES = 72;
// Shorter pieces of a name or email (like "al" or "jo") appear in too many ordinary words to block.
const MIN_PERSONAL_WORD = 3;
const BREACH_TIMEOUT_MS = 2000;

const PASSWORD_MESSAGES = {
  tooShort: "Your password needs at least 12 characters. A short sentence works great.",
  tooLong: "This password is too long. Please use a shorter one.",
  common: "This password is too common and easy to guess. Please choose a different one.",
  hasName: "Your password can't include your name. Please choose a different one.",
  hasEmail: "Your password can't include your email address. Please choose a different one.",
  hasSiteName: "Your password can't include the word \"Nabad\". Please choose a different one.",
  breached: "This password has appeared in a data leak on another website, so it isn't safe to use. Please choose a different one.",
};

// NFKC folds look-alike forms (such as Arabic presentation forms or full-width letters) into one form, and each
// Unicode code point counts as one character, as NIST asks. The password itself is hashed exactly as typed.
const normalize = (value) => value.normalize("NFKC");
const characterCount = (value) => Array.from(normalize(value)).length;
const comparable = (value) => normalize(value).toLowerCase();

const COMMON_PASSWORDS = new Set(
  fs.readFileSync(path.join(__dirname, "../data/common-passwords.txt"), "utf8").split(/\r?\n/).filter(Boolean).map(comparable)
);

// The whole value and its pieces split on anything that is not a letter or digit ("leen.elbaba" -> leen, elbaba).
function personalWords(value) {
  const whole = comparable(String(value || "").trim());
  return [whole, ...whole.split(/[^\p{L}\p{N}]+/u)].filter((word) => Array.from(word).length >= MIN_PERSONAL_WORD);
}

function problem(code) { return { code, message: PASSWORD_MESSAGES[code] }; }

// Every rule except the breach check, which needs the network. Returns null or { code, message }.
// name and email are the account's own, so a message never says anything about other accounts.
function findPasswordProblem(password, { name, email } = {}) {
  if (typeof password !== "string" || characterCount(password) < MIN_LENGTH) return problem("tooShort");
  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) return problem("tooLong");
  const candidate = comparable(password);
  if (COMMON_PASSWORDS.has(candidate)) return problem("common");
  if (personalWords(name).some((word) => candidate.includes(word))) return problem("hasName");
  if (personalWords(String(email || "").split("@")[0]).some((word) => candidate.includes(word))) return problem("hasEmail");
  if (candidate.includes("nabad")) return problem("hasSiteName");
  return null;
}

// Have I Been Pwned range search (k-anonymity): only the first 5 characters of the SHA-1 hash leave the server,
// and the match against the returned suffixes happens here. Add-Padding hides the real response size.
async function isBreachedPassword(password, { fetchImpl = fetch, timeoutMs = BREACH_TIMEOUT_MS } = {}) {
  const digest = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const response = await fetchImpl("https://api.pwnedpasswords.com/range/" + digest.slice(0, 5), {
    headers: { "Add-Padding": "true", "User-Agent": "Nabad-password-check" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) { const error = new Error("Breach check failed."); error.code = "HTTP_" + response.status; throw error; }
  const suffix = digest.slice(5);
  // Padding lines have a count of 0 and are not real matches.
  return (await response.text()).split("\n").some((line) => { const [hashSuffix, count] = line.trim().split(":"); return hashSuffix === suffix && Number(count) > 0; });
}

// On by default; off in tests unless PWNED_PASSWORDS_CHECK=on. PWNED_PASSWORDS_CHECK=off turns it off anywhere.
function breachCheckEnabled(env = process.env) {
  if (env.PWNED_PASSWORDS_CHECK === "on" || env.PWNED_PASSWORDS_CHECK === "off") return env.PWNED_PASSWORDS_CHECK === "on";
  return (env.APP_ENV || env.NODE_ENV) !== "test";
}

// All rules, then the breach check. If Have I Been Pwned is slow or down the password is allowed (the other
// rules still apply) and only the failure type is logged, never the password or any hash of it.
async function checkNewPassword(password, context = {}, { requestId, fetchImpl, breachCheck = breachCheckEnabled() } = {}) {
  const found = findPasswordProblem(password, context);
  if (found || !breachCheck) return found;
  try {
    return (await isBreachedPassword(password, { fetchImpl })) ? problem("breached") : null;
  } catch (error) {
    logEvent("breach_check_failed", { requestId, errorType: error?.name || "Error", errorCode: error?.code || error?.cause?.code });
    return null;
  }
}

module.exports = { checkNewPassword, findPasswordProblem, isBreachedPassword, breachCheckEnabled, PASSWORD_MESSAGES, MIN_LENGTH, MAX_BYTES, COMMON_PASSWORDS };

// The same password rules as backend/src/passwordPolicy.js, so the form can explain problems before submitting.
// The backend has the final say and also checks breached passwords, which the browser cannot.
// __tests__/passwordPolicy.test.js runs the backend list through both versions to keep them in step.
import { LONG_COMMON_PASSWORDS } from "./commonPasswords";

export const PASSWORD_MIN_LENGTH = 12;
// bcrypt's limit. Deliberately not mentioned in the help text; only shown if someone reaches it.
const PASSWORD_MAX_BYTES = 72;
const MIN_PERSONAL_WORD = 3;
export const PASSWORD_HELP = "Use at least 12 characters. A short sentence works great.";

export const PASSWORD_MESSAGES = {
  tooShort: "Your password needs at least 12 characters. A short sentence works great.",
  tooLong: "This password is too long. Please use a shorter one.",
  common: "This password is too common and easy to guess. Please choose a different one.",
  hasName: "Your password can't include your name. Please choose a different one.",
  hasEmail: "Your password can't include your email address. Please choose a different one.",
  hasSiteName: "Your password can't include the word \"Nabad\". Please choose a different one.",
};

const COMMON_PASSWORDS = new Set(LONG_COMMON_PASSWORDS);
const normalize = (value) => value.normalize("NFKC");
const comparable = (value) => normalize(value).toLowerCase();
export const characterCount = (value) => Array.from(normalize(value)).length;

// Same count as Node's Buffer.byteLength(value, "utf8"), including a lone surrogate as 3 bytes.
function utf8ByteLength(value) {
  return Array.from(value).reduce((length, character) => {
    const codePoint = character.codePointAt(0);
    return length + (codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4);
  }, 0);
}

function personalWords(value) {
  const whole = comparable(String(value || "").trim());
  return [whole, ...whole.split(/[^\p{L}\p{N}]+/u)].filter((word) => Array.from(word).length >= MIN_PERSONAL_WORD);
}

const isTooLong = (password) => utf8ByteLength(password) > PASSWORD_MAX_BYTES;
const isCommon = (password) => COMMON_PASSWORDS.has(comparable(password));
const hasName = (password, name) => personalWords(name).some((word) => comparable(password).includes(word));
const hasEmail = (password, email) => personalWords(String(email || "").split("@")[0]).some((word) => comparable(password).includes(word));
const hasSiteName = (password) => comparable(password).includes("nabad");

// null, or { code, message } for the first rule the password breaks. Same order as the backend.
export function findPasswordProblem(password, { name, email } = {}) {
  const problem = (code) => ({ code, message: PASSWORD_MESSAGES[code] });
  if (typeof password !== "string" || characterCount(password) < PASSWORD_MIN_LENGTH) return problem("tooShort");
  if (isTooLong(password)) return problem("tooLong");
  if (isCommon(password)) return problem("common");
  if (hasName(password, name)) return problem("hasName");
  if (hasEmail(password, email)) return problem("hasEmail");
  if (hasSiteName(password)) return problem("hasSiteName");
  return null;
}

// The live checklist. The personal item is shown only when the page knows the name and email (signup).
export function passwordChecklist(password, context) {
  const items = [
    { id: "length", label: "At least 12 characters", met: characterCount(password) >= PASSWORD_MIN_LENGTH },
    { id: "common", label: "Not a commonly used password", met: !isCommon(password) },
  ];
  if (context) {
    items.push({ id: "personal", label: "Doesn't include your name, your email, or \"Nabad\"", met: !hasName(password, context.name) && !hasEmail(password, context.email) && !hasSiteName(password) });
  }
  return items;
}

export function passwordIsTooLong(password) { return isTooLong(password); }

// Weak until every rule is met; after that, length is what makes a password stronger (NIST asks for 15 when
// the password is the only sign-in step), so 15+ characters is Strong.
export function getPasswordStrength(password, context) {
  if (!password) return null;
  if (findPasswordProblem(password, context)) return { label: "Weak", score: 1, color: "#b42318", detail: "It doesn't meet the rules yet." };
  if (characterCount(password) < 15) return { label: "Good", score: 3, color: "#4d7c0f", detail: "A few more words make it even stronger." };
  return { label: "Strong", score: 5, color: "#067647", detail: "Great choice." };
}

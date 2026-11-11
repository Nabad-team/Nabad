const { relaxedForScan } = require("./rateLimit");

// Production must not boot half-configured (e.g. password reset email silently broken).
const PRODUCTION_REQUIRED = ["MONGO_URI", "JWT_SECRET", "MONGO_DB_NAME", "CLIENT_ORIGIN", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM", "GOOGLE_REDIRECT_URI", "TWO_FACTOR_CODE_SECRET"];
// Staging (APP_ENV=staging, test data only) needs the same secrets, except Google sign-in, which stays off there
// unless it is configured. Its JWT and 2FA keys are its own, never production's.
const STAGING_REQUIRED = PRODUCTION_REQUIRED.filter((key) => key !== "GOOGLE_REDIRECT_URI");
// Google sign-in is optional, but only as a pair: one without the other is a misconfiguration.
const GOOGLE_CREDENTIALS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const present = (env, key) => typeof env[key] === "string" && env[key].trim() !== "";
// Names only: these are logged at startup, so they must never include a value.
function missingProductionVars(env, required = PRODUCTION_REQUIRED) {
  // MAIL_FROM is the legacy name for EMAIL_FROM and is still read by the mailer.
  return required.filter((key) => !present(env, key) && !(key === "EMAIL_FROM" && present(env, "MAIL_FROM")));
}
function missingGoogleCredentials(env = process.env) { return GOOGLE_CREDENTIALS.filter((key) => !present(env, key)); }
// Turns email 2FA on for new email/password accounts at signup. OFF unless set to exactly "true".
// Keep it off until signup verifies the email: a mistyped email would lock the user out at their next sign-in.
function twoFactorOnSignup(env = process.env) { return env.TWO_FACTOR_ON_SIGNUP === "true"; }
// Staging only: PR previews get a new Vercel URL each time, so besides CLIENT_ORIGIN staging accepts origins matching
// PREVIEW_ORIGIN_PATTERN, e.g. https://nabad-*-nabad3.vercel.app. The one "*" stands for letters, digits and
// hyphens inside a single DNS label, with fixed text on both sides; it never crosses a dot.
const PREVIEW_PATTERN_SHAPE = /^https:\/\/([a-z0-9-]+)\*([a-z0-9-]+)((?:\.[a-z0-9-]+)+)$/;
function previewOriginMatcher(pattern) {
  const parts = PREVIEW_PATTERN_SHAPE.exec(pattern);
  if (!parts) throw new Error("PREVIEW_ORIGIN_PATTERN must look like https://nabad-*-team.vercel.app (one * inside the first label, with text on both sides).");
  const escape = (text) => text.replace(/\./g, "\\.");
  const regex = new RegExp(`^https://${escape(parts[1])}[a-z0-9-]+${escape(parts[2])}${escape(parts[3])}$`);
  return (origin) => typeof origin === "string" && regex.test(origin);
}
function loadConfig(env = process.env) {
  const environment = env.APP_ENV || env.NODE_ENV || "development";
  if (!["development", "test", "staging", "production"].includes(environment)) throw new Error("Invalid APP_ENV.");
  if (env.APP_ENV === "production") {
    const missing = missingProductionVars(env);
    if (missing.length) throw new Error("Missing required environment variables: " + missing.join(", "));
    const missingGoogle = missingGoogleCredentials(env);
    if (missingGoogle.length === 1) throw new Error("Google sign-in is only partly configured. Set both or neither; missing: " + missingGoogle[0]);
  }
  if (env.APP_ENV === "staging") {
    const missingGoogle = missingGoogleCredentials(env);
    if (missingGoogle.length === 1) throw new Error("Google sign-in is only partly configured. Set both or neither; missing: " + missingGoogle[0]);
    const required = missingGoogle.length ? STAGING_REQUIRED : PRODUCTION_REQUIRED;
    const missing = missingProductionVars(env, required);
    if (missing.length) throw new Error("Missing required environment variables: " + missing.join(", "));
    if (env.MONGO_DB_NAME.trim() === "nabad_production") throw new Error("Staging must never use the production database.");
    if (env.JWT_SECRET.trim() === env.TWO_FACTOR_CODE_SECRET.trim()) throw new Error("JWT_SECRET and TWO_FACTOR_CODE_SECRET must be different.");
  }
  if (present(env, "PREVIEW_ORIGIN_PATTERN") && env.APP_ENV !== "staging") throw new Error("PREVIEW_ORIGIN_PATTERN is only allowed with APP_ENV=staging.");
  const isPreviewOrigin = present(env, "PREVIEW_ORIGIN_PATTERN") ? previewOriginMatcher(env.PREVIEW_ORIGIN_PATTERN.trim()) : () => false;
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required.");
  // The key for the HMAC of emailed sign-in codes (twoFactorProtection.js). Required in production (above).
  if (present(env, "TWO_FACTOR_CODE_SECRET") && env.TWO_FACTOR_CODE_SECRET.trim().length < 32) throw new Error("TWO_FACTOR_CODE_SECRET must contain at least 32 characters.");
  const clientOrigin = env.CLIENT_ORIGIN || "http://localhost:3000";
  const url = new URL(clientOrigin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== clientOrigin) throw new Error("CLIENT_ORIGIN must be an exact HTTP(S) origin.");
  const secure = ["staging", "production"].includes(environment);
  if (secure && url.protocol !== "https:") throw new Error("Hosted environments require an HTTPS CLIENT_ORIGIN.");
  // Explicit APP_ENV opts in to database isolation. Legacy deployments retain their URI database.
  if (env.APP_ENV && secure && (!env.MONGO_DB_NAME || !env.MONGO_DB_NAME.endsWith(`_${environment}`))) {
    throw new Error("MONGO_DB_NAME must end with the selected environment, such as nabad_staging.");
  }
  if (![undefined, "", "true", "false"].includes(env.TWO_FACTOR_ON_SIGNUP)) throw new Error('TWO_FACTOR_ON_SIGNUP must be "true" or "false".');
  if (![undefined, "", "on", "off"].includes(env.PWNED_PASSWORDS_CHECK)) throw new Error('PWNED_PASSWORDS_CHECK must be "on" or "off".');
  // The PR security scan loosens every rate limit; never on staging or production (rateLimit.js throws for those).
  relaxedForScan(env);
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error("TRUST_PROXY must be a whole number of proxy hops.");
  // Writes (POST, PUT, PATCH, DELETE) are only accepted from these origins (app.js).
  const isAllowedOrigin = (origin) => origin === clientOrigin || isPreviewOrigin(origin);
  return { environment, secure, clientOrigin, databaseName: env.MONGO_DB_NAME, trustProxy, isAllowedOrigin };
}
function cookieOptions() {
  const environment = process.env.APP_ENV || process.env.NODE_ENV;
  return { httpOnly: true, secure: ["staging", "production"].includes(environment), sameSite: "lax", path: "/" };
}
// "Remember this device" cookie: always Secure, and sent only to the auth routes that read it.
const TRUSTED_DEVICE_COOKIE = "trustedDevice";
function trustedDeviceCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth" };
}
module.exports = { loadConfig, cookieOptions, missingGoogleCredentials, twoFactorOnSignup, TRUSTED_DEVICE_COOKIE, trustedDeviceCookieOptions };

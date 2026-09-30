// Production must not boot half-configured (e.g. reset email or Google sign-in silently broken).
const PRODUCTION_REQUIRED = ["MONGO_URI", "JWT_SECRET", "MONGO_DB_NAME", "CLIENT_ORIGIN", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];
// Names only: the error is logged at startup, so it must never include a value.
function missingProductionVars(env) {
  const present = (key) => typeof env[key] === "string" && env[key].trim() !== "";
  // MAIL_FROM is the legacy name for EMAIL_FROM and is still read by the mailer.
  return PRODUCTION_REQUIRED.filter((key) => !present(key) && !(key === "EMAIL_FROM" && present("MAIL_FROM")));
}
function loadConfig(env = process.env) {
  const environment = env.APP_ENV || env.NODE_ENV || "development";
  if (!["development", "test", "staging", "production"].includes(environment)) throw new Error("Invalid APP_ENV.");
  if (env.APP_ENV === "production") {
    const missing = missingProductionVars(env);
    if (missing.length) throw new Error("Missing required environment variables: " + missing.join(", "));
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required.");
  const clientOrigin = env.CLIENT_ORIGIN || "http://localhost:3000";
  const url = new URL(clientOrigin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== clientOrigin) throw new Error("CLIENT_ORIGIN must be an exact HTTP(S) origin.");
  const secure = ["staging", "production"].includes(environment);
  if (secure && url.protocol !== "https:") throw new Error("Hosted environments require an HTTPS CLIENT_ORIGIN.");
  // Explicit APP_ENV opts in to database isolation. Legacy deployments retain their URI database.
  if (env.APP_ENV && secure && (!env.MONGO_DB_NAME || !env.MONGO_DB_NAME.endsWith(`_${environment}`))) {
    throw new Error("MONGO_DB_NAME must end with the selected environment, such as nabad_staging.");
  }
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error("TRUST_PROXY must be a whole number of proxy hops.");
  return { environment, secure, clientOrigin, databaseName: env.MONGO_DB_NAME, trustProxy };
}
function cookieOptions() {
  const environment = process.env.APP_ENV || process.env.NODE_ENV;
  return { httpOnly: true, secure: ["staging", "production"].includes(environment), sameSite: "lax", path: "/" };
}
module.exports = { loadConfig, cookieOptions };

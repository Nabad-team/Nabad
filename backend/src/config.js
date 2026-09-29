function loadConfig(env = process.env) {
  const environment = env.APP_ENV || env.NODE_ENV || "development";
  if (!["development", "test", "staging", "production"].includes(environment)) throw new Error("Invalid APP_ENV.");
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
  return { environment, secure, clientOrigin, databaseName: env.MONGO_DB_NAME };
}
function cookieOptions() {
  const environment = process.env.APP_ENV || process.env.NODE_ENV;
  return { httpOnly: true, secure: ["staging", "production"].includes(environment), sameSite: "lax", path: "/" };
}
module.exports = { loadConfig, cookieOptions };

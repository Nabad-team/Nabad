require("dotenv").config();
const { createApp } = require("./app");
const connectDB = require("./db");
const { logEvent } = require("./logger");
const { missingGoogleCredentials } = require("./config");
async function start() {
  const app = createApp();
  // Made now rather than during the first sign-in (passwordHashing.js); a failure is retried on first use.
  require("./passwordHashing").dummyHashes().catch(() => {});
  // createApp already rejected a half-configured pair, so here both are missing or neither is.
  const missingGoogle = missingGoogleCredentials();
  if (process.env.APP_ENV === "production" && missingGoogle.length) logEvent("google_signin_disabled", { missingVariables: missingGoogle });
  await connectDB();
  // Directory failures must not take authentication and the rest of Nabad offline.
  await require("./providers/seed").seedProviders().catch(error => {
    logEvent("provider_seed_failed", { errorType: error.name });
  });
  return app.listen(process.env.PORT || 5000, () => logEvent("server_started", {
    environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
  }));
}
if (require.main === module) {
  start().catch((error) => { logEvent("startup_failed", { errorType: error.name, errorMessage: error.message }); process.exitCode = 1; });
}
module.exports = { start };

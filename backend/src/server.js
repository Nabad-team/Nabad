require("dotenv").config();
const { createApp } = require("./app");
const connectDB = require("./db");
const { logEvent } = require("./logger");
const { missingGoogleCredentials } = require("./config");
async function start() {
  const app = createApp();
  // createApp already rejected a half-configured pair, so here both are missing or neither is.
  const missingGoogle = missingGoogleCredentials();
  if (process.env.APP_ENV === "production" && missingGoogle.length) logEvent("google_signin_disabled", { missingVariables: missingGoogle });
  await connectDB();
  return app.listen(process.env.PORT || 5000, () => logEvent("server_started", {
    environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
  }));
}
if (require.main === module) {
  start().catch((error) => { logEvent("startup_failed", { errorType: error.name, errorMessage: error.message }); process.exitCode = 1; });
}
module.exports = { start };

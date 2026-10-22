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
  // Before taking requests, so nobody logs water against a day still counted in glasses. Safe to run every start.
  // On failure the old days read as empty until the next start retries, so the rest of Nabad stays up.
  await require("./migrations/fluidsInMl").migrateFluidsToMl()
    .then((converted) => { if (converted.days || converted.goals) logEvent("fluids_migrated_to_ml", converted); })
    .catch((error) => logEvent("fluids_migration_failed", { errorType: error.name }));
  // Directory failures must not take authentication and the rest of Nabad offline.
  await require("./providers/seed").seedProviders().catch(error => {
    logEvent("provider_seed_failed", { errorType: error.name });
  });
  // Appointments saved before server-side reminders get their reminder time, then the reminder job checks every minute.
  const reminders = require("./appointmentReminders");
  await reminders.backfillReminderSchedules()
    .catch((error) => logEvent("reminder_backfill_failed", { errorType: error.name }));
  reminders.startReminderJob();
  return app.listen(process.env.PORT || 5000, () => logEvent("server_started", {
    environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
  }));
}
if (require.main === module) {
  start().catch((error) => { logEvent("startup_failed", { errorType: error.name, errorMessage: error.message }); process.exitCode = 1; });
}
module.exports = { start };

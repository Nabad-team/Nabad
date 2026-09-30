require("dotenv").config();
const { createApp } = require("./app");
const connectDB = require("./db");
const { logEvent } = require("./logger");
async function start() {
  const app = createApp();
  await connectDB();
  return app.listen(process.env.PORT || 5000, () => logEvent("server_started", {
    environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
  }));
}
if (require.main === module) {
  start().catch((error) => { logEvent("startup_failed", { errorType: error.name, errorMessage: error.message }); process.exitCode = 1; });
}
module.exports = { start };

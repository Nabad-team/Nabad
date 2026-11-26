const mongoose = require("mongoose");
const { loadConfig } = require("./config");
const { logEvent } = require("./logger");
const { timeLimits } = require("./timeLimits");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set. Check your .env file.");
  }
  const config = loadConfig();
  // A stuck database fails a request instead of holding it: give up finding a server after 5 s, and on a socket
  // that has gone quiet for 20 s (above every maxTimeMS, so a slow query fails with its own error first).
  await mongoose.connect(uri, {
    ...(config.databaseName ? { dbName: config.databaseName } : {}),
    serverSelectionTimeoutMS: timeLimits.DB_SERVER_SELECTION_MS,
    socketTimeoutMS: timeLimits.DB_SOCKET_MS,
  });
  logEvent("database_connected", { environment: config.environment });
}

module.exports = connectDB;


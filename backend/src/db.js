const mongoose = require("mongoose");
const { loadConfig } = require("./config");
const { logEvent } = require("./logger");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set. Check your .env file.");
  }
  const config = loadConfig();
  await mongoose.connect(uri, { ...(config.databaseName ? { dbName: config.databaseName } : {}), serverSelectionTimeoutMS: 5000 });
  logEvent("database_connected", { environment: config.environment });
}

module.exports = connectDB;


require("dotenv").config();
const mongoose = require("mongoose");
const ProviderCorrection = require("../src/models/ProviderCorrection");
async function main() {
  if (process.argv.length !== 2 || !process.env.MONGO_URI) throw new Error("Invalid configuration.");
  await mongoose.connect(process.env.MONGO_URI, {
    ...(process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {}),
    serverSelectionTimeoutMS: 5000, autoIndex: false,
  });
  // Private review queue for an authorized operator. Does not contact Jira or publish edits.
  const reports = await ProviderCorrection.find({ status: "pending" }).sort({ updatedAt: -1 }).limit(100)
    .select("providerSlug field details updatedAt -_id").maxTimeMS(3000).lean();
  console.log(JSON.stringify({ reports }, null, 2));
}
main().catch(() => {
  console.error("Provider review queue unavailable. Check your existing database connection settings.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

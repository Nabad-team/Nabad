require("dotenv").config();
const mongoose = require("mongoose");
const { usageSummary } = require("../src/usageAnalytics");
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !/^--days=\d+$/.test(args[0]))) throw new Error("Invalid arguments.");
  const days = args.length ? Number(args[0].split("=")[1]) : 30;
  if (!Number.isInteger(days) || days < 1 || days > 90 || !process.env.MONGO_URI) throw new Error("Invalid configuration.");
  await mongoose.connect(process.env.MONGO_URI, {
    ...(process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {}),
    serverSelectionTimeoutMS: 5000, autoIndex: false,
  });
  console.log(JSON.stringify(await usageSummary(days), null, 2));
}
main().catch(() => {
  console.error("Usage summary unavailable. Check --days=1..90 and your database connection settings.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

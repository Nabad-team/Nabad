require("dotenv").config();
const mongoose = require("mongoose");
const ProviderCorrection = require("../src/models/ProviderCorrection");
const ProviderFeedback = require("../src/models/ProviderFeedback");
const models = { correction: ProviderCorrection, feedback: ProviderFeedback };
async function main() {
  const [action = "list", kind, id, version, ...extra] = process.argv.slice(2);
  const model = Object.hasOwn(models, kind) ? models[kind] : null;
  const listing = action === "list" && !kind && !id && !version && !extra.length;
  const decision = { approve: "approved", reject: "rejected" };
  const timestamp = new Date(version);
  const validDecision = Object.hasOwn(decision, action) && model && /^[a-f0-9]{24}$/i.test(id || "") &&
    Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === version && !extra.length;
  if (!process.env.MONGO_URI || (!listing && !validDecision)) {
    console.error("Use list, or approve|reject correction|feedback ID UPDATED_AT with a configured database.");
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(process.env.MONGO_URI, {
    ...(process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {}),
    serverSelectionTimeoutMS: 5000, autoIndex: false,
  });
  const pending = { status: { $in: ["pending", null] } };
  if (listing) {
    const [reports, feedback] = await Promise.all([
      ProviderCorrection.find(pending).select("providerSlug field details updatedAt").sort({ updatedAt: -1 }).limit(100).maxTimeMS(3000).lean(),
      ProviderFeedback.find(pending).select("providerSlug rating note visitDate waitLevel waitReportedAt updatedAt").sort({ updatedAt: -1 }).limit(100).maxTimeMS(3000).lean(),
    ]);
    console.log(JSON.stringify({ reports, feedback }, null, 2));
    return;
  }
  const result = await model.updateOne({ _id: id, updatedAt: timestamp, ...pending }, { $set: { status: decision[action] } }, { runValidators: true });
  if (!result.modifiedCount) {
    console.error("The item changed or was already moderated. Reload the review queue.");
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ kind, id, status: decision[action] }));
}
main().catch(() => {
  console.error("Provider moderation failed. Check the database connection.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

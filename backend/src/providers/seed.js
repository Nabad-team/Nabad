const Provider = require("../models/Provider");
const providers = require("../../data/providers");

// Only a strictly newer source-check timestamp may replace curated fields.
async function seedProviders(records = providers) {
  await Provider.createIndexes();
  for (const provider of records) {
    const document = new Provider(provider);
    await document.validate();
    const { _id, __v, ...fields } = document.toObject();
    try {
      await Provider.updateOne({ slug: provider.slug }, { $setOnInsert: fields }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error; // another instance seeded this slug first
    }
    await Provider.updateOne({ slug: provider.slug, $or: [{ verifiedAt: { $lt: fields.verifiedAt } }, { verifiedAt: { $exists: false } }] }, { $set: fields, ...(fields.location ? {} : { $unset: { location: "" } }) });
  }
  // Backfill geometry on pre-index records without changing curated information/dates.
  await Provider.updateMany({ location: { $exists: false }, latitude: { $type: "number" }, longitude: { $type: "number" } }, [{ $set: { location: { type: "Point", coordinates: ["$longitude", "$latitude"] } } }]);
}
module.exports = { seedProviders };

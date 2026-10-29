const Provider = require("../models/Provider");
const User = require("../models/User");
const ProviderFeedback = require("../models/ProviderFeedback");
const ProviderCorrection = require("../models/ProviderCorrection");
const providers = require("../../data/providers");

// Only a strictly newer source-check timestamp may replace curated fields.
async function seedProviders(records = providers) {
  const active = new Set(records.map(provider => provider.slug));
  const aliases = new Set();
  for (const provider of records) for (const alias of provider.legacySlugs || []) {
    if (active.has(alias) || aliases.has(alias)) throw new Error("Provider aliases must have one canonical owner and cannot be active slugs.");
    aliases.add(alias);
  }
  await Promise.all([Provider.createIndexes(), ProviderFeedback.createIndexes(), ProviderCorrection.createIndexes()]);
  for (const provider of records) {
    // An older data snapshot must not recreate a facility already consolidated.
    if (await Provider.exists({ legacySlugs: provider.slug })) continue;
    const document = new Provider(provider);
    await document.validate();
    const { _id, __v, ...fields } = document.toObject();
    try {
      await Provider.updateOne({ slug: provider.slug }, { $setOnInsert: fields }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error; // another instance seeded this slug first
    }
    await Provider.updateOne({ slug: provider.slug, $or: [{ verifiedAt: { $lt: fields.verifiedAt } }, { verifiedAt: { $exists: false } }] }, { $set: fields, ...(fields.location ? {} : { $unset: { location: "" } }) });
    // A review that finds no published capability still records its source check,
    // without advancing the complete snapshot or replacing curated facility fields.
    if (fields.servicesReviewedAt) await Provider.updateOne({
      slug: provider.slug, $or: [{ servicesReviewedAt: null }, { servicesReviewedAt: { $lt: fields.servicesReviewedAt } }],
    }, { $set: { servicesReviewedAt: fields.servicesReviewedAt, serviceSources: fields.serviceSources } });
    // Use the effective stored snapshot: older input must not retire a newer identity.
    const saved = await Provider.findOne({ slug: provider.slug }).select("slug legacySlugs").lean();
    for (const alias of saved.legacySlugs || []) {
      await User.updateMany({ favoriteProviders: alias }, [{ $set: { favoriteProviders: { $setUnion: [
        { $map: { input: "$favoriteProviders", as: "id", in: { $cond: [{ $eq: ["$$id", alias] }, saved.slug, "$$id"] } } }, [],
      ] } } }]);
      await Provider.deleteOne({ slug: alias });
    }
  }
  // Backfill geometry on pre-index records without changing curated information/dates.
  await Provider.updateMany({ location: { $exists: false }, latitude: { $type: "number" }, longitude: { $type: "number" } }, [{ $set: { location: { type: "Point", coordinates: ["$longitude", "$latitude"] } } }]);
}
module.exports = { seedProviders };

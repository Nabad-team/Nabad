const Provider = require("../models/Provider");
const providers = require("../../data/providers");

// Add only missing slugs. Repeat deployments never duplicate records or overwrite edits.
async function seedProviders() {
  await Provider.init();
  for (const provider of providers) {
    await new Provider(provider).validate();
    try {
      await Provider.updateOne({ slug: provider.slug }, { $setOnInsert: provider }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error; // another instance seeded this slug first
    }
  }
}
module.exports = { seedProviders };

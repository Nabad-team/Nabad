// Collections, indexes and (optionally) exact document counts of one database, as JSON on stdout.
// Run by backup.sh with: mongosh --nodb --quiet mongosh-stats.js
// Environment: STATS_URI (connection string), STATS_DB (database), STATS_COUNTS ("true" to count).
// The output goes to a private file on the runner and is never printed.
const conn = new Mongo(process.env.STATS_URI);
const target = conn.getDB(process.env.STATS_DB);
const withCounts = process.env.STATS_COUNTS === "true";

const collections = target
  .getCollectionInfos({}, { nameOnly: false, authorizedCollections: true })
  .filter((info) => !info.name.startsWith("system."))
  .map((info) => {
    const entry = { name: info.name, type: info.type };
    const collection = target.getCollection(info.name);
    entry.indexes = info.type === "collection" ? collection.getIndexes() : [];
    if (withCounts) entry.count = collection.countDocuments({});
    return entry;
  });

print(EJSON.stringify({ serverVersion: target.version(), collections }, null, 0, { relaxed: true }));

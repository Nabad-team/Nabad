const User = require("../models/User");

// Older databases have googleId_1 as a sparse unique index. Because every
// email/password user stored googleId: null, that index allowed only one such
// user. The model now defines googleId_1 as a partial unique index, but MongoDB
// won't replace an index that has the same name, so drop the old one first.
// Safe to run on every startup: it does nothing once the index is correct.
async function fixGoogleIdIndex() {
  // Let Mongoose's automatic index build finish first. It fails while the old
  // index exists, which is expected here.
  await User.init().catch(() => {});

  let indexes;
  try {
    indexes = await User.collection.indexes();
  } catch (err) {
    if (err.codeName === "NamespaceNotFound") return; // no users collection yet
    throw err;
  }

  const oldIndex = indexes.find((index) => index.name === "googleId_1" && !index.partialFilterExpression);
  if (!oldIndex) return;

  await User.collection.dropIndex("googleId_1");
  await User.createIndexes();
  console.log("Replaced old googleId_1 index with a partial unique index.");
}

module.exports = fixGoogleIdIndex;

// Sanity checks for a backup, and the freshness/size checks of the weekly verification.
// Every message returned here is printed in public workflow logs and issues, so messages say what
// kind of check failed but never name a collection or show a document count.

const INDEX_FIELDS = ["key", "unique", "sparse", "expireAfterSeconds", "partialFilterExpression", "weights", "default_language", "collation", "hidden"];

// Collection name -> document count, from mongodump's log ("done dumping `db.users` (12 documents)").
function parseDumpLog(text, database) {
  const counts = {};
  const re = /done dumping `?([^\s.`]+)\.([^\s`]+)`? \((\d+) documents?\)/g;
  for (const m of String(text).matchAll(re)) {
    if (m[1] === database) counts[m[2]] = Number(m[3]);
  }
  return counts;
}

// Collection name -> { count, failures }, from mongorestore's log
// ("finished restoring `db.users` (12 documents, 0 failures)").
function parseRestoreLog(text, database) {
  const counts = {};
  const re = /finished restoring `?([^\s.`]+)\.([^\s`]+)`? \((\d+) documents?, (\d+) failures?\)/g;
  for (const m of String(text).matchAll(re)) {
    if (m[1] === database) counts[m[2]] = { count: Number(m[3]), failures: Number(m[4]) };
  }
  return counts;
}

function indexSignature(index) {
  const picked = { name: index.name };
  for (const field of INDEX_FIELDS) if (index[field] !== undefined) picked[field] = index[field];
  return JSON.stringify(picked);
}

function indexSet(collection) {
  return (collection.indexes || []).map(indexSignature).sort();
}

function sameList(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function byName(stats) {
  return new Map(((stats && stats.collections) || []).map((c) => [c.name, c]));
}

// dumpCounts:    parseDumpLog of the backup's own mongodump run (what is inside the archive)
// restoreCounts: parseRestoreLog of restoring that archive into the throwaway MongoDB
// source:        collections and indexes of the production database, read right after the dump
// restored:      collections, exact counts and indexes of the restored copy
// required:      collections that must exist and hold at least one document
function compareRestore({ dumpCounts, restoreCounts, source, restored, required = [] }) {
  const problems = [];
  const dumped = Object.keys(dumpCounts || {}).sort();
  const sourceCollections = byName(source);
  const restoredCollections = byName(restored);

  if (dumped.length === 0) problems.push("the dump contains no collections");
  if (!sameList(dumped, [...sourceCollections.keys()].sort())) problems.push("the dump's collection list differs from the production database");
  if (!sameList(dumped, [...restoredCollections.keys()].sort())) problems.push("the restored collection list differs from the dump");

  let countMismatch = false;
  let restoreFailures = false;
  let indexMismatch = false;
  for (const name of dumped) {
    const expected = dumpCounts[name];
    const logged = restoreCounts && restoreCounts[name];
    const actual = restoredCollections.get(name);
    if (!logged || logged.count !== expected) countMismatch = true;
    if (logged && logged.failures !== 0) restoreFailures = true;
    if (!actual || actual.count !== expected) countMismatch = true;

    const wanted = sourceCollections.get(name);
    if (!wanted || !actual || !sameList(indexSet(wanted), indexSet(actual))) indexMismatch = true;
  }
  if (countMismatch) problems.push("document counts differ between the dump and the restored copy");
  if (restoreFailures) problems.push("mongorestore reported documents that failed to restore");
  if (indexMismatch) problems.push("indexes of the restored copy differ from the production database");

  for (const name of required) {
    const actual = restoredCollections.get(name);
    if (!actual || !(actual.count > 0)) {
      problems.push("a required collection is missing or empty");
      break;
    }
  }

  // Only the restored counts are kept, and only in the encrypted counts file.
  const counts = Object.fromEntries(dumped.map((name) => [name, dumpCounts[name]]));
  return { ok: problems.length === 0, problems, counts };
}

function checkFreshness(createdAt, now, maxAgeHours) {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  if (Number.isNaN(ageMs)) return ["the newest backup has no valid timestamp"];
  if (ageMs < -5 * 60 * 1000) return ["the newest backup is dated in the future"];
  if (ageMs > maxAgeHours * 60 * 60 * 1000) return [`the newest backup is older than ${maxAgeHours} hours`];
  return [];
}

function checkSizeRatio(newSize, previousSize, minRatio) {
  if (!(previousSize > 0)) return [];
  if (!(newSize > 0)) return ["the newest backup has no size"];
  if (newSize < previousSize * minRatio) return [`the newest backup is smaller than ${Math.round(minRatio * 100)}% of the previous one`];
  return [];
}

module.exports = { parseDumpLog, parseRestoreLog, indexSignature, compareRestore, checkFreshness, checkSizeRatio };

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDumpLog, parseRestoreLog, compareRestore, checkFreshness, checkSizeRatio } = require("../lib/checks");

// The log lines are the formats printed by MongoDB Database Tools 100.19.0.
const dumpLog = [
  "2026-11-08T01:00:09.101+0000\twriting nabad_production.users to archive",
  "2026-11-08T01:00:09.200+0000\tdone dumping `nabad_production.users` (3 documents)",
  "2026-11-08T01:00:09.201+0000\tdone dumping `nabad_production.providers` (1 document)",
  "2026-11-08T01:00:09.202+0000\tdone dumping `nabad_production.notifications` (0 documents)",
  "2026-11-08T01:00:09.203+0000\tdone dumping `other_db.users` (99 documents)",
].join("\n");
const restoreLog = [
  "2026-11-08T01:00:12.000+0000\tfinished restoring `nabad_production.users` (3 documents, 0 failures)",
  "2026-11-08T01:00:12.001+0000\tfinished restoring `nabad_production.providers` (1 document, 0 failures)",
  "2026-11-08T01:00:12.002+0000\tfinished restoring `nabad_production.notifications` (0 documents, 0 failures)",
  "2026-11-08T01:00:12.003+0000\t4 document(s) restored successfully. 0 document(s) failed to restore.",
].join("\n");

const idIndex = { v: 2, key: { _id: 1 }, name: "_id_" };
const emailIndex = { v: 2, key: { email: 1 }, name: "email_1", unique: true };
const source = {
  collections: [
    { name: "users", type: "collection", indexes: [idIndex, emailIndex] },
    { name: "providers", type: "collection", indexes: [idIndex] },
    { name: "notifications", type: "collection", indexes: [idIndex, { v: 2, key: { createdAt: 1 }, name: "ttl", expireAfterSeconds: 60 }] },
  ],
};
const restored = {
  serverVersion: "7.0.43",
  collections: [
    { name: "notifications", type: "collection", count: 0, indexes: [{ v: 2, key: { createdAt: 1 }, name: "ttl", expireAfterSeconds: 60 }, idIndex] },
    { name: "users", type: "collection", count: 3, indexes: [idIndex, emailIndex] },
    { name: "providers", type: "collection", count: 1, indexes: [idIndex] },
  ],
};

function run(overrides = {}) {
  return compareRestore({
    dumpCounts: parseDumpLog(dumpLog, "nabad_production"),
    restoreCounts: parseRestoreLog(restoreLog, "nabad_production"),
    source,
    restored,
    required: ["users"],
    ...overrides,
  });
}

const clone = (v) => JSON.parse(JSON.stringify(v));

test("parses the per-collection counts of mongodump and mongorestore for one database only", () => {
  assert.deepEqual(parseDumpLog(dumpLog, "nabad_production"), { users: 3, providers: 1, notifications: 0 });
  assert.deepEqual(parseRestoreLog(restoreLog, "nabad_production").users, { count: 3, failures: 0 });
  assert.equal(parseRestoreLog(restoreLog, "nabad_production").other, undefined);
});

test("also reads older tool versions that print names without backticks", () => {
  assert.deepEqual(parseDumpLog("x\tdone dumping nabad_production.users (1 document)", "nabad_production"), { users: 1 });
  assert.deepEqual(parseRestoreLog("x\tfinished restoring nabad_production.users (1 document, 0 failures)", "nabad_production"), { users: { count: 1, failures: 0 } });
});

test("passes when collections, counts and indexes match, and returns the counts", () => {
  const result = run();
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, { notifications: 0, providers: 1, users: 3 });
});

test("fails on a missing collection in the restored copy", () => {
  const r = clone(restored);
  r.collections.pop();
  assert.ok(run({ restored: r }).problems.includes("the restored collection list differs from the dump"));
});

test("fails when a collection exists in production but not in the dump", () => {
  const s = clone(source);
  s.collections.push({ name: "appointments", type: "collection", indexes: [idIndex] });
  assert.ok(run({ source: s }).problems.includes("the dump's collection list differs from the production database"));
});

test("fails when a restored count is off by one", () => {
  const r = clone(restored);
  r.collections[1].count = 2;
  assert.ok(run({ restored: r }).problems.includes("document counts differ between the dump and the restored copy"));
});

test("fails when mongorestore logged failures", () => {
  const log = restoreLog.replace("(3 documents, 0 failures)", "(3 documents, 1 failure)");
  assert.ok(run({ restoreCounts: parseRestoreLog(log, "nabad_production") }).problems.includes("mongorestore reported documents that failed to restore"));
});

test("fails when an index was not restored or lost an option", () => {
  const missing = clone(restored);
  missing.collections[1].indexes = [idIndex];
  assert.ok(run({ restored: missing }).problems.includes("indexes of the restored copy differ from the production database"));
  const notUnique = clone(restored);
  notUnique.collections[1].indexes = [idIndex, { ...emailIndex, unique: undefined }];
  assert.equal(run({ restored: notUnique }).ok, false);
});

test("fails when a required collection is empty", () => {
  const r = clone(restored);
  r.collections[1].count = 0;
  const log = dumpLog.replace("(3 documents)", "(0 documents)");
  const rlog = restoreLog.replace("(3 documents, 0 failures)", "(0 documents, 0 failures)");
  const result = run({ restored: r, dumpCounts: parseDumpLog(log, "nabad_production"), restoreCounts: parseRestoreLog(rlog, "nabad_production") });
  assert.deepEqual(result.problems, ["a required collection is missing or empty"]);
});

test("fails on an empty dump", () => {
  assert.ok(run({ dumpCounts: {} }).problems.includes("the dump contains no collections"));
});

test("problem messages never name a collection or show a count", () => {
  const r = clone(restored);
  r.collections = [{ name: "users", type: "collection", count: 7, indexes: [] }];
  const text = run({ restored: r, restoreCounts: {} }).problems.join("\n");
  assert.doesNotMatch(text, /users|providers|notifications|\b[0-9]+\b/);
});

test("freshness: under 26 hours passes, older or future-dated fails", () => {
  const now = new Date("2026-11-09T06:00:00Z");
  assert.deepEqual(checkFreshness("2026-11-09T01:00:07Z", now, 26), []);
  assert.deepEqual(checkFreshness("2026-11-08T03:59:00Z", now, 26), ["the newest backup is older than 26 hours"]);
  assert.deepEqual(checkFreshness("2026-11-09T07:00:00Z", now, 26), ["the newest backup is dated in the future"]);
  assert.equal(checkFreshness("nope", now, 26).length, 1);
});

test("size: below half of the previous backup fails", () => {
  assert.deepEqual(checkSizeRatio(500, 1000, 0.5), []);
  assert.deepEqual(checkSizeRatio(499, 1000, 0.5), ["the newest backup is smaller than 50% of the previous one"]);
  assert.deepEqual(checkSizeRatio(10, undefined, 0.5), []);
  assert.equal(checkSizeRatio(0, 1000, 0.5).length, 1);
});

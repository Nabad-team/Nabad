const test = require("node:test");
const assert = require("node:assert/strict");
const { groupBackups, selectForDeletion } = require("../lib/retention");
const { stampFor, backupVersions, listing } = require("./helpers");

const days = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => stampFor(from + i));

test("groups files by backup, newest first, and marks complete backups", () => {
  const l = listing("daily", [stampFor(1), stampFor(3)]);
  l.Versions.push(...backupVersions("daily", stampFor(2), { kinds: ["archive"] }));
  const groups = groupBackups(l);
  assert.deepEqual(groups.map((g) => g.stamp), [stampFor(3), stampFor(2), stampFor(1)]);
  assert.deepEqual(groups.map((g) => g.complete), [true, false, true]);
});

test("keeps the newest 7 daily backups and deletes every file of the older ones", () => {
  const doomed = selectForDeletion(listing("daily", days(1, 10)), { keep: 7 });
  assert.equal(doomed.length, 9);
  const stamps = new Set(doomed.map((d) => d.key.slice(12, 28)));
  assert.deepEqual([...stamps].sort(), days(1, 3));
  assert.ok(doomed.every((d) => d.versionId.startsWith("v-")));
});

test("deletes nothing when there are fewer backups than the limit", () => {
  assert.deepEqual(selectForDeletion(listing("weekly", days(1, 4)), { keep: 4 }), []);
  assert.deepEqual(selectForDeletion(listing("daily", []), { keep: 7 }), []);
});

test("an incomplete backup doesn't count towards the 7, and is removed once it's old", () => {
  const l = listing("daily", days(1, 7));
  l.Versions.push(...backupVersions("daily", stampFor(8), { kinds: ["archive", "counts"] }));
  assert.deepEqual(selectForDeletion(l, { keep: 7 }).map((d) => d.key).sort(), [
    `daily/nabad-${stampFor(8)}.archive.gz.age`,
    `daily/nabad-${stampFor(8)}.counts.json.age`,
  ]);
});

test("never deletes the backup being written", () => {
  const l = listing("daily", days(1, 7));
  l.Versions.push(...backupVersions("daily", stampFor(8), { kinds: ["archive"] }));
  assert.deepEqual(selectForDeletion(l, { keep: 7, protect: stampFor(8) }), []);
});

test("deletes old versions and delete markers of expired backups, so nothing stays hidden", () => {
  const old = stampFor(1);
  const l = listing("daily", days(2, 8), {
    Versions: [{ Key: `daily/nabad-${old}.archive.gz.age`, VersionId: "hidden-1", IsLatest: false, Size: 5 }],
    DeleteMarkers: [{ Key: `daily/nabad-${old}.archive.gz.age`, VersionId: "marker-1", IsLatest: true }],
  });
  assert.deepEqual(selectForDeletion(l, { keep: 7 }).map((d) => d.versionId).sort(), ["hidden-1", "marker-1"]);
});

test("ignores files that don't follow the naming", () => {
  const l = listing("daily", days(1, 8), { Versions: [{ Key: "daily/README.txt", VersionId: "r", IsLatest: true, Size: 1 }] });
  assert.ok(selectForDeletion(l, { keep: 7 }).every((d) => d.key !== "daily/README.txt"));
});

test("deletes nothing if no complete backup would remain", () => {
  const l = { Versions: backupVersions("daily", stampFor(1), { kinds: ["archive"] }) };
  assert.deepEqual(selectForDeletion(l, { keep: 7 }), []);
});

test("rejects a missing or invalid keep", () => {
  assert.throws(() => selectForDeletion(listing("daily", []), {}));
  assert.throws(() => selectForDeletion(listing("daily", []), { keep: 0 }));
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { planVerification, verifyBackups } = require("../lib/verify");
const { stampToDate } = require("../lib/naming");
const { stampFor, backupVersions, listing } = require("./helpers");

const sha = "b".repeat(64);
const manifestFor = (stamp, sizeBytes = 1000, extra = {}) => ({
  manifestVersion: 1,
  createdAt: stampToDate(stamp).toISOString(),
  sizeBytes,
  sha256: sha,
  tools: { mongodump: "100.19.0", age: "v1.3.2", restoreCheckMongo: "7.0.43" },
  ...extra,
});

const stamps = [2, 3, 4, 5, 6, 7, 8].map((d) => stampFor(d));
const newest = stamps[6];
const now = new Date("2026-11-08T06:00:00Z");

function input(overrides = {}) {
  return {
    daily: listing("daily", stamps),
    weekly: listing("weekly", [stampFor(1), stampFor(8)]),
    newestManifest: manifestFor(newest),
    previousManifest: manifestFor(stamps[5]),
    downloaded: { sha256: sha, size: 1000 },
    now,
    ...overrides,
  };
}

test("picks the newest and previous complete daily backups", () => {
  const l = listing("daily", stamps);
  l.Versions.push(...backupVersions("daily", stampFor(9), { kinds: ["archive"] }));
  const plan = planVerification(l);
  assert.equal(plan.newest.stamp, newest);
  assert.equal(plan.previous.stamp, stamps[5]);
  assert.deepEqual(planVerification({}), { newest: null, previous: null });
});

test("passes for a fresh, intact backup set", () => {
  assert.deepEqual(verifyBackups(input()), []);
});

test("fails when the downloaded file's checksum doesn't match the manifest", () => {
  assert.ok(verifyBackups(input({ downloaded: { sha256: "c".repeat(64), size: 1000 } })).includes("the newest backup's SHA-256 does not match its manifest"));
});

test("fails when the newest backup is more than 26 hours old", () => {
  assert.ok(verifyBackups(input({ now: new Date("2026-11-09T03:01:00Z") })).includes("the newest backup is older than 26 hours"));
});

test("fails when the newest backup shrank below half of the previous one", () => {
  const problems = verifyBackups(input({ previousManifest: manifestFor(stamps[5], 2001) }));
  assert.ok(problems.includes("the newest backup is smaller than 50% of the previous one"));
});

test("fails when the size doesn't match the manifest", () => {
  assert.ok(verifyBackups(input({ downloaded: { sha256: sha, size: 999 } })).includes("the newest backup's size does not match its manifest"));
});

test("fails when retention left too many backups or hidden versions", () => {
  assert.ok(verifyBackups(input({ daily: listing("daily", [stampFor(1), ...stamps]) })).includes("daily/ holds more than 7 backups"));
  const weekly = listing("weekly", [1, 2, 3, 4, 5].map((d) => stampFor(d)));
  assert.ok(verifyBackups(input({ weekly })).includes("weekly/ holds more than 4 backups"));
  const hidden = listing("daily", stamps, { DeleteMarkers: [{ Key: `daily/nabad-${stampFor(1)}.manifest.json`, VersionId: "m", IsLatest: true }] });
  assert.ok(verifyBackups(input({ daily: hidden })).includes("daily/ still has old versions of deleted files"));
});

test("fails on an incomplete backup", () => {
  const daily = listing("daily", stamps);
  daily.Versions.push(...backupVersions("daily", stampFor(1), { kinds: ["archive"] }));
  assert.ok(verifyBackups(input({ daily })).includes("daily/ has an incomplete backup"));
});

test("fails when there is no backup or the manifest is invalid", () => {
  assert.ok(verifyBackups(input({ daily: {} })).includes("daily/ has no complete backup"));
  const problems = verifyBackups(input({ newestManifest: manifestFor(newest, 1000, { counts: { users: 3 } }) }));
  assert.ok(problems.includes("newest manifest: manifest has unexpected fields"));
});

test("allows an empty weekly folder and a single daily backup", () => {
  assert.deepEqual(verifyBackups(input({ daily: listing("daily", [newest]), weekly: {}, previousManifest: null })), []);
});

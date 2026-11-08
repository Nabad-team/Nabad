const test = require("node:test");
const assert = require("node:assert/strict");
const { buildManifest, validateManifest } = require("../lib/manifest");

const valid = {
  createdAt: "2026-11-08T01:00:07Z",
  sizeBytes: 123456,
  sha256: "a".repeat(64),
  tools: { mongodump: "100.19.0", age: "v1.3.2", restoreCheckMongo: "7.0.43" },
};

test("builds a manifest with only timestamp, size, checksum and tool versions", () => {
  const manifest = buildManifest(valid);
  assert.deepEqual(Object.keys(manifest).sort(), ["createdAt", "manifestVersion", "sha256", "sizeBytes", "tools"]);
  assert.equal(manifest.createdAt, "2026-11-08T01:00:07.000Z");
  assert.deepEqual(validateManifest(manifest), []);
});

test("drops unknown tool fields instead of storing them", () => {
  const manifest = buildManifest({ ...valid, tools: { ...valid.tools, collections: "users" } });
  assert.equal(manifest.tools.collections, undefined);
});

test("rejects manifests that carry data or bad values", () => {
  const good = buildManifest(valid);
  const cases = {
    "extra field": { ...good, counts: { users: 3 } },
    "bad checksum": { ...good, sha256: "A".repeat(64) },
    "zero size": { ...good, sizeBytes: 0 },
    "fraction size": { ...good, sizeBytes: 1.5 },
    "bad date": { ...good, createdAt: "yesterday" },
    "missing tool": { ...good, tools: { mongodump: "100.19.0", age: "v1.3.2" } },
    "extra tool": { ...good, tools: { ...good.tools, users: "3" } },
    "wrong version": { ...good, manifestVersion: 2 },
  };
  for (const [name, manifest] of Object.entries(cases)) {
    assert.notDeepEqual(validateManifest(manifest), [], name);
  }
  assert.deepEqual(validateManifest(null), ["manifest is not an object"]);
  assert.throws(() => buildManifest({ ...valid, sha256: "nope" }), /Invalid manifest/);
});

test("validation messages never repeat values from the manifest", () => {
  const messages = validateManifest({ manifestVersion: 1, createdAt: "users=12", sizeBytes: -1, sha256: "secret-ish", tools: {} }).join(" ");
  assert.doesNotMatch(messages, /users=12|secret-ish/);
});

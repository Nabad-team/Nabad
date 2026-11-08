const test = require("node:test");
const assert = require("node:assert/strict");
const { formatStamp, stampToDate, backupFiles, parseKey, isSunday } = require("../lib/naming");

test("formats a UTC timestamp without separators or milliseconds", () => {
  assert.equal(formatStamp(new Date("2026-11-08T01:03:12.456Z")), "20261108T010312Z");
  assert.throws(() => formatStamp(new Date("nope")), TypeError);
});

test("parses a timestamp back and rejects impossible dates", () => {
  assert.equal(stampToDate("20261108T010312Z").toISOString(), "2026-11-08T01:03:12.000Z");
  assert.equal(stampToDate("20261340T010312Z"), null);
  assert.equal(stampToDate("2026-11-08"), null);
});

test("names the three files of a backup", () => {
  assert.deepEqual(backupFiles("20261108T010312Z"), {
    archive: "nabad-20261108T010312Z.archive.gz.age",
    manifest: "nabad-20261108T010312Z.manifest.json",
    counts: "nabad-20261108T010312Z.counts.json.age",
  });
  assert.throws(() => backupFiles("../evil"));
});

test("parses object keys and ignores anything that isn't ours", () => {
  const parsed = parseKey("daily/nabad-20261108T010312Z.counts.json.age");
  assert.equal(parsed.folder, "daily");
  assert.equal(parsed.kind, "counts");
  assert.equal(parsed.stamp, "20261108T010312Z");
  assert.equal(parseKey("weekly/nabad-20261108T010312Z.manifest.json").kind, "manifest");
  for (const key of ["daily/notes.txt", "daily/nabad-20261108T010312Z.archive.gz", "daily/nabad-20261199T010312Z.manifest.json", "daily/", null]) {
    assert.equal(parseKey(key), null, String(key));
  }
});

test("Sunday is decided in UTC", () => {
  assert.equal(isSunday(new Date("2026-11-08T01:00:00Z")), true);
  assert.equal(isSunday(new Date("2026-11-07T23:30:00Z")), false);
  assert.equal(isSunday(new Date("2026-11-09T00:30:00Z")), false);
});

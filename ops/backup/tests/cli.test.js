const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { formatSize } = require("../cli");
const { stampFor, listing } = require("./helpers");

const cliPath = path.join(__dirname, "..", "cli.js");
const run = (args, env = {}) => spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nabad-backup-test-"));
}

test("names prints shell-sourceable names for a Sunday backup", () => {
  const result = run(["names", "--now", "2026-11-08T01:00:07Z"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^STAMP=20261108T010007Z$/m);
  assert.match(result.stdout, /^ARCHIVE_NAME=nabad-20261108T010007Z\.archive\.gz\.age$/m);
  assert.match(result.stdout, /^IS_SUNDAY=true$/m);
});

test("endpoint reads B2_ENDPOINT from the environment", () => {
  const result = run(["endpoint"], { B2_ENDPOINT: "s3.eu-central-003.backblazeb2.com" });
  assert.match(result.stdout, /^AWS_DEFAULT_REGION=eu-central-003$/m);
});

test("check writes the counts file only when the restore matches, and logs no names or counts", () => {
  const dir = tmp();
  const write = (name, content) => {
    fs.writeFileSync(path.join(dir, name), typeof content === "string" ? content : JSON.stringify(content));
    return path.join(dir, name);
  };
  const index = { v: 2, key: { _id: 1 }, name: "_id_" };
  const args = [
    "check", "--database", "nabad_production",
    "--dump-log", write("dump.log", "x\tdone dumping nabad_production.users (2 documents)\n"),
    "--restore-log", write("restore.log", "x\tfinished restoring nabad_production.users (2 documents, 0 failures)\n"),
    "--source", write("source.json", { collections: [{ name: "users", indexes: [index] }] }),
    "--required", "users", "--created-at", "2026-11-08T01:00:07.000Z",
    "--counts-out", path.join(dir, "counts.json"),
  ];
  write("restored.json", { collections: [{ name: "users", count: 2, indexes: [index] }] });
  const ok = run([...args, "--restored", path.join(dir, "restored.json")]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "counts.json"), "utf8")).collections, { users: 2 });
  assert.doesNotMatch(ok.stdout + ok.stderr, /users|\b2\b/);

  fs.rmSync(path.join(dir, "counts.json"));
  write("restored.json", { collections: [{ name: "users", count: 1, indexes: [index] }] });
  const bad = run([...args, "--restored", path.join(dir, "restored.json")]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /document counts differ/);
  assert.doesNotMatch(bad.stdout + bad.stderr, /users|\b[12]\b/);
  assert.equal(fs.existsSync(path.join(dir, "counts.json")), false);
});

test("manifest and summary show only status, timestamp, size and checksum", () => {
  const dir = tmp();
  const out = path.join(dir, "m.json");
  const sha = "d".repeat(64);
  const made = run(["manifest", "--created-at", "2026-11-08T01:00:07.000Z", "--size", "2048", "--sha256", sha, "--mongodump", "100.19.0", "--age", "v1.3.2", "--restore-mongo", "7.0.43", "--out", out]);
  assert.equal(made.status, 0, made.stderr);
  const summary = run(["summary", "--manifest", out, "--title", "Nightly database backup", "--status", "OK"]);
  assert.equal(summary.status, 0, summary.stderr);
  assert.match(summary.stdout, /\| Status \| OK \|/);
  assert.match(summary.stdout, /2026-11-08T01:00:07.000Z/);
  assert.match(summary.stdout, /2.0 KiB \(2048 bytes\)/);
  assert.match(summary.stdout, new RegExp(sha));
});

test("retention prints key and version id of each file to delete", () => {
  const dir = tmp();
  const file = path.join(dir, "l.json");
  fs.writeFileSync(file, JSON.stringify(listing("weekly", [1, 2, 3, 4, 5].map((d) => stampFor(d)))));
  const result = run(["retention", "--listing", file, "--keep", "4"]);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => /^weekly\/nabad-20261101T010007Z\.[a-z.]+\tv-/.test(l)));
});

test("classify-error and failed-step print fixed text", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "e.log"), "server selection error for users (5 documents)");
  assert.match(run(["classify-error", path.join(dir, "e.log")]).stdout, /^could not reach the database/);
  assert.equal(run(["failed-step"], { STEPS_JSON: '{"dump":{"outcome":"failure"}}' }).stdout.trim(), "dump");
});

test("unknown commands and unreadable JSON fail without a stack trace", () => {
  assert.equal(run(["nope"]).status, 2);
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "bad.json"), "{");
  const result = run(["verify-plan", "--listing", path.join(dir, "bad.json")]);
  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), "a file could not be parsed as JSON");
});

test("formats sizes", () => {
  assert.equal(formatSize(512), "512 B (512 bytes)");
  assert.equal(formatSize(5 * 1024 * 1024), "5.0 MiB (5242880 bytes)");
});

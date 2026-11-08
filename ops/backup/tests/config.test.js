// Guards the parts of the setup that a careless edit could quietly break: the public key, the
// workflow triggers and guard, pinned versions, and that nothing in CI asks for the private key.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const workflows = ["db-backup.yml", "db-backup-verify.yml"].map((name) => ({ name, text: read(`.github/workflows/${name}`) }));
const versions = Object.fromEntries(
  read("ops/backup/versions.env")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => l.split(/=(.*)/s).slice(0, 2))
);

test("the committed key is exactly one age public key", () => {
  const key = read("ops/backup/backup-public-key.txt");
  assert.match(key, /^age1[02-9ac-hj-np-z]{58}\n$/);
});

test("backup workflows run only on schedule or by hand, only in the team repository", () => {
  for (const { name, text } of workflows) {
    const on = text.slice(text.indexOf("\non:"), text.indexOf("\npermissions:"));
    assert.match(on, /schedule:/, name);
    assert.match(on, /workflow_dispatch:/, name);
    assert.doesNotMatch(on, /push|pull_request/, name);
    assert.match(text, /if: github\.repository == 'Nabad-team\/Nabad'/, name);
    assert.match(text, /permissions:\n {2}contents: read\n {2}issues: write\n\n/, name);
  }
  assert.match(workflows[0].text, /cron: "0 1 \* \* \*"/);
  assert.match(workflows[1].text, /cron: "0 6 \* \* 1"/);
});

test("job-level settings only use contexts GitHub allows there", () => {
  // The runner context only exists inside steps; using it in job env makes GitHub reject the workflow.
  for (const { name, text } of workflows) {
    const beforeSteps = text.slice(0, text.indexOf("\n    steps:"));
    assert.doesNotMatch(beforeSteps, /\$\{\{\s*(runner|steps|job)\./, name);
  }
});

test("every action is pinned to a full commit SHA with a version comment", () => {
  for (const { name, text } of workflows) {
    const uses = [...text.matchAll(/uses: (\S+)(.*)/g)];
    assert.ok(uses.length > 0, name);
    for (const [, ref, comment] of uses) {
      assert.match(ref, /@[0-9a-f]{40}$/, `${name}: ${ref}`);
      assert.match(comment, /# v\d+\.\d+\.\d+/, `${name}: ${ref}`);
    }
  }
});

test("the restore-check image is pinned by digest and matches versions.env", () => {
  assert.match(versions.RESTORE_MONGO_IMAGE, /^mongo:7\.0\.\d+@sha256:[0-9a-f]{64}$/);
  assert.match(workflows[0].text, new RegExp(`image: ${versions.RESTORE_MONGO_IMAGE.replace(/[.]/g, "\\.")}\n`));
});

test("tool versions are exact and every download has a SHA-256", () => {
  assert.match(versions.MONGODB_TOOLS_VERSION, /^100\.\d+\.\d+$/);
  assert.match(versions.MONGOSH_VERSION, /^\d+\.\d+\.\d+$/);
  assert.match(versions.AGE_VERSION, /^v\d+\.\d+\.\d+$/);
  for (const key of ["MONGODB_TOOLS_SHA256", "MONGOSH_SHA256", "AGE_SHA256"]) assert.match(versions[key], /^[0-9a-f]{64}$/, key);
});

test("CI never references a private key, never traces shell commands, never uploads artifacts", () => {
  const files = [...workflows.map((w) => w.text), read("ops/backup/backup.sh"), read("ops/backup/install-tools.sh"), read("ops/backup/report-issue.sh")];
  for (const text of files) {
    const code = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
    assert.doesNotMatch(code, /AGE-SECRET-KEY|--identity|age -d|--decrypt/);
    assert.doesNotMatch(code, /set -[a-wyz]*x|set -o xtrace|upload-artifact/);
  }
  for (const { text } of workflows) assert.doesNotMatch(text, /echo .*secrets\./);
});

test("every aws call sets the B2-compatible checksum settings", () => {
  const script = read("ops/backup/backup.sh");
  const calls = script.split("\n").filter((l) => /^\s*(AWS_[A-Z_]+=\S+\s+)*aws\s/.test(l) || /\baws --endpoint-url/.test(l));
  assert.equal(calls.length, 1, "all S3 calls go through the b2() wrapper");
  assert.match(script, /AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required/);
  assert.doesNotMatch(script.replace(/^b2\(\) \{[\s\S]*?\n\}/m, ""), /(^|\s)aws\s/m);
});

test("the tests job in CI runs these tests", () => {
  assert.match(read(".github/workflows/tests.yml"), /node --test "ops\/backup\/tests\/\*\.test\.js"/);
});

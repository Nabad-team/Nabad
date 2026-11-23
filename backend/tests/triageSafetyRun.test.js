// SCRUM-348: scripts/triage-safety-run.cjs, the recorded triage safety run on a release candidate.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verdict, summarise, readArgs } = require("../scripts/triage-safety-run.cjs");

test("a level inside the safe range is safe; below it is under-triage; above it is over-triage unless documented", () => {
  const item = { expected: "urgent", maxAcceptable: "emergency" };
  assert.equal(verdict(item, "urgent"), "safe");
  assert.equal(verdict(item, "emergency"), "safe");
  assert.equal(verdict(item, "soon"), "under");
  assert.equal(verdict({ expected: "routine" }, "soon"), "over");
  assert.equal(verdict({ expected: "routine", knownOverTriage: "why" }, "urgent"), "known-over");
});

test("reads its options", () => {
  assert.deepEqual(readArgs([]), { ai: false, out: null, delayMs: 0, label: "" });
  assert.deepEqual(readArgs(["--ai", "--out", "x", "--label", "rc"]), { ai: true, out: "x", delayMs: 4000, label: "rc" });
  assert.throws(() => readArgs(["--nope"]), /Unknown option/);
  assert.throws(() => readArgs(["--delay-ms", "-1"]), /delay-ms/);
});

test("summarises the rows", () => {
  const rows = [
    { verdict: "safe", given: "urgent", expected: "urgent", aiUsed: true },
    { verdict: "known-over", given: "urgent", expected: "routine", aiUsed: false },
    { verdict: "under", given: "soon", expected: "urgent", aiUsed: false },
  ];
  assert.deepEqual(summarise(rows), { cases: 3, safe: 1, under: 1, over: 0, knownOver: 1, exact: 1, aiUsed: 1 });
});

test("with the AI off, every case of both sets is inside its range, and the record is written", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "triage-run-")), "run");
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("LLM_")) delete env[key];
  delete env.GITHUB_STEP_SUMMARY;
  execFileSync(process.execPath, [path.join(__dirname, "../scripts/triage-safety-run.cjs"), "--out", out, "--label", "test"], { env, stdio: "pipe" });
  const record = JSON.parse(fs.readFileSync(`${out}.json`, "utf8"));
  assert.equal(record.summary.safety.under, 0);
  assert.equal(record.summary.safety.over, 0);
  assert.equal(record.summary.quality.exact, record.summary.quality.cases);
  assert.equal(record.cases.length, record.summary.safety.cases + record.summary.quality.cases);
  assert.match(fs.readFileSync(`${out}.md`, "utf8"), /every case inside its safe range/);
});

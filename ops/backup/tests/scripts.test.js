const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..");
const scripts = fs.readdirSync(dir).filter((name) => name.endsWith(".sh"));

// Every backup script runs with `set -o pipefail`. A reader that stops early (head, grep -q, grep -m) closes the
// pipe while the writer may still be writing; the writer dies of SIGPIPE and the whole step fails with exit code
// 141, only sometimes (issue #275: `mongodump --version | head -n 1`). Capture the output instead and cut it in bash.
const EARLY_EXIT_READER = /\|\s*(?:head\b|grep\s+(?:-\w*[qm]\w*|--quiet|--max-count)\b)/;

test("there are backup scripts to check", () => {
  assert.ok(scripts.includes("install-tools.sh"));
});

for (const name of scripts) {
  test(`${name} uses pipefail and never pipes into a reader that exits early`, () => {
    const source = fs.readFileSync(path.join(dir, name), "utf8");
    assert.match(source, /set -[a-z]*o pipefail|set -o pipefail/);
    const offending = source
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => !line.startsWith("#") && EARLY_EXIT_READER.test(line));
    assert.deepEqual(offending, [], `${name}: pipe into an early-exit reader can fail with SIGPIPE (141)`);
  });
}

test("the pattern catches the line that broke the nightly backup", () => {
  assert.match('"$tools_dir/bin/mongodump" --version | head -n 1', EARLY_EXIT_READER);
  assert.match("some-tool | grep -q ready", EARLY_EXIT_READER);
  assert.doesNotMatch('version="$(mongodump --version)"', EARLY_EXIT_READER);
});

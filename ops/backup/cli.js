#!/usr/bin/env node
// Command-line entry for backup.sh and verify.sh. Everything printed to stdout or stderr here ends
// up in public workflow logs: only status, sizes, timestamps, SHA-256 and backup file names.

const fs = require("node:fs");
const { formatStamp, backupFiles, isSunday, stampToDate } = require("./lib/naming");
const { selectForDeletion } = require("./lib/retention");
const { buildManifest, validateManifest } = require("./lib/manifest");
const { parseDumpLog, parseRestoreLog, compareRestore } = require("./lib/checks");
const { planVerification, verifyBackups } = require("./lib/verify");
const { normalizeEndpoint, classifyToolError, firstFailedStep } = require("./lib/safety");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

function need(args, name) {
  if (args[name] === undefined) throw new Error(`missing --${name}`);
  return args[name];
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const readJsonOrNull = (file) => (file && fs.existsSync(file) ? readJson(file) : null);

function formatSize(bytes) {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]} (${bytes} bytes)`;
}

function failWith(problems) {
  for (const p of problems) console.error(`- ${p}`);
  process.exitCode = 1;
}

const commands = {
  // Shell-sourceable names for a new backup.
  names(args) {
    const now = args.now ? new Date(args.now) : new Date();
    const stamp = formatStamp(now);
    const files = backupFiles(stamp);
    console.log(`STAMP=${stamp}`);
    console.log(`CREATED_AT=${stampToDate(stamp).toISOString()}`);
    console.log(`ARCHIVE_NAME=${files.archive}`);
    console.log(`MANIFEST_NAME=${files.manifest}`);
    console.log(`COUNTS_NAME=${files.counts}`);
    console.log(`IS_SUNDAY=${isSunday(now) ? "true" : "false"}`);
  },

  endpoint() {
    const { url, region } = normalizeEndpoint(process.env.B2_ENDPOINT);
    console.log(`B2_ENDPOINT_URL=${url}`);
    console.log(`AWS_DEFAULT_REGION=${region}`);
  },

  check(args) {
    const database = need(args, "database");
    const result = compareRestore({
      dumpCounts: parseDumpLog(fs.readFileSync(need(args, "dump-log"), "utf8"), database),
      restoreCounts: parseRestoreLog(fs.readFileSync(need(args, "restore-log"), "utf8"), database),
      source: readJson(need(args, "source")),
      restored: readJson(need(args, "restored")),
      required: String(args.required || "").split(",").filter(Boolean),
    });
    if (!result.ok) {
      console.error("Sanity checks failed:");
      return failWith(result.problems);
    }
    fs.writeFileSync(need(args, "counts-out"), JSON.stringify({ createdAt: need(args, "created-at"), database, collections: result.counts }, null, 2), { mode: 0o600 });
    console.log("Sanity checks passed: collections, document counts, indexes and required collections all match.");
  },

  manifest(args) {
    const manifest = buildManifest({
      createdAt: need(args, "created-at"),
      sizeBytes: Number(need(args, "size")),
      sha256: need(args, "sha256"),
      tools: { mongodump: need(args, "mongodump"), age: need(args, "age"), restoreCheckMongo: need(args, "restore-mongo") },
    });
    fs.writeFileSync(need(args, "out"), `${JSON.stringify(manifest, null, 2)}\n`);
  },

  summary(args) {
    const manifest = readJson(need(args, "manifest"));
    const problems = validateManifest(manifest);
    if (problems.length) return failWith(problems);
    console.log(`### ${need(args, "title")}\n`);
    console.log("| | |\n| --- | --- |");
    console.log(`| Status | ${need(args, "status")} |`);
    console.log(`| Backup taken | ${manifest.createdAt} |`);
    if (args["checked-at"]) console.log(`| Checked | ${args["checked-at"]} |`);
    console.log(`| Encrypted size | ${formatSize(manifest.sizeBytes)} |`);
    console.log(`| SHA-256 | \`${manifest.sha256}\` |`);
  },

  // Tab-separated "key<TAB>versionId" lines to delete.
  retention(args) {
    const keep = Number(need(args, "keep"));
    for (const { key, versionId } of selectForDeletion(readJson(need(args, "listing")), { keep, protect: args.protect })) {
      console.log(`${key}\t${versionId}`);
    }
  },

  "verify-plan"(args) {
    const { newest, previous } = planVerification(readJson(need(args, "listing")));
    console.log(`NEWEST_STAMP=${newest ? newest.stamp : ""}`);
    console.log(`PREVIOUS_STAMP=${previous ? previous.stamp : ""}`);
  },

  verify(args) {
    const problems = verifyBackups({
      daily: readJson(need(args, "daily")),
      weekly: readJson(need(args, "weekly")),
      newestManifest: readJsonOrNull(args["newest-manifest"]),
      previousManifest: readJsonOrNull(args["previous-manifest"]),
      downloaded: args.sha256 ? { sha256: args.sha256, size: Number(args.size) } : null,
      now: args.now ? new Date(args.now) : new Date(),
    });
    if (problems.length) {
      console.error("Backup verification failed:");
      return failWith(problems);
    }
    console.log("Backup verification passed.");
  },

  "classify-error"(args) {
    const file = args._[1];
    console.log(classifyToolError(file && fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""));
  },

  "failed-step"() {
    console.log(firstFailedStep(process.env.STEPS_JSON || "{}"));
  },
};

function main(argv) {
  const args = parseArgs(argv);
  const command = commands[args._[0]];
  if (!command) {
    console.error(`usage: cli.js <${Object.keys(commands).join("|")}> [--option value ...]`);
    process.exitCode = 2;
    return;
  }
  try {
    command(args);
  } catch (error) {
    // Our own error messages never include data; anything else is reduced to its type.
    console.error(error instanceof SyntaxError ? "a file could not be parsed as JSON" : error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { main, formatSize };

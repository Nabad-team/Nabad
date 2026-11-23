#!/usr/bin/env node
// SCRUM-348: the triage safety run on a release candidate, with the results recorded.
//
// Runs every case of the clinical safety set (tests/triage-safety, 109 cases) and the quality set
// (tests/triage-quality, 50 cases) through the same function as POST /api/triage/ai-assess, and writes a
// dated record: the level each case got, whether it was safe, and a scorecard per set.
//
//   node scripts/triage-safety-run.cjs                         the rules alone (AI off), as in CI
//   node scripts/triage-safety-run.cjs --ai                    with the model configured by the LLM_* variables
//   node scripts/triage-safety-run.cjs --out ../docs/triage-safety-runs/2026-11-27-rc
//                                                              also writes <out>.json and <out>.md
//
// Options: --ai, --out <path without extension>, --delay-ms <n> (between model calls, default 4000 with --ai,
// so 159 cases stay inside a free per-minute quota), --label <text> (e.g. "release candidate").
//
// A case is safe when its level is between `expected` (the least urgent safe level) and `maxAcceptable`.
// The quality set has no range: its `expected` level is used as both ends, so any other level is reported
// (less urgent as under-triage, more urgent as over-triage), as in tests/triageQuality.test.js.
// Exit code 1 when any case is under-triaged, or over-triaged beyond its range without a documented note.
// Symptom texts are synthetic test cases, so they can be printed; nothing here touches the database.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { assessWithAi } = require("../src/triage/ai/aiTriage");

const ORDER = ["emergency", "urgent", "soon", "routine"]; // most to least urgent
const rank = (level) => ORDER.indexOf(level);

function readArgs(argv) {
  const args = { ai: false, out: null, delayMs: null, label: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--ai") args.ai = true;
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--delay-ms") args.delayMs = Number(argv[++i]);
    else if (arg === "--label") args.label = argv[++i] || "";
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (args.delayMs === null) args.delayMs = args.ai ? 4000 : 0;
  if (!Number.isInteger(args.delayMs) || args.delayMs < 0) throw new Error("--delay-ms must be a whole number of milliseconds");
  return args;
}

function verdict(item, level) {
  const max = item.maxAcceptable || item.expected;
  if (rank(level) > rank(item.expected)) return "under";
  if (rank(level) < rank(max)) return item.knownOverTriage ? "known-over" : "over";
  return "safe";
}

function git(command) {
  try { return execSync(`git ${command}`, { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; }
}

function matrix(rows) {
  const counts = Object.fromEntries(ORDER.map((expected) => [expected, Object.fromEntries(ORDER.map((given) => [given, 0]))]));
  for (const row of rows) counts[row.expected][row.given] += 1;
  return counts;
}

function matrixMarkdown(rows) {
  const counts = matrix(rows);
  const lines = ["| Expected \\ Given | emergency | urgent | soon | routine | Cases |", "| --- | ---: | ---: | ---: | ---: | ---: |"];
  for (const expected of ORDER) {
    const cells = ORDER.map((given) => (given === expected ? `**${counts[expected][given]}**` : String(counts[expected][given])));
    lines.push(`| **${expected}** | ${cells.join(" | ")} | ${ORDER.reduce((sum, given) => sum + counts[expected][given], 0)} |`);
  }
  return lines.join("\n");
}

function summarise(rows) {
  const count = (value) => rows.filter((row) => row.verdict === value).length;
  return {
    cases: rows.length, safe: count("safe"), under: count("under"), over: count("over"), knownOver: count("known-over"),
    exact: rows.filter((row) => row.given === row.expected).length,
    aiUsed: rows.filter((row) => row.aiUsed).length,
  };
}

// makeClient: a new model client per case, as the API makes one per request (null: AI off).
async function runSet(name, cases, { makeClient, delayMs }) {
  const rows = [];
  for (const item of cases) {
    const client = makeClient();
    const result = await assessWithAi(item.says, { answers: item.answers, ...(client ? { client } : {}) });
    rows.push({
      set: name, id: item.id, kind: item.kind || "quality", expected: item.expected, maxAcceptable: item.maxAcceptable || item.expected,
      given: result.level, verdict: verdict(item, result.level),
      aiUsed: Boolean(result.ai?.used), aiReason: result.ai?.reason || null,
      matchedRuleIds: result.matchedRuleIds || [],
    });
    if (client && delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return rows;
}

function report({ args, commit, branch, startedAt, durationMs, model, sets }) {
  const all = sets.flatMap((set) => set.rows);
  const problems = all.filter((row) => row.verdict === "under" || row.verdict === "over");
  const lines = [
    `# Triage safety run${args.label ? `: ${args.label}` : ""}`,
    "",
    `- **Date:** ${startedAt.toISOString()}`,
    `- **Commit:** ${commit || "unknown"}${branch ? ` (${branch})` : ""}`,
    `- **Model:** ${model}`,
    `- **Command:** \`node scripts/triage-safety-run.cjs${args.ai ? " --ai" : ""}${args.label ? ` --label "${args.label}"` : ""}${args.out ? ` --out ${args.out}` : ""}\` (from \`backend\`)`,
    `- **Duration:** ${Math.round(durationMs / 100) / 10} s`,
    `- **Result:** ${problems.length ? `**${problems.length} case(s) outside their safe range**` : "every case inside its safe range"}`,
    "",
  ];
  for (const set of sets) {
    const summary = summarise(set.rows);
    lines.push(`## ${set.title}`, "");
    lines.push(`- ${summary.safe + summary.knownOver} / ${summary.cases} safe; ${summary.exact} / ${summary.cases} exactly the expected level`);
    lines.push(`- Under-triaged: **${summary.under}**`);
    lines.push(`- Over-triaged beyond the acceptable level: **${summary.over}**${summary.knownOver ? `; known and documented: ${summary.knownOver} (${set.rows.filter((row) => row.verdict === "known-over").map((row) => row.id).join(", ")})` : ""}`);
    if (args.ai) lines.push(`- The model's answer was used in ${summary.aiUsed} case(s); the others were emergencies answered by the rules, or the model was unavailable (see the JSON for each reason).`);
    lines.push("", matrixMarkdown(set.rows), "");
  }
  if (problems.length) {
    lines.push("## Cases outside their safe range", "", "| Set | Case | Expected | Max acceptable | Given | Verdict | Rules matched |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const row of problems) lines.push(`| ${row.set} | ${row.id} | ${row.expected} | ${row.maxAcceptable} | ${row.given} | ${row.verdict} | ${row.matchedRuleIds.join(", ") || "none"} |`);
    lines.push("");
  }
  return { markdown: lines.join("\n").trimEnd(), problems };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  let makeClient = () => null;
  let model = "none: AI off, the safety rules alone (what users get when the model is off, slow or over its limit)";
  if (args.ai) {
    const { getTriageLlmClient } = require("../src/triage/ai/modelAccess");
    makeClient = () => getTriageLlmClient();
    if (!makeClient()) throw new Error("--ai needs LLM_PROVIDER, LLM_API_URL, LLM_API_KEY and LLM_MODEL (see docs/ai-fallback.md)");
    model = `${process.env.LLM_PROVIDER || "openai-compatible"} ${process.env.LLM_MODEL || ""}`.trim() + (process.env.LLM_FALLBACK_MODEL ? `, backup ${process.env.LLM_FALLBACK_MODEL}` : "");
  }
  const safety = require("../tests/triage-safety/cases.json").cases;
  const quality = require("../tests/triage-quality/cases.json").cases;
  const startedAt = new Date();
  const started = Date.now();
  const sets = [
    { name: "safety", title: `Clinical safety set (${safety.length} cases, tests/triage-safety)`, rows: await runSet("safety", safety, { makeClient, delayMs: args.delayMs }) },
    { name: "quality", title: `Quality set (${quality.length} cases, tests/triage-quality)`, rows: await runSet("quality", quality, { makeClient, delayMs: args.delayMs }) },
  ];
  const commit = process.env.GITHUB_SHA || git("rev-parse --short HEAD");
  const branch = [git("rev-parse --abbrev-ref HEAD")].map((name) => (name === "HEAD" ? null : name))[0];
  const { markdown, problems } = report({ args, commit, branch, startedAt, durationMs: Date.now() - started, model, sets });
  process.stdout.write(`${markdown}\n`);
  if (args.out) {
    const out = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(`${out}.md`, `${markdown}\n`);
    fs.writeFileSync(`${out}.json`, `${JSON.stringify({
      date: startedAt.toISOString(), commit, branch, model, label: args.label,
      summary: Object.fromEntries(sets.map((set) => [set.name, summarise(set.rows)])),
      cases: sets.flatMap((set) => set.rows),
    }, null, 2)}\n`);
    process.stderr.write(`Wrote ${out}.md and ${out}.json\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  process.exitCode = problems.length ? 1 : 0;
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
}

module.exports = { verdict, summarise, matrix, readArgs };

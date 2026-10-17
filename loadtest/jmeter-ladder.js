// Runs local JMeter traffic in increasing concurrency steps and stops when the app degrades.
// Usage: node loadtest/jmeter-ladder.js (JMeter must be installed and on PATH).
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const jmeter = process.env.JMETER || "jmeter";
const host = process.env.HOST || "localhost";
const port = process.env.PORT || "3000";
const protocol = process.env.PROTOCOL || "http";
const levels = (process.env.LEVELS || "10,25,50,100,200,500").split(",").map(Number);
const rampSeconds = Number(process.env.RAMP_SECONDS || 30);
const holdSeconds = Number(process.env.HOLD_SECONDS || 60);
const errorStopPct = Number(process.env.ERROR_STOP_PCT || 5);
const p95StopMs = Number(process.env.P95_STOP_MS || 2000);
const loopback = ["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase());

if (!loopback && process.env.ALLOW_EXTERNAL_TARGET !== "true") {
  throw new Error("Refusing non-local target. Set ALLOW_EXTERNAL_TARGET=true only if you own or are authorized to test it.");
}
if (!levels.length || levels.some((value) => !Number.isInteger(value) || value < 1) || !Number.isFinite(rampSeconds) || rampSeconds < 1 || !Number.isFinite(holdSeconds) || holdSeconds < 1) {
  throw new Error("LEVELS must be positive whole numbers; RAMP_SECONDS and HOLD_SECONDS must be positive.");
}

const plan = path.join(__dirname, "nabad.jmx");
const resultsDir = path.join(__dirname, "jmeter-results");
fs.mkdirSync(resultsDir, { recursive: true });

function parseCsvLine(line) {
  const result = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { result.push(value); value = ""; }
    else value += char;
  }
  result.push(value);
  return result;
}

function summarize(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  if (lines.length < 2) return { count: 0, errors: 1, errorPct: 100, p95: Infinity };
  const headers = parseCsvLine(lines[0]);
  const column = Object.fromEntries(headers.map((name, index) => [name, index]));
  const samples = lines.slice(1).map(parseCsvLine);
  const failed = samples.filter((row) => row[column.success] !== "true").length;
  const times = samples.map((row) => Number(row[column.elapsed])).filter(Number.isFinite).sort((a, b) => a - b);
  return { count: samples.length, errors: failed, errorPct: samples.length ? (100 * failed) / samples.length : 100, p95: times.length ? times[Math.ceil(times.length * 0.95) - 1] : Infinity };
}

function healthIsUp() {
  const url = `${protocol}://${host}:${port}/api/health`;
  const check = spawnSync(process.execPath, ["-e", `fetch(${JSON.stringify(url)}, { signal: AbortSignal.timeout(3000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))`], { stdio: "ignore" });
  return check.status === 0;
}

const rows = [];
for (const threads of levels) {
  const jtl = path.join(resultsDir, `visitors-${threads}.csv`);
  console.log(`\n=== ${threads} virtual visitors: ramp ${rampSeconds}s, hold ${holdSeconds}s ===`);
  const run = spawnSync(jmeter, [
    "-n", "-t", plan, "-l", jtl,
    `-Jhost=${host}`, `-Jport=${port}`, `-Jprotocol=${protocol}`,
    `-Jthreads=${threads}`, `-JrampSeconds=${rampSeconds}`, `-JholdSeconds=${holdSeconds}`,
  ], { stdio: "inherit", env: process.env });
  if (run.error) throw new Error(`Could not launch JMeter (${jmeter}): ${run.error.message}`);
  if (run.status !== 0) throw new Error(`JMeter exited with code ${run.status}`);

  const stats = summarize(jtl);
  rows.push({ threads, ...stats });
  console.log(`${stats.count} samples; ${stats.errors} failed (${stats.errorPct.toFixed(2)}%); p95 ${Number.isFinite(stats.p95) ? `${Math.round(stats.p95)} ms` : "n/a"}`);
  if (!healthIsUp()) {
    console.error("Health check failed after this stage. Stopping the ramp; restart/recover the local app before another run.");
    break;
  }
  if (stats.errorPct >= errorStopPct || stats.p95 >= p95StopMs) {
    console.error(`Stopping the ramp: error rate reached ${errorStopPct}% or p95 reached ${p95StopMs} ms.`);
    break;
  }
}

const report = [
  "| Virtual visitors | Samples | Failed | Error rate | p95 |",
  "|---:|---:|---:|---:|---:|",
  ...rows.map((row) => `| ${row.threads} | ${row.count} | ${row.errors} | ${row.errorPct.toFixed(2)}% | ${Number.isFinite(row.p95) ? `${Math.round(row.p95)} ms` : "n/a"} |`),
].join("\n");
fs.writeFileSync(path.join(resultsDir, "summary.md"), `${report}\n`);
console.log(`\n${report}\n\nRaw JMeter files: ${resultsDir}`);

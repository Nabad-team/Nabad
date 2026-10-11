// Runs every scenario at each load level and prints one results table.
// Start the backend first (node loadtest/start-backend.js), then: node loadtest/run-all.js
// Optional: LEVELS=10,50 DURATION=30s SCENARIOS=me K6="C:\Program Files\k6\k6.exe"
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const K6 = process.env.K6 || "k6";
const API = process.env.BASE_URL || "http://localhost:5100/api";
const LEVELS = (process.env.LEVELS || "10,50,100,250,500").split(",").map(Number);
const SCENARIOS = {
  "public-pages": ["session", "health"],
  "signup-login": ["signup", "login"],
  me: ["me"],
};
const chosen = process.env.SCENARIOS ? process.env.SCENARIOS.split(",") : Object.keys(SCENARIOS);
const resultsDir = path.join(__dirname, "results");
fs.mkdirSync(resultsDir, { recursive: true });

// After a heavy level the backend may still be working through abandoned requests.
// Wait until /health answers quickly again so levels do not leak into each other.
async function waitUntilIdle() {
  for (let calm = 0, tries = 0; calm < 3 && tries < 240; tries++) {
    const start = Date.now();
    try { await fetch(`${API}/health`); calm = Date.now() - start < 50 ? calm + 1 : 0; } catch { calm = 0; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const ms = (value) => (value === undefined ? "-" : value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`);
const pct = (value) => `${(100 * value).toFixed(1)}%`;

(async () => {
  const rows = [];
  for (const scenario of chosen) {
    for (const vus of LEVELS) {
      await waitUntilIdle();
      const summaryFile = path.join(resultsDir, `${scenario}-${vus}.json`);
      console.error(`▶ ${scenario} with ${vus} users`);
      const run = spawnSync(K6, ["run", "--quiet", path.join(__dirname, `${scenario}.js`)], {
        env: { ...process.env, VUS: String(vus), SUMMARY_FILE: summaryFile, BASE_URL: API },
        stdio: ["ignore", "ignore", "inherit"],
      });
      if (run.error) throw run.error;
      const m = JSON.parse(fs.readFileSync(summaryFile, "utf8")).metrics;
      // Only the tagged requests of the scenario count (not e.g. the signups in me.js setup()).
      const names = SCENARIOS[scenario];
      const rps = names.reduce((sum, name) => sum + m[`http_reqs{name:${name}}`].values.rate, 0);
      const okRps = names.reduce((sum, name) => sum + m[`http_reqs{name:${name}}`].values.rate * (1 - m[`http_req_failed{name:${name}}`].values.rate), 0);
      const failed = 1 - okRps / rps;
      rows.push({
        scenario, vus, rps, okRps,
        p95: SCENARIOS[scenario].map((name) => `${name} ${ms(m[`http_req_duration{name:${name}}`]?.values["p(95)"])}`).join(", "),
        errors: failed,
      });
    }
  }
  const table = [
    "| Scenario | Users | Requests/s | Successful/s | p95 response time | Error rate |",
    "|---|---:|---:|---:|---|---:|",
    ...rows.map((r) => `| ${r.scenario} | ${r.vus} | ${r.rps.toFixed(0)} | ${r.okRps.toFixed(0)} | ${r.p95} | ${pct(r.errors)} |`),
  ].join("\n");
  fs.writeFileSync(path.join(resultsDir, "table.md"), table + "\n");
  console.log(table);
})().catch((error) => { console.error(error); process.exit(1); });

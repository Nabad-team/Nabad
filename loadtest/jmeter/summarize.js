// Prints the README results table (Markdown) from the HTML reports in loadtest/jmeter/reports/.
// Usage (from the repo root): node loadtest/jmeter/summarize.js
// Numbers come from each report's statistics.json (the same as the dashboard's "Statistics" table) and run.json.
const fs = require("fs");
const path = require("path");

const reportsDir = path.join(__dirname, "reports");
const order = ["load", "stress", "spike", "soak", "prod"];
const ms = (value) => (value >= 10000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`);

const rows = fs.readdirSync(reportsDir)
  .filter((name) => fs.existsSync(path.join(reportsDir, name, "run.json")))
  .map((name) => {
    const run = JSON.parse(fs.readFileSync(path.join(reportsDir, name, "run.json"), "utf8"));
    const total = JSON.parse(fs.readFileSync(path.join(reportsDir, name, "statistics.json"), "utf8")).Total;
    return { name, run, total };
  })
  .sort((a, b) => order.indexOf(a.run.type) - order.indexOf(b.run.type) || (a.run.browse + a.run.app) - (b.run.browse + b.run.app) || a.name.localeCompare(b.name));

console.log("| Run | Users (browsing + signed-in) | Requests/s | Average | Median | p90 | p95 | p99 | Errors |");
console.log("|---|---|---:|---:|---:|---:|---:|---:|---:|");
for (const { name, run, total } of rows) {
  const spike = run.spikeBrowse + run.spikeApp ? ` → ${run.browse + run.spikeBrowse} + ${run.app + run.spikeApp}` : "";
  const stopped = run.stoppedEarly ? ` (stopped after ${run.stoppedEarly.afterSeconds} s)` : "";
  console.log(`| [${name}](reports/${name}/index.html)${stopped} | ${run.browse} + ${run.app}${spike} | ${total.throughput.toFixed(1)} | ` +
    `${ms(total.meanResTime)} | ${ms(total.medianResTime)} | ${ms(total.pct1ResTime)} | ${ms(total.pct2ResTime)} | ${ms(total.pct3ResTime)} | ${total.errorPct.toFixed(2)}% |`);
}

// Runs nabad.jmx in non-GUI mode and writes one HTML dashboard per run to loadtest/jmeter/reports/<name>/.
// Usage (from the repo root):
//   node loadtest/jmeter/run.js load [50 200 500]  local Docker stack; half the users browse, half are signed in
//   node loadtest/jmeter/run.js stress             browsing at 1000/2000/4000, signed-in at 1000/2000, 1-5 s think
//                                                  time; a step stops early once errors stay above 20%
//   node loadtest/jmeter/run.js spike              50 users, +950 within 10 s for 2 minutes, then back to 50
//   node loadtest/jmeter/run.js soak               200 users for 15 minutes
//   node loadtest/jmeter/run.js prod               https://nabad-psi.vercel.app, read-only: public pages and
//                                                  /api/health/ready, 5 users, no logins, nothing written
// Each report folder also gets run.json (the settings and how the run ended), timeline.csv (10 s windows,
// made from the raw results) and, for local runs, docker-stats.csv (container CPU and memory every 15 s).
// The raw .jtl results are deleted once those are written.
// Options: RAMPUP / DURATION (seconds) override the profile, ONLY (regex: run only matching run names, e.g.
// ONLY=browse), COOLDOWN (seconds between runs, default 30), PROD_USERS (default 5), JMETER (path to jmeter.bat
// or jmeter; default %LOCALAPPDATA%\Programs\apache-jmeter-5.6.3\bin\jmeter.bat), JMETER_JAVA_HOME.
const { spawn, spawnSync, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const here = __dirname;
const reportsDir = path.join(here, "reports");
const jmeter = process.env.JMETER || (process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA || "", "Programs", "apache-jmeter-5.6.3", "bin", "jmeter.bat")
  : "jmeter");
const [mode = "load", ...levelArgs] = process.argv.slice(2);
const LOCAL = { protocol: "http", host: "localhost", port: "3000" };
const PRODUCTION = { protocol: "https", host: "nabad-psi.vercel.app", port: "443" };
const CONTAINERS = ["nabad-backend-1", "nabad-frontend-1", "nabad-mongo-1"];
const num = (value, fallback) => Number(value || fallback);

// Each run: browse/app = users in thread groups A/B; spikeBrowse/spikeApp = extra users (C/D) that join after
// spikeDelay seconds within spikeRampup and stay spikeDuration seconds. thinkMin/thinkExtra in ms.
function runs() {
  const base = { target: LOCAL, spikeBrowse: 0, spikeApp: 0, thinkMin: 500, thinkExtra: 1000, stopErrorPct: null };
  const timing = (rampup, duration) => ({ rampup: num(process.env.RAMPUP, rampup), duration: num(process.env.DURATION, duration) });
  switch (mode) {
    case "load":
    case "local": {
      const levels = (levelArgs.length ? levelArgs : ["50", "200", "500"]).map(Number);
      if (levels.some((n) => !Number.isInteger(n) || n < 2)) throw new Error("User counts must be whole numbers of at least 2.");
      return levels.map((users) => ({ ...base, type: "load", name: `load-${users}-users`,
        browse: Math.floor(users / 2), app: users - Math.floor(users / 2), ...timing(60, 180) }));
    }
    case "stress": {
      // Longer, random pauses (1-5 s) like people reading a page; 60 s ramp-up, then 2 minutes at full load.
      const stress = { ...base, type: "stress", thinkMin: 1000, thinkExtra: 4000, stopErrorPct: 20, ...timing(60, 180) };
      return [
        ...[1000, 2000, 4000].map((users) => ({ ...stress, name: `stress-browse-${users}-users`, browse: users, app: 0 })),
        ...[1000, 2000].map((users) => ({ ...stress, name: `stress-signed-in-${users}-users`, browse: 0, app: users })),
      ];
    }
    case "spike":
      // 1 minute at 50 users, then +950 within 10 s for 2 minutes, then 2 minutes back at 50 to watch recovery.
      return [{ ...base, type: "spike", name: "spike-50-to-1000-users", browse: 25, app: 25, spikeBrowse: 475, spikeApp: 475,
        rampup: 20, spikeDelay: 60, spikeRampup: 10, spikeDuration: 130, duration: 310 }];
    case "soak":
      return [{ ...base, type: "soak", name: "soak-200-users-15-min", browse: 100, app: 100, ...timing(60, 900) }];
    case "prod": {
      const users = num(process.env.PROD_USERS, 5);
      if (!Number.isInteger(users) || users < 1 || users > 10) throw new Error("PROD_USERS must be 1-10: the production run is a light check, not a load test.");
      // app is always 0 here: no logins and no writes against production.
      return [{ ...base, type: "prod", name: `prod-${users}-users`, target: PRODUCTION, browse: users, app: 0, ...timing(10, 120) }];
    }
    default:
      throw new Error(`Unknown mode "${mode}". Use load, stress, spike, soak or prod.`);
  }
}

// JMeter 5.6.3's Groovy (used by the test plan) supports Java up to 21, and jmeter.bat runs the first java on PATH.
// So a Java 21 goes first on PATH for JMeter only: JMETER_JAVA_HOME, else an installed Temurin 21, else JAVA_HOME.
function javaHome() {
  if (process.env.JMETER_JAVA_HOME) return process.env.JMETER_JAVA_HOME;
  const temurin = path.join(process.env.ProgramFiles || "C:\\Program Files", "Eclipse Adoptium");
  const jdk21 = fs.existsSync(temurin) && fs.readdirSync(temurin).find((name) => /^jdk-21/.test(name));
  return jdk21 ? path.join(temurin, jdk21) : process.env.JAVA_HOME;
}
const java = javaHome();
const env = {
  ...process.env,
  ...(java ? { JAVA_HOME: java, PATH: path.join(java, "bin") + path.delimiter + process.env.PATH } : {}),
  // Thousands of threads and the report generator need more than JMeter's default 1 GB heap; small thread stacks
  // (256 KB) keep 4000 threads within a laptop's memory next to Docker.
  HEAP: process.env.HEAP || "-Xms512m -Xmx2g -XX:MaxMetaspaceSize=256m",
  JVM_ARGS: process.env.JVM_ARGS || "-Xss256k",
};

const quote = (arg) => (/^[\w:.\\/=-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`);
const commandLine = (command, args) => [command, ...args].map(quote).join(" ");
function runSync(command, args) {
  // .bat files need a shell on Windows.
  const result = spawnSync(commandLine(command, args), { stdio: "inherit", shell: true, env });
  if (result.status !== 0) throw new Error(`${path.basename(command)} exited with ${result.status}`);
}

// Runs JMeter, echoing its output. With stopErrorPct, it watches the 10-second summaries and asks JMeter for a
// graceful shutdown (bin/shutdown, which still writes the report) once two in a row are above that error rate.
function runJmeter(args, stopErrorPct) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandLine(jmeter, args), { shell: true, env, stdio: ["ignore", "pipe", "inherit"] });
    const started = Date.now();
    let over = 0;
    let stoppedEarly = null;
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        const match = line.match(/^summary \+.*Err:\s+\d+ \(([\d.]+)%\)/);
        if (!match || stopErrorPct == null || stoppedEarly) continue;
        over = Number(match[1]) > stopErrorPct ? over + 1 : 0;
        if (over >= 2) {
          stoppedEarly = { afterSeconds: Math.round((Date.now() - started) / 1000), reason: `error rate above ${stopErrorPct}% for 20 s` };
          console.log(`\n>> Stopping early: ${stoppedEarly.reason} (after ${stoppedEarly.afterSeconds} s)`);
          const shutdown = path.join(path.dirname(jmeter), process.platform === "win32" ? "shutdown.cmd" : "shutdown.sh");
          spawn(commandLine(shutdown, []), { shell: true, env, stdio: "ignore" });
        }
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve(stoppedEarly) : reject(new Error(`jmeter exited with ${code}`))));
  });
}

// CPU and memory of the stack's containers every 15 s while a local run is going.
function watchContainers(file) {
  const rows = [];
  const started = Date.now();
  const sample = () => new Promise((resolve) => {
    execFile("docker", ["stats", "--no-stream", "--format", "{{.Name}},{{.CPUPerc}},{{.MemUsage}}", ...CONTAINERS], (error, stdout) => {
      const t = Math.round((Date.now() - started) / 1000);
      if (!error) for (const line of stdout.trim().split(/\r?\n/)) {
        const [name, cpu, mem] = line.split(",");
        rows.push({ t, name, cpu: cpu.replace("%", ""), mem: mem.split("/")[0].trim() });
      }
      resolve();
    });
  });
  let timer;
  const first = sample().then(() => { timer = setInterval(sample, 15000); });
  return {
    async stop() {
      await first;
      clearInterval(timer);
      await sample();
      fs.writeFileSync(file, "seconds,container,cpu_percent,memory\n" + rows.map((r) => `${r.t},${r.name},${r.cpu},${r.mem}`).join("\n") + "\n");
      const backend = rows.filter((r) => r.name === "nabad-backend-1");
      return backend.length ? { start: backend[0].mem, end: backend[backend.length - 1].mem, peak: peakOf(backend.map((r) => r.mem)) } : null;
    },
  };
}
const toMiB = (text) => { const [, n, unit] = text.match(/([\d.]+)\s*(\w+)/) || []; return Number(n) * ({ KiB: 1 / 1024, MiB: 1, GiB: 1024 }[unit] || 1); };
const peakOf = (values) => values.reduce((a, b) => (toMiB(b) > toMiB(a) ? b : a));

// The .jtl is CSV whose failure messages can contain quoted newlines; this reads it field by field.
function* csvRows(text) {
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      yield row; row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); yield row; }
}

// 10-second windows over the whole run: users, requests/s, response times and errors (all samples, and split
// into login / other signed-in calls / browsing), so the README can show how a run changed over time.
function writeTimeline(jtl, file) {
  const rows = csvRows(fs.readFileSync(jtl, "utf8"));
  const header = rows.next().value;
  const col = Object.fromEntries(header.map((name, i) => [name, i]));
  const windows = new Map();
  let first = Infinity;
  const samples = [];
  for (const row of rows) {
    if (row.length < header.length) continue;
    const ts = Number(row[col.timeStamp]);
    first = Math.min(first, ts);
    samples.push([ts, Number(row[col.elapsed]), row[col.success] === "true", Number(row[col.allThreads]), row[col.label]]);
  }
  for (const [ts, elapsed, ok, threads, label] of samples) {
    const w = Math.floor((ts - first) / 10000);
    if (!windows.has(w)) windows.set(w, { all: [], login: [], app: [], browse: [], errors: 0, threads: 0 });
    const win = windows.get(w);
    win.all.push(elapsed);
    (label.startsWith("S01") ? win.login : label.startsWith("S") ? win.app : win.browse).push(elapsed);
    if (!ok) win.errors++;
    win.threads = Math.max(win.threads, threads);
  }
  const pct = (list, p) => { if (!list.length) return ""; const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
  const avg = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : "");
  const lines = ["seconds,users,requests_per_s,avg_ms,median_ms,p95_ms,error_pct,login_p95_ms,signed_in_p95_ms,browse_p95_ms"];
  for (const [w, win] of [...windows].sort((a, b) => a[0] - b[0])) {
    lines.push([w * 10, win.threads, (win.all.length / 10).toFixed(1), avg(win.all), pct(win.all, 50), pct(win.all, 95),
      ((100 * win.errors) / win.all.length).toFixed(2), pct(win.login, 95), pct(win.app, 95), pct(win.browse, 95)].join(","));
  }
  fs.writeFileSync(file, lines.join("\n") + "\n");
}

function sizeOf(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? sizeOf(full) : fs.statSync(full).size);
  }, 0);
}

(async () => {
  fs.mkdirSync(reportsDir, { recursive: true });
  const selected = runs().filter((r) => !process.env.ONLY || new RegExp(process.env.ONLY).test(r.name));
  for (const [index, r] of selected.entries()) {
    // A pause between runs, so requests still queued from the last one don't spill into the next.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, num(process.env.COOLDOWN, 30) * 1000));
    const { protocol, host, port } = r.target;
    const local = r.target === LOCAL;
    if (!local && (r.app || r.spikeApp)) throw new Error("Signed-in users only ever run against the local stack.");
    // Fresh accounts and no medications left from the last run, so every run starts from the same data.
    if (local) runSync(process.execPath, [path.join(here, "seed-users.js"), String(Math.max(r.app + r.spikeApp, 1))]);
    const out = path.join(reportsDir, r.name);
    const jtl = path.join(reportsDir, `${r.name}.jtl`);
    const log = path.join(os.tmpdir(), `nabad-jmeter-${r.name}.log`);
    fs.rmSync(out, { recursive: true, force: true });
    fs.rmSync(jtl, { force: true });
    const spikeText = r.spikeBrowse + r.spikeApp ? `, +${r.spikeBrowse + r.spikeApp} after ${r.spikeDelay} s for ${r.spikeDuration} s` : "";
    console.log(`\n== ${r.name}: ${r.browse} browsing + ${r.app} signed-in users${spikeText}, ${r.rampup} s ramp-up, ${r.duration} s total, ${protocol}://${host}`);
    const containers = local ? watchContainers(path.join(reportsDir, `${r.name}-docker-stats.csv`)) : null;
    const stoppedEarly = await runJmeter([
      "-n", "-t", path.join(here, "nabad.jmx"), "-l", jtl, "-j", log, "-e", "-o", out,
      `-Jprotocol=${protocol}`, `-Jhost=${host}`, `-Jport=${port}`,
      `-Jorigin=${protocol}://${host}${local ? `:${port}` : ""}`,
      `-Jbrowse_users=${r.browse}`, `-Japp_users=${r.app}`, `-Jrampup=${r.rampup}`, `-Jduration=${r.duration}`,
      `-Jspike_browse_users=${r.spikeBrowse}`, `-Jspike_app_users=${r.spikeApp}`,
      ...(r.spikeBrowse + r.spikeApp ? [`-Jspike_delay=${r.spikeDelay}`, `-Jspike_rampup=${r.spikeRampup}`, `-Jspike_duration=${r.spikeDuration}`] : []),
      `-Jthink_min_ms=${r.thinkMin}`, `-Jthink_extra_ms=${r.thinkExtra}`,
      `-Jusers_csv=${path.join(here, "users.csv")}`,
      "-Jsummariser.interval=10",
      // 5 s points in the over-time charts (the default, 60 s, gives only 3 points for a 3-minute run).
      "-Jjmeter.reportgenerator.overall_granularity=5000",
      `-Jjmeter.reportgenerator.report_title=Nabad ${r.name}`,
    ], r.stopErrorPct);
    const memory = containers ? await containers.stop() : null;
    if (containers) fs.renameSync(path.join(reportsDir, `${r.name}-docker-stats.csv`), path.join(out, "docker-stats.csv"));
    writeTimeline(jtl, path.join(out, "timeline.csv"));
    fs.rmSync(jtl, { force: true });
    fs.rmSync(log, { force: true });
    const { target, ...settings } = r;
    fs.writeFileSync(path.join(out, "run.json"), JSON.stringify({ ...settings, target: `${protocol}://${host}`, date: new Date().toISOString(),
      stoppedEarly, backendMemory: memory }, null, 2) + "\n");
    const total = JSON.parse(fs.readFileSync(path.join(out, "statistics.json"), "utf8")).Total;
    console.log(`${r.name}: ${total.sampleCount} requests, ${total.throughput.toFixed(1)}/s, avg ${total.meanResTime.toFixed(0)} ms, ` +
      `p95 ${total.pct2ResTime.toFixed(0)} ms, errors ${total.errorPct.toFixed(2)}%${stoppedEarly ? " (stopped early)" : ""}` +
      `${memory ? `, backend memory ${memory.start} -> ${memory.end}` : ""} (report ${(sizeOf(out) / 1e6).toFixed(1)} MB)`);
  }
})().catch((error) => { console.error(error); process.exit(1); });

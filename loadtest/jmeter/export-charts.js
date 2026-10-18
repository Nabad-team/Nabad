// Saves charts from a JMeter HTML dashboard as PNG (for slides), by opening the report in headless Chrome.
// No extra packages: it talks to Chrome over the DevTools protocol with Node's built-in WebSocket (Node 22+).
// Usage (from the repo root): node loadtest/jmeter/export-charts.js [report folder name] [chart ...]
//   default report load-500-users, default charts: all four below (e.g. pass response-times-over-time for one)
// Writes loadtest/jmeter/charts/<report>-<chart>.png. CHROME=path to chrome.exe if it isn't found.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const [report = "load-500-users", ...only] = process.argv.slice(2);
const reportDir = path.join(__dirname, "reports", report);
const outDir = path.join(__dirname, "charts");
const ALL_CHARTS = [
  { file: "response-times-over-time", page: "OverTime.html", id: "flotResponseTimesOverTime" },
  { file: "response-time-percentiles-over-time", page: "OverTime.html", id: "flotResponseTimePercentilesOverTime" },
  { file: "throughput-over-time", page: "Throughput.html", id: "flotTotalTPS" },
  { file: "response-time-percentiles", page: "ResponseTimes.html", id: "flotResponseTimesPercentiles" },
];
const CHARTS = only.length ? ALL_CHARTS.filter((chart) => only.includes(chart.file)) : ALL_CHARTS;
if (!CHARTS.length) throw new Error(`Unknown chart; use: ${ALL_CHARTS.map((chart) => chart.file).join(", ")}`);

function findChrome() {
  const candidates = [
    process.env.CHROME,
    path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const found = candidates.find((file) => file && fs.existsSync(file));
  if (!found) throw new Error("Chrome not found; set CHROME to its path.");
  return found;
}

(async () => {
  if (!fs.existsSync(path.join(reportDir, "index.html"))) throw new Error(`No report at ${reportDir}`);
  fs.mkdirSync(outDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "nabad-charts-"));
  const chrome = spawn(findChrome(), ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let text = "";
    chrome.stderr.on("data", (chunk) => {
      text += chunk;
      const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.on("exit", () => reject(new Error("Chrome exited before it was ready.")));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let nextId = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      return msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
    for (const waiter of waiters.filter((w) => w.method === msg.method)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(msg.params); }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const event = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cmd = (method, params) => send(method, params, sessionId);
  await cmd("Page.enable");
  await cmd("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
  const evaluate = async (expression) => (await cmd("Runtime.evaluate", { expression, returnByValue: true })).result.value;

  for (const chart of CHARTS) {
    const loaded = event("Page.loadEventFired");
    await cmd("Page.navigate", { url: pathToFileURL(path.join(reportDir, "content", "pages", chart.page)).href });
    await loaded;
    // Some panels start collapsed: open them with their own toggle, so the dashboard draws the chart.
    await evaluate(`(() => {
      const body = document.getElementById(${JSON.stringify(chart.id)}).closest('[id^="body"]');
      if (body && !body.classList.contains("in")) document.querySelector('[href="#' + body.id + '"]').click();
    })()`);
    // The dashboard draws its charts with flot after load: wait for this chart's canvas.
    for (let i = 0; i < 50 && !(await evaluate(`!!document.querySelector("#${chart.id} canvas")`)); i++) await delay(200);
    await delay(1500);
    const box = await evaluate(`(() => {
      const panel = document.getElementById(${JSON.stringify(chart.id)}).closest(".panel");
      panel.scrollIntoView();
      const r = panel.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
    })()`);
    const { data } = await cmd("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...box, scale: 1 } });
    const file = path.join(outDir, `${report}-${chart.file}.png`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    console.log(`${path.relative(process.cwd(), file)}  ${Math.round(box.width)}x${Math.round(box.height)} css px`);
  }
  ws.close();
  chrome.kill();
  await delay(500);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
})().catch((error) => { console.error(error); process.exit(1); });

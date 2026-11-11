// TEMPORARY, with src/ipDiagnostic.js: the staging-only diagnostic logs IP addresses and nothing else.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { ipDiagnostic } = require("../src/ipDiagnostic");

async function run(environment, headers, trustProxy = 2) {
  const lines = [];
  const app = express();
  app.set("trust proxy", trustProxy);
  app.use(ipDiagnostic(environment, trustProxy, (line) => lines.push(JSON.parse(line))));
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health?email=a@b.c`, { headers });
    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  return lines;
}

test("staging logs the addresses for a diagnostic request, and only addresses", async () => {
  const [line, ...rest] = await run("staging", {
    "X-Nabad-Ip-Diagnostic": "1", "X-Forwarded-For": "203.0.113.7, 198.51.100.2", "X-Real-IP": "203.0.113.7",
    "X-Vercel-Forwarded-For": "not an address <script>", Cookie: "accessToken=secret", "User-Agent": "test-agent",
  });
  assert.equal(rest.length, 0);
  assert.deepEqual(Object.keys(line).sort(), ["event", "headers", "ip", "ips", "socket", "time", "trustProxy"]);
  assert.equal(line.event, "ip_diagnostic");
  assert.equal(line.ip, "203.0.113.7");
  assert.equal(line.socket, "127.0.0.1");
  assert.deepEqual(line.headers["x-forwarded-for"], ["203.0.113.7", "198.51.100.2"]);
  assert.deepEqual(line.headers["x-vercel-forwarded-for"], ["not-an-ip"]);
  const text = JSON.stringify(line);
  for (const leak of ["secret", "test-agent", "a@b.c", "script", "/api/health"]) assert.ok(!text.includes(leak), leak);
});

test("nothing is logged without the diagnostic header", async () => {
  assert.deepEqual(await run("staging", { "X-Forwarded-For": "203.0.113.7" }), []);
  assert.deepEqual(await run("staging", { "X-Nabad-Ip-Diagnostic": "yes" }), []);
});

test("nothing is logged outside staging", async () => {
  for (const environment of ["production", "development", "test"]) {
    assert.deepEqual(await run(environment, { "X-Nabad-Ip-Diagnostic": "1" }), []);
  }
});

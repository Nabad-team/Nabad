// SECURITY_SCAN_RELAXED_RATE_LIMITS: loosens every rate limit for the local PR security scan (security/zap/compose.zap.yml)
// and is refused on staging and production, both at startup and when a limiter is created.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const rateLimit = require("../src/rateLimit");
const { loadConfig } = require("../src/config");

const RELAXED = { SECURITY_SCAN_RELAXED_RATE_LIMITS: "true" };

function appWith(limiter) {
  const app = express();
  app.get("/", limiter, (req, res) => res.json({ ok: true }));
  return app;
}
async function statuses(app, count) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const codes = [];
    for (let i = 0; i < count; i++) codes.push((await fetch(`http://127.0.0.1:${server.address().port}/`)).status);
    return codes;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("limits apply as written unless the scan setting is on", async () => {
  assert.equal(rateLimit.relaxedForScan({}), false);
  assert.equal(rateLimit.relaxedForScan({ SECURITY_SCAN_RELAXED_RATE_LIMITS: "false" }), false);
  const codes = await statuses(appWith(rateLimit({ windowMs: 60000, max: 2 }, {})), 3);
  assert.deepEqual(codes, [200, 200, 429]);
});

test("the scan setting multiplies every limit by 1000 locally", async () => {
  assert.equal(rateLimit.relaxedForScan({ ...RELAXED, APP_ENV: "development" }), true);
  assert.equal(rateLimit.relaxedForScan({ ...RELAXED, NODE_ENV: "test" }), true);
  const codes = await statuses(appWith(rateLimit({ windowMs: 60000, max: 2 }, { ...RELAXED, APP_ENV: "development" })), 25);
  assert.ok(codes.every((code) => code === 200));
  const limiter = rateLimit({ windowMs: 60000, max: () => 1 }, { ...RELAXED, APP_ENV: "development" });
  assert.deepEqual([...new Set(await statuses(appWith(limiter), 5))], [200]);
});

test("the scan setting is refused on staging and production, by APP_ENV or NODE_ENV", () => {
  for (const env of [{ APP_ENV: "staging" }, { APP_ENV: "production" }, { NODE_ENV: "production" }, { NODE_ENV: "staging" }]) {
    assert.throws(() => rateLimit.relaxedForScan({ ...RELAXED, ...env }), /only for the local security scan/);
    assert.throws(() => rateLimit({ max: 5 }, { ...RELAXED, ...env }), /only for the local security scan/);
  }
});

test("loadConfig names the scan setting when it is the only problem on a hosted environment", () => {
  // Valid staging settings except for the scan flag, so the refusal is the scan check and nothing else.
  const crypto = require("node:crypto");
  const secret = () => crypto.randomBytes(32).toString("hex");
  const staging = {
    APP_ENV: "staging", NODE_ENV: "production", MONGO_URI: "mongodb://127.0.0.1:27017", MONGO_DB_NAME: "nabad_staging",
    CLIENT_ORIGIN: "https://nabad-staging.vercel.app", JWT_SECRET: secret(), TWO_FACTOR_CODE_SECRET: secret(),
    SMTP_HOST: "smtp.example.test", SMTP_PORT: "2525", SMTP_USER: "u", SMTP_PASS: "p", EMAIL_FROM: "Nabad <no-reply@example.test>",
  };
  assert.doesNotThrow(() => loadConfig(staging));
  assert.throws(() => loadConfig({ ...staging, ...RELAXED }), /SECURITY_SCAN_RELAXED_RATE_LIMITS is only for the local security scan; it is not allowed with APP_ENV=staging/);
  const production = { ...staging, APP_ENV: "production", MONGO_DB_NAME: "nabad_production", CLIENT_ORIGIN: "https://nabad-psi.vercel.app",
    GOOGLE_REDIRECT_URI: "https://nabad-psi.vercel.app/api/auth/google/callback" };
  assert.doesNotThrow(() => loadConfig(production));
  assert.throws(() => loadConfig({ ...production, ...RELAXED }), /not allowed with APP_ENV=production/);
});

test("the setting must be exactly true or false", () => {
  assert.throws(() => rateLimit.relaxedForScan({ SECURITY_SCAN_RELAXED_RATE_LIMITS: "yes" }), /must be "true" or "false"/);
});

test("every route creates its limiters through rateLimit.js, never express-rate-limit directly", () => {
  const routes = path.join(__dirname, "..", "src", "routes");
  for (const file of fs.readdirSync(routes)) {
    const text = fs.readFileSync(path.join(routes, file), "utf8");
    assert.doesNotMatch(text, /require\(["']express-rate-limit["']\)/, file);
  }
});

test("only the scan's compose file turns the setting on", () => {
  const root = path.join(__dirname, "..", "..");
  assert.match(fs.readFileSync(path.join(root, "security/zap/compose.zap.yml"), "utf8"), /SECURITY_SCAN_RELAXED_RATE_LIMITS: "true"/);
  for (const file of ["docker-compose.yml", ".env.docker.example", "render.yaml"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /SECURITY_SCAN_RELAXED_RATE_LIMITS/, file);
  }
});

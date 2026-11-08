// Staging (APP_ENV=staging): its own database and secrets, previews allowed by pattern, emails marked as tests.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { loadConfig } = require("../src/config");

const secret = () => crypto.randomBytes(32).toString("hex");
function stagingEnv(overrides = {}) {
  return {
    APP_ENV: "staging", NODE_ENV: "production", MONGO_URI: "mongodb://127.0.0.1:27017", MONGO_DB_NAME: "nabad_staging",
    CLIENT_ORIGIN: "https://nabad-staging.vercel.app", JWT_SECRET: secret(), TWO_FACTOR_CODE_SECRET: secret(),
    SMTP_HOST: "smtp.example.test", SMTP_PORT: "2525", SMTP_USER: "u", SMTP_PASS: "p", EMAIL_FROM: "Nabad <no-reply@example.test>",
    PREVIEW_ORIGIN_PATTERN: "https://nabad-*-nabad3.vercel.app", ...overrides,
  };
}
function productionEnv(overrides = {}) {
  return {
    APP_ENV: "production", NODE_ENV: "production", MONGO_URI: "mongodb://127.0.0.1:27017", MONGO_DB_NAME: "nabad_production",
    CLIENT_ORIGIN: "https://nabad-psi.vercel.app", JWT_SECRET: secret(), TWO_FACTOR_CODE_SECRET: secret(),
    SMTP_HOST: "smtp.example.test", SMTP_PORT: "2525", SMTP_USER: "u", SMTP_PASS: "p", EMAIL_FROM: "Nabad <no-reply@example.test>",
    GOOGLE_REDIRECT_URI: "https://nabad-psi.vercel.app/api/auth/google/callback", ...overrides,
  };
}

test("staging starts with its own secrets and without Google sign-in", () => {
  const config = loadConfig(stagingEnv());
  assert.equal(config.environment, "staging");
  assert.equal(config.secure, true);
  assert.equal(config.databaseName, "nabad_staging");
});

test("staging refuses the production database", () => {
  assert.throws(() => loadConfig(stagingEnv({ MONGO_DB_NAME: "nabad_production" })), /never use the production database/);
  assert.throws(() => loadConfig(stagingEnv({ MONGO_DB_NAME: " nabad_production " })), /never use the production database/);
  assert.throws(() => loadConfig(stagingEnv({ MONGO_DB_NAME: "nabad_development" })), /must end with the selected environment/);
});

test("staging names every missing secret, never a value", () => {
  for (const key of ["MONGO_URI", "JWT_SECRET", "TWO_FACTOR_CODE_SECRET", "MONGO_DB_NAME", "CLIENT_ORIGIN", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"]) {
    const env = stagingEnv(); delete env[key];
    assert.throws(() => loadConfig(env), new RegExp(`^Error: Missing required environment variables: ${key}$`), key);
  }
  const env = stagingEnv(); delete env.EMAIL_FROM; env.MAIL_FROM = "Nabad <no-reply@example.test>";
  assert.doesNotThrow(() => loadConfig(env), "the legacy MAIL_FROM name still counts");
});

test("staging uses different JWT and sign-in code keys", () => {
  const same = secret();
  assert.throws(() => loadConfig(stagingEnv({ JWT_SECRET: same, TWO_FACTOR_CODE_SECRET: same })), /must be different/);
});

test("Google sign-in on staging is off unless fully configured", () => {
  assert.throws(() => loadConfig(stagingEnv({ GOOGLE_CLIENT_ID: "id" })), /partly configured.*GOOGLE_CLIENT_SECRET/);
  assert.throws(() => loadConfig(stagingEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })), /GOOGLE_REDIRECT_URI/);
  assert.doesNotThrow(() => loadConfig(stagingEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", GOOGLE_REDIRECT_URI: "https://nabad-staging.vercel.app/api/auth/google/callback" })));
});

test("PREVIEW_ORIGIN_PATTERN is refused outside staging", () => {
  assert.throws(() => loadConfig(productionEnv({ PREVIEW_ORIGIN_PATTERN: "https://nabad-*-nabad3.vercel.app" })), /only allowed with APP_ENV=staging/);
  for (const APP_ENV of ["development", "test"]) {
    assert.throws(() => loadConfig({ APP_ENV, MONGO_URI: "mongodb://x", JWT_SECRET: secret(), PREVIEW_ORIGIN_PATTERN: "https://nabad-*-nabad3.vercel.app" }), /only allowed with APP_ENV=staging/);
  }
});

test("production accepts writes only from its exact origin", () => {
  const { isAllowedOrigin } = loadConfig(productionEnv());
  assert.equal(isAllowedOrigin("https://nabad-psi.vercel.app"), true);
  assert.equal(isAllowedOrigin("https://nabad-git-main-nabad3.vercel.app"), false);
  assert.equal(isAllowedOrigin("https://nabad-staging.vercel.app"), false);
});

test("the preview pattern is anchored, stays inside one DNS label and needs HTTPS", () => {
  const { isAllowedOrigin } = loadConfig(stagingEnv());
  for (const origin of ["https://nabad-staging.vercel.app", "https://nabad-git-feat-login-nabad3.vercel.app", "https://nabad-4f9k2x1ab-nabad3.vercel.app"]) {
    assert.equal(isAllowedOrigin(origin), true, origin);
  }
  for (const origin of [
    undefined, "", "null", "https://nabad-psi.vercel.app", "http://nabad-git-x-nabad3.vercel.app", "https://nabad--nabad3.vercel.app",
    "https://nabad-x.evil-nabad3.vercel.app", "https://nabad-x-nabad3.vercel.app.evil.test", "https://nabad-x-nabad3xvercel.app",
    "https://nabad-x-nabad3.vercel.app/", "https://nabad-x-nabad3.vercel.app:8443", "https://evil.test/https://nabad-x-nabad3.vercel.app",
  ]) {
    assert.equal(isAllowedOrigin(origin), false, String(origin));
  }
});

test("malformed preview patterns stop startup", () => {
  for (const pattern of ["https://*.vercel.app", "https://*-nabad3.vercel.app", "https://nabad-*", "https://nabad-*-*-nabad3.vercel.app",
    "http://nabad-*-nabad3.vercel.app", "https://nabad-*-nabad3.vercel.app/", "https://nabad.*-nabad3.vercel.app", ".*"]) {
    assert.throws(() => loadConfig(stagingEnv({ PREVIEW_ORIGIN_PATTERN: pattern })), /PREVIEW_ORIGIN_PATTERN must look like/, pattern);
  }
});

test("staging email subjects start with [Staging]; other environments are unchanged", async (t) => {
  const { subjectFor, mailer } = require("../src/email");
  assert.equal(subjectFor("Reset your Nabad password", { APP_ENV: "staging" }), "[Staging] Reset your Nabad password");
  assert.equal(subjectFor("[Staging] Already marked", { APP_ENV: "staging" }), "[Staging] Already marked");
  assert.equal(subjectFor("Reset your Nabad password", { APP_ENV: "production" }), "Reset your Nabad password");
  assert.equal(subjectFor("Reset your Nabad password", {}), "Reset your Nabad password");

  const sent = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => { sent.push(message); } }));
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  Object.assign(process.env, stagingEnv());
  await mailer().sendMail({ to: "a@example.test", subject: "Your Nabad verification code", text: "123456" });
  process.env.APP_ENV = "production";
  await mailer().sendMail({ to: "a@example.test", subject: "Your Nabad verification code", text: "123456" });
  assert.deepEqual(sent.map((message) => message.subject), ["[Staging] Your Nabad verification code", "Your Nabad verification code"]);
  assert.equal(sent[0].text, "123456");
});

test("staging accepts writes from its domain and previews, and refuses other origins", async (t) => {
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  Object.assign(process.env, stagingEnv());
  const server = require("../src/app").createApp().listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const post = (origin) => fetch(`http://127.0.0.1:${server.address().port}/api/no-such-route`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
  assert.notEqual((await post("https://nabad-staging.vercel.app")).status, 403);
  assert.notEqual((await post("https://nabad-git-feat-login-nabad3.vercel.app")).status, 403);
  assert.equal((await post("https://nabad-psi.vercel.app")).status, 403);
  assert.equal((await post("https://evil.example")).status, 403);
});

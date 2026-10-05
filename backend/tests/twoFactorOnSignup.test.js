const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../src/models/User");
const { loadConfig, twoFactorOnSignup } = require("../src/config");
let mongod, server, base, sent = [];
const password = "Signup 2FA password 123!";

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CLIENT_ORIGIN = "http://localhost:3000";
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) process.env[key] = "test";
  mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message) => { sent.push(message); } }));
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  const { createApp } = require("../src/app");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 240000 });
after(async () => {
  delete process.env.TWO_FACTOR_ON_SIGNUP;
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
beforeEach(async () => { await User.deleteMany({}); sent = []; delete process.env.TWO_FACTOR_ON_SIGNUP; });

async function post(route, body) {
  const response = await fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
}
// Signup also emails a verification link (story #2), so these tests count only the 2FA code emails.
const codeEmails = () => sent.filter(message => message.subject === "Your Nabad verification code");
// Signs up, then signs in again with the password. Returns the saved user and the second sign-in.
async function signUpThenLogIn(email) {
  const signup = await post("/auth/signup", { name: "New", email, password });
  assert.equal(signup.status, 201);
  assert.ok(signup.cookies.some(cookie => cookie.startsWith("accessToken=")));
  return { saved: await User.findOne({ email }), login: await post("/auth/login", { email, password }) };
}

test("unset: new accounts start without 2FA and sign in with just the password", async () => {
  const { saved, login } = await signUpThenLogIn("unset@example.test");
  assert.equal(saved.twoFactorEnabled, false);
  assert.equal(login.status, 200);
  assert.equal(login.body.twoFactorRequired, undefined);
  assert.equal(codeEmails().length, 0);
});

test("OFF: new accounts start without 2FA and sign in with just the password", async () => {
  process.env.TWO_FACTOR_ON_SIGNUP = "false";
  const { saved, login } = await signUpThenLogIn("off@example.test");
  assert.equal(saved.twoFactorEnabled, false);
  assert.equal(login.status, 200);
  assert.equal(login.body.twoFactorRequired, undefined);
  assert.equal(codeEmails().length, 0);
});

test("ON: new accounts start with 2FA and the next sign-in asks for an email code", async () => {
  process.env.TWO_FACTOR_ON_SIGNUP = "true";
  const { saved, login } = await signUpThenLogIn("on@example.test");
  assert.equal(saved.twoFactorEnabled, true);
  assert.equal(login.body.twoFactorRequired, true);
  assert.equal(login.cookies.length, 0);
  assert.equal(codeEmails().length, 1);
  assert.equal(codeEmails()[0].to, "on@example.test");
});

test("ON does not change accounts that already exist", async () => {
  const existing = await User.create({ name: "Old", email: "old@example.test", passwordHash: "x" });
  process.env.TWO_FACTOR_ON_SIGNUP = "true";
  await post("/auth/signup", { name: "New", email: "new@example.test", password });
  assert.equal((await User.findById(existing._id)).twoFactorEnabled, false);
});

test("the setting is on only for exactly \"true\"; a missing value never blocks startup", () => {
  const production = { APP_ENV: "production", MONGO_URI: "mongodb://localhost:27017", JWT_SECRET: "x".repeat(32), MONGO_DB_NAME: "nabad_production", CLIENT_ORIGIN: "https://nabad.example.test", SMTP_HOST: "h", SMTP_PORT: "2525", SMTP_USER: "u", SMTP_PASS: "p", EMAIL_FROM: "f", GOOGLE_REDIRECT_URI: "https://nabad.example.test/cb" };
  for (const value of [undefined, "", "false"]) {
    const env = value === undefined ? { ...production } : { ...production, TWO_FACTOR_ON_SIGNUP: value };
    assert.doesNotThrow(() => loadConfig(env), String(value));
    assert.equal(twoFactorOnSignup(env), false);
  }
  assert.doesNotThrow(() => loadConfig({ ...production, TWO_FACTOR_ON_SIGNUP: "true" }));
  assert.equal(twoFactorOnSignup({ TWO_FACTOR_ON_SIGNUP: "true" }), true);
  // A typo must not silently leave it on or off.
  for (const value of ["yes", "TRUE", "1", " true"]) assert.throws(() => loadConfig({ ...production, TWO_FACTOR_ON_SIGNUP: value }), /TWO_FACTOR_ON_SIGNUP must be "true" or "false"/);
});

test("render.yaml and the production example keep the setting off", () => {
  const root = path.join(__dirname, "..", "..");
  assert.match(fs.readFileSync(path.join(root, "render.yaml"), "utf8"), /- key: TWO_FACTOR_ON_SIGNUP\r?\n\s+value: "false"/);
  assert.match(fs.readFileSync(path.join(root, "backend", "config", "production.env.example"), "utf8"), /^TWO_FACTOR_ON_SIGNUP=false$/m);
});

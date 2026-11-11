// In production, GET /api/health/client-ip only says whether the request came through our proxy with the right
// secret, never an address, so the secrets can be checked before API_PROXY_REQUIRED is turned on.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const secret = () => crypto.randomBytes(32).toString("hex");
const PROXY_SECRET = secret();
const production = {
  APP_ENV: "production", NODE_ENV: "production", MONGO_URI: "mongodb://127.0.0.1:27017", MONGO_DB_NAME: "nabad_production",
  CLIENT_ORIGIN: "https://nabad-psi.vercel.app", JWT_SECRET: secret(), TWO_FACTOR_CODE_SECRET: secret(),
  SMTP_HOST: "smtp.example.test", SMTP_PORT: "2525", SMTP_USER: "u", SMTP_PASS: "p", EMAIL_FROM: "Nabad <no-reply@example.test>",
  GOOGLE_REDIRECT_URI: "https://nabad-psi.vercel.app/api/auth/google/callback", API_PROXY_SECRET: PROXY_SECRET,
};

async function withProductionApp(env, run) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  let server;
  try {
    const { createApp } = require("../src/app");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    return await run(`http://127.0.0.1:${server.address().port}/api/health/client-ip`);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    process.env = saved;
  }
}

test("production shows only viaAppProxy, never an address", async () => {
  await withProductionApp(production, async (url) => {
    const proxied = await fetch(url, { headers: { "X-Nabad-Proxy-Secret": PROXY_SECRET, "X-Nabad-Client-IP": "212.28.230.77" } });
    assert.deepEqual(await proxied.json(), { viaAppProxy: true });
    const wrong = await fetch(url, { headers: { "X-Nabad-Proxy-Secret": "a different secret", "X-Nabad-Client-IP": "212.28.230.77", "CF-Connecting-IP": "51.44.16.21" } });
    const body = await wrong.json();
    assert.deepEqual(body, { viaAppProxy: false });
    assert.ok(!JSON.stringify(body).includes("51.44") && !JSON.stringify(body).includes("212.28"));
  });
});

test("production with enforcement on: the check itself needs the secret too", async () => {
  await withProductionApp({ ...production, API_PROXY_REQUIRED: "true" }, async (url) => {
    assert.equal((await fetch(url)).status, 403);
    assert.deepEqual(await (await fetch(url, { headers: { "X-Nabad-Proxy-Secret": PROXY_SECRET, "X-Nabad-Client-IP": "212.28.230.77" } })).json(), { viaAppProxy: true });
  });
});

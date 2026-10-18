// Relaxes the backend's rate limits in the current Node process only, for local load tests.
// The backend allows e.g. 20 logins per 15 minutes per IP, and all virtual users share one IP,
// so a load test would only measure 429 responses. Before the backend loads, this swaps
// express-rate-limit in Node's module cache for a wrapper that keeps every limiter but raises
// its limit to 10^9. backend/src is not changed; `npm start`, Render and plain `docker compose up`
// always use the real limits.
// Used by start-backend.js (k6) and, via NODE_OPTIONS=--require, by the JMeter Docker override
// (jmeter/docker-compose.loadtest.yml). LOADTEST_BACKEND_DIR says where the backend's node_modules are.
const path = require("path");

if (process.env.RENDER || process.env.VERCEL) {
  throw new Error("relax-rate-limits.js is for local load tests only and refuses to run on Render or Vercel.");
}

const backend = process.env.LOADTEST_BACKEND_DIR || path.join(__dirname, "..", "backend");
const rateLimitPath = require.resolve("express-rate-limit", { paths: [backend] });
const realRateLimit = require(rateLimitPath);
const relaxed = (options = {}) => realRateLimit({ ...options, max: 1e9, limit: 1e9 });
Object.assign(relaxed, realRateLimit, { default: relaxed, rateLimit: relaxed });
require.cache[rateLimitPath].exports = relaxed;

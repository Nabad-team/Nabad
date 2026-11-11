// Every rate limiter in the API is created through here instead of express-rate-limit directly, so the PR security
// scan can loosen all of them at once: SECURITY_SCAN_RELAXED_RATE_LIMITS=true multiplies each limit by 1000.
// It is set only in security/zap/compose.zap.yml, so ZAP's active scan tests the endpoints instead of mostly getting
// 429s (docs/security-scanning.md). config.js refuses to start with it on staging or production, and this module
// refuses too, in case a limiter is ever created before the config check runs.
const expressRateLimit = require("express-rate-limit");

const SCAN_SETTING = "SECURITY_SCAN_RELAXED_RATE_LIMITS";
const SCAN_FACTOR = 1000;
const HOSTED = ["staging", "production"];

function relaxedForScan(env = process.env) {
  if (![undefined, "", "true", "false"].includes(env[SCAN_SETTING])) throw new Error(`${SCAN_SETTING} must be "true" or "false".`);
  if (env[SCAN_SETTING] !== "true") return false;
  const environment = env.APP_ENV || env.NODE_ENV || "development";
  if (HOSTED.includes(environment)) throw new Error(`${SCAN_SETTING} is only for the local security scan; it is not allowed with APP_ENV=${environment}.`);
  return true;
}

function scaledMax(options) {
  if (typeof options.max === "function") return async (...args) => (await options.max(...args)) * SCAN_FACTOR;
  return (options.max ?? 5) * SCAN_FACTOR; // 5 is express-rate-limit's default.
}

function rateLimit(options = {}, env = process.env) {
  return expressRateLimit(relaxedForScan(env) ? { ...options, max: scaledMax(options) } : options);
}

module.exports = rateLimit;
module.exports.relaxedForScan = relaxedForScan;
module.exports.SCAN_FACTOR = SCAN_FACTOR;

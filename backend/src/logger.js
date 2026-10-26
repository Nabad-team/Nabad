const crypto = require("crypto");
const { captureServerError } = require("./errorTracking");
// Greedy up to the last "@" so unescaped "@" or "/" in a password is still covered.
const redactCredentials = (text) => String(text).replace(/\/\/\S*@/g, "//***@");
// Allowlisted fields only: exclude credentials, contact details, query strings and DB messages.
// errorMessage is for startup failures only and always has connection-string credentials redacted.
function logEvent(event, fields = {}) {
  const entry = { time: new Date().toISOString(), event };
  for (const key of ["requestId", "method", "route", "status", "durationMs", "errorType", "errorCode", "environment", "missingVariables", "reason", "userId", "origin", "errorFields", "bytes", "ruleGap", "healthProfile", "healthRaised", "followUp"]) {
    if (fields[key] !== undefined) entry[key] = fields[key];
  }
  if (fields.errorMessage !== undefined) entry.errorMessage = redactCredentials(fields.errorMessage);
  process.stdout.write(JSON.stringify(entry) + "\n");
}
// What is safe to log about an error: never its message, which can echo the value that failed (health data in a
// validation or cast error) or a server response. Only JWT's own fixed messages ("jwt malformed", "invalid
// signature") are kept as the reason; for Mongoose errors, the field names and the kind of problem.
const WORDS_ONLY = /^[a-z][a-z ]{0,60}$/i;
const JWT_ERRORS = ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"];
function errorDetails(error) {
  const details = { errorType: error?.name || "Error" };
  if (error?.code !== undefined && /^[\w.-]{1,40}$/.test(String(error.code))) details.errorCode = error.code;
  if (error?.name === "ValidationError" && error.errors) {
    details.errorFields = Object.keys(error.errors).slice(0, 20).join(",");
    details.reason = [...new Set(Object.values(error.errors).map((item) => item.kind || item.name))].join(",").slice(0, 100);
  } else if (error?.name === "CastError") {
    details.errorFields = String(error.path || "");
    details.reason = `cast_to_${String(error.kind || "value").toLowerCase()}`.replace(/[^a-z_]/g, "");
  } else if (error?.codeName && WORDS_ONLY.test(error.codeName)) {
    details.reason = error.codeName;
  } else if (JWT_ERRORS.includes(error?.name) && typeof error.message === "string" && WORDS_ONLY.test(error.message)) {
    details.reason = error.message;
  }
  return details;
}
function logError(req, error) {
  logEvent("request_error", { requestId: req?.requestId, ...errorDetails(error) });
}
function requestLogger(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  const started = performance.now();
  res.on("finish", () => logEvent("http_request", {
    requestId: req.requestId, method: req.method,
    route: typeof req.route?.path === "string" ? req.route.path : "unmatched", origin: req.get("Origin") || null,
    status: res.statusCode, durationMs: Math.round(performance.now() - started),
  }));
  next();
}
const INVALID_DETAILS = "Some of the details aren't valid. Please check them and try again.";
// The route pattern (/api/profile/linked/:id), never the URL with its ids and query string. Express has reset
// req.baseUrl by the time an error reaches this handler, so the router's mount path is taken from the start of the
// URL: every mount path is a fixed string, and every route pattern has one segment per URL segment (no wildcards or
// optional parameters), so the URL's last segments are exactly the ones the pattern replaces.
function routePattern(req) {
  if (typeof req.route?.path !== "string") return "unmatched";
  const segments = String(req.originalUrl || "").split("?")[0].split("/").filter(Boolean);
  const routeSegments = req.route.path.split("/").filter(Boolean);
  return `/${[...segments.slice(0, Math.max(0, segments.length - routeSegments.length)), ...routeSegments].join("/")}`;
}
// Every 5xx goes to error tracking (errorTracking.js: only when SENTRY_DSN is set, and scrubbed), with the requestId
// so the report can be matched to these logs.
const reportServerError = (req, error, status) => captureServerError(error, { requestId: req.requestId, route: routePattern(req), status });
function errorHandler(error, req, res, next) {
  logError(req, error);
  if (res.headersSent) {
    reportServerError(req, error, res.statusCode >= 500 ? res.statusCode : 500);
    return next(error);
  }
  // A Mongoose validation or cast error that got this far comes from a value in the request: answer 400 in plain
  // words, never with Mongoose's own message (it repeats the value).
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ error: INVALID_DETAILS, requestId: req.requestId });
  }
  const status = error.type === "entity.too.large" ? 413 : error.type === "entity.parse.failed" ? 400 : 500;
  if (status >= 500) reportServerError(req, error, status);
  res.status(status).json({ error: status === 500 ? "An internal error occurred." : "Invalid request body.", requestId: req.requestId });
}
module.exports = { logEvent, logError, errorDetails, requestLogger, errorHandler, INVALID_DETAILS };

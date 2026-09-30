const crypto = require("crypto");
// Greedy up to the last "@" so unescaped "@" or "/" in a password is still covered.
const redactCredentials = (text) => String(text).replace(/\/\/\S*@/g, "//***@");
// Allowlisted fields only: exclude credentials, contact details, query strings and DB messages.
// errorMessage is for startup failures only and always has connection-string credentials redacted.
function logEvent(event, fields = {}) {
  const entry = { time: new Date().toISOString(), event };
  for (const key of ["requestId", "method", "route", "status", "durationMs", "errorType", "errorCode", "environment"]) {
    if (fields[key] !== undefined) entry[key] = fields[key];
  }
  if (fields.errorMessage !== undefined) entry.errorMessage = redactCredentials(fields.errorMessage);
  process.stdout.write(JSON.stringify(entry) + "\n");
}
function logError(req, error) {
  logEvent("request_error", { requestId: req?.requestId, errorType: error?.name || "Error" });
}
function requestLogger(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  const started = performance.now();
  res.on("finish", () => logEvent("http_request", {
    requestId: req.requestId, method: req.method,
    route: typeof req.route?.path === "string" ? req.route.path : "unmatched",
    status: res.statusCode, durationMs: Math.round(performance.now() - started),
  }));
  next();
}
function errorHandler(error, req, res, next) {
  logError(req, error);
  if (res.headersSent) return next(error);
  const status = error.type === "entity.too.large" ? 413 : error.type === "entity.parse.failed" ? 400 : 500;
  res.status(status).json({ error: status === 500 ? "An internal error occurred." : "Invalid request body.", requestId: req.requestId });
}
module.exports = { logEvent, logError, requestLogger, errorHandler };

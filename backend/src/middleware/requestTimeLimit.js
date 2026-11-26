// A time limit for every API request (timeLimits.js), so no request can wait for minutes on a stuck database,
// network or AI provider. Past the limit the client gets 503 with a fixed message and code, and nothing from the
// request (no symptoms, no body, no user details), the same for every route.
//
// The handler keeps running until its own work finishes or fails. Once the 503 has gone out, everything it
// tries to send is dropped: headers, cookies and body. Without that, a late res.json would throw "headers
// already sent", and a late write could emit an error on the response.
const { requestLimitFor } = require("../timeLimits");
const { logEvent } = require("../logger");

const TIMEOUT_BODY = Object.freeze({
  error: "Nabad is taking too long to answer. Please try again in a moment. In an emergency in Lebanon, call 140.",
  code: "request_timeout",
});

function requestTimeLimit(req, res, next) {
  const limitMs = requestLimitFor(req.path);
  // The first path segment under /api (e.g. "triage"), read now: Express rewrites req.path as routing goes on.
  // Never ids, query strings or anything sent.
  const route = req.path.split("/")[1] || "";
  let timedOut = false;
  const timer = setTimeout(() => {
    if (res.headersSent || res.writableEnded) return;
    res.status(503).set("Retry-After", "5").json({ ...TIMEOUT_BODY, requestId: req.requestId });
    timedOut = true;
    req.timedOut = true;
    logEvent("request_timeout", { requestId: req.requestId, route, durationMs: limitMs });
  }, limitMs);
  timer.unref?.();
  const clear = () => clearTimeout(timer);
  res.once("finish", clear);
  res.once("close", clear);

  for (const method of ["setHeader", "writeHead", "write", "end"]) {
    const original = res[method];
    res[method] = function guarded(...args) {
      if (!timedOut) return original.apply(this, args);
      // A callback passed to end/write still runs, so nothing waits on it forever.
      const callback = args.find((arg) => typeof arg === "function");
      if (callback) process.nextTick(callback);
      return method === "write" ? false : this;
    };
  }
  next();
}

module.exports = { requestTimeLimit, TIMEOUT_BODY };

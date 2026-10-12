const { logError } = require("./logger");

// An error whose message was written for the user, in plain words, with the HTTP status to answer with.
// Anything else that reaches a response (a library, database or crypto error) must never show its own message:
// sendError answers it with a generic one and logs what is safe to log (logger.js, errorDetails).
class UserError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.name = "UserError";
    this.status = status;
    if (extra.retryAfter !== undefined) this.retryAfter = extra.retryAfter;
  }
}
const GENERIC_ERROR = "Something went wrong. Please try again.";

// Answers a caught error: a UserError with its own message (logged only when it is the server's fault, 5xx),
// anything else with GENERIC_ERROR and a 500, logged with safe details only.
function sendError(req, res, error) {
  if (error instanceof UserError) {
    if (error.status >= 500) logError(req, error);
    return res.status(error.status).json({ error: error.message, ...(error.retryAfter !== undefined ? { retryAfter: error.retryAfter } : {}) });
  }
  logError(req, error);
  return res.status(500).json({ error: GENERIC_ERROR, requestId: req.requestId });
}

module.exports = { UserError, sendError, GENERIC_ERROR };

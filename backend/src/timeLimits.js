// Time limits that keep a request from waiting for minutes on a stuck database, network or AI provider.
// One place for all of them, read at call time (tests shorten them). See docs/ai-fallback.md#time-limits.
//
// How they fit together, for the symptom check (the strictest path):
//   AI models          LLM_TRIAGE_DEADLINE_MS (12000 recommended), or DEFAULT_TRIAGE_DEADLINE_MS when unset
//   database reads     DB_READ_MS each (server side, maxTimeMS) and OPTIONAL_READ_MS for the reads triage can do
//                      without (previous checks, health summary): past that, the check goes on without them
//   whole request      REQUEST_MS, after which the API answers 503 "request_timeout"
// so the rules or the AI always answer well before the request limit, and the request limit fires before the
// frontend's own (lib/api.js: 30 s, or 120 s for the slow routes) gives up with a vaguer "took too long".
const timeLimits = {
  // The models' share of one symptom check when LLM_TRIAGE_DEADLINE_MS is not set. Below REQUEST_MS so the rules
  // answer (ai.reason "timeout") before the request limit; production should still set 12000.
  DEFAULT_TRIAGE_DEADLINE_MS: 20000,
  // Server-side limit on one database read (maxTimeMS): MongoDB stops the work and the read fails.
  DB_READ_MS: 5000,
  // The longest the symptom check waits for the reads it can do without, network included.
  OPTIONAL_READ_MS: 5000,
  // MongoDB driver: give up finding a server, or on a socket that has gone quiet, instead of waiting forever.
  // The socket limit is above every maxTimeMS so a slow query fails with its own clear error first.
  DB_SERVER_SELECTION_MS: 5000,
  DB_SOCKET_MS: 20000,
  // Whole API request. Most routes: below the frontend's 30 s. The symptom check: 12 s of AI (20 s by default)
  // plus database reads and margin. Slow routes (file uploads, report review, visit prep, AI history questions,
  // prescription reading): several AI calls and large bodies, so below the frontend's 120 s for them.
  REQUEST_MS: 25000,
  TRIAGE_REQUEST_MS: 30000,
  SLOW_REQUEST_MS: 110000,
};

// The same routes as the frontend's slowRequest (frontend/lib/api.js), which waits 120 s for them, plus the
// upload routes. Matched against the path under /api.
const SLOW_ROUTE = /^\/(?:reports(?:\/|$)|medical-documents(?:\/|$)|visit-prep(?:\/|$)|prescriptions(?:\/|$)|history\/ask|profile-coverage(?:\/|$))/;
const TRIAGE_ROUTE = /^\/triage\/ai-assess(?:\/|$)/;

function requestLimitFor(apiPath) {
  if (TRIAGE_ROUTE.test(apiPath)) return timeLimits.TRIAGE_REQUEST_MS;
  if (SLOW_ROUTE.test(apiPath)) return timeLimits.SLOW_REQUEST_MS;
  return timeLimits.REQUEST_MS;
}

class TimeLimitError extends Error {
  constructor(what) { super(`${what} took too long`); this.name = "TimeLimitError"; this.code = "time_limit"; }
}

// Resolves like promise, or rejects with TimeLimitError after ms. The promise itself is not cancelled
// (maxTimeMS stops the database side); a late result or error is ignored.
function withinTime(promise, ms, what) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new TimeLimitError(what)), ms); timer.unref?.(); }),
  ]);
}

module.exports = { timeLimits, requestLimitFor, withinTime, TimeLimitError };

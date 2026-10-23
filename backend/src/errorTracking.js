// Error tracking with Sentry (story #89). On only when SENTRY_DSN is set, so local runs, tests and Docker never send
// anything. Health and personal data must never leave the server in an error report, so:
// - Only the integrations that catch errors are used. The defaults would add request data, console and HTTP
//   breadcrumbs (URLs), local variable values, source lines and machine details.
// - scrubEvent builds a new event from an allowlist rather than deleting what's known to be sensitive: the error
//   type and stack frames (file, function, line), and the tags requestId, route and status, plus the environment.
//   Everything else is dropped: the error message (it can repeat a value, like a validation error), request body,
//   cookies, headers, URL and query string, user, IP address, extra data, contexts and breadcrumbs.
// - sendDefaultPii is false, every kind of data collection is off (COLLECT_NOTHING), and there is no tracing
//   (no tracesSampleRate), no session tracking and no breadcrumbs.
// requestId matches the X-Request-ID header and the "requestId" in our logs (logger.js).
const TAGS = ["requestId", "route", "status"];
const FRAME_FIELDS = ["filename", "function", "module", "lineno", "colno", "in_app"];

// Sentry v11 collects user info (and lets Sentry record the visitor's IP address), cookies, headers, bodies, query
// strings, local variable values and source lines unless told not to, whatever sendDefaultPii says (no longer
// read). So every category is turned off here, and scrubEvent removes anything that is still attached.
const COLLECT_NOTHING = Object.freeze({
  userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
  graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
  databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0,
});

// The SDK is loaded only when error tracking is turned on. logger.js (and so every module that logs, including
// passwordPolicy.js, which the frontend's tests import) must not need it.
let Sentry = null;

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]));

function scrubEvent(event) {
  const values = (event.exception?.values || []).map((value) => ({
    type: typeof value.type === "string" ? value.type : "Error",
    ...(value.mechanism ? { mechanism: pick(value.mechanism, ["type", "handled"]) } : {}),
    ...(value.stacktrace?.frames ? { stacktrace: { frames: value.stacktrace.frames.map((frame) => pick(frame, FRAME_FIELDS)) } } : {}),
  }));
  const tags = Object.fromEntries(Object.entries(pick(event.tags, TAGS)).map(([key, value]) => [key, String(value)]));
  return {
    ...pick(event, ["event_id", "timestamp", "platform", "level", "environment"]),
    ...(values.length ? { exception: { values } } : {}),
    tags,
    ...(event.sdk ? { sdk: pick(event.sdk, ["name", "version"]) } : {}),
  };
}

function initErrorTracking(env = process.env, options = {}) {
  if (!env.SENTRY_DSN) return false;
  Sentry = require("@sentry/node");
  Sentry.initWithoutDefaultIntegrations({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV || env.NODE_ENV || "development",
    integrations: [
      Sentry.eventFiltersIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      // Like Node without Sentry: an unhandled rejection still ends the process (after it is reported).
      Sentry.onUnhandledRejectionIntegration({ mode: "strict" }),
    ],
    sendDefaultPii: false,
    dataCollection: COLLECT_NOTHING,
    includeLocalVariables: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: scrubEvent,
    sendClientReports: false,
    // No tracing: no tracesSampleRate, and no span streaming either (v11 adds it by default).
    traceLifecycle: "static",
    ...options,
  });
  return true;
}

// A 5xx answered by the central error handler (logger.js). route is the route pattern (/api/profile/linked/:id),
// never the URL with its ids and query string.
function captureServerError(error, { requestId, route, status }) {
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setTags(pick({ requestId, route, status: status === undefined ? undefined : String(status) }, TAGS));
    Sentry.captureException(error);
  });
}

// For a fatal startup error: report it and wait (briefly) for it to be sent before the process exits.
async function captureFatalError(error) {
  if (!Sentry) return;
  Sentry.captureException(error);
  await Sentry.flush(2000);
}

module.exports = { initErrorTracking, captureServerError, captureFatalError, scrubEvent, COLLECT_NOTHING };

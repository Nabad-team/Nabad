// Error tracking with Sentry (story #89), shared by the browser (instrumentation-client.js) and the Next.js server
// (instrumentation.js). On only when NEXT_PUBLIC_SENTRY_DSN is set, so local runs, tests and Docker send nothing.
// Health and personal data must never be sent, so, as in the backend (backend/src/errorTracking.js):
// - Only the integrations that catch errors are used (no default integrations): no breadcrumbs of clicks, inputs,
//   console or URLs, no request data, no tracing, no session replay or any other recording of the screen or inputs.
// - scrubEvent builds a new event from an allowlist: the error type and stack frames (file without its query
//   string, function, line), the tags requestId, route and status, and the environment. Everything else is dropped:
//   the error message, the page URL and query string, cookies, headers, request body, user, IP address, extra data,
//   contexts and breadcrumbs.
// - sendDefaultPii is false, and every kind of data collection is off (COLLECT_NOTHING).

export const SENTRY_DSN = (process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();

// Sentry v11 collects user info (and lets Sentry record the visitor's IP address), cookies, headers, bodies, query
// strings, local variable values and source lines unless told not to, whatever sendDefaultPii says (no longer
// read). So every category is turned off here, and scrubEvent removes anything that is still attached.
export const COLLECT_NOTHING = Object.freeze({
  userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
  graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
  databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0,
});

const TAGS = ["requestId", "route", "status"];
const FRAME_FIELDS = ["filename", "abs_path", "function", "module", "lineno", "colno", "in_app"];
// Fields that can be a URL: in the browser, an inline script's file is the page's own URL, query string included
// (a care circle invitation link carries its token there).
const URL_FIELDS = ["filename", "abs_path", "module"];

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]));
const withoutQuery = (value) => (typeof value === "string" ? value.split(/[?#]/)[0] : value);

function scrubFrame(frame) {
  const kept = pick(frame, FRAME_FIELDS);
  for (const field of URL_FIELDS) if (field in kept) kept[field] = withoutQuery(kept[field]);
  return kept;
}

export function scrubEvent(event) {
  const values = (event.exception?.values || []).map((value) => ({
    type: typeof value.type === "string" ? value.type : "Error",
    ...(value.mechanism ? { mechanism: pick(value.mechanism, ["type", "handled"]) } : {}),
    ...(value.stacktrace?.frames ? { stacktrace: { frames: value.stacktrace.frames.map(scrubFrame) } } : {}),
  }));
  const tags = Object.fromEntries(Object.entries(pick(event.tags, TAGS)).map(([key, value]) => [key, withoutQuery(String(value))]));
  return {
    ...pick(event, ["event_id", "timestamp", "platform", "level", "environment"]),
    ...(values.length ? { exception: { values } } : {}),
    tags,
    ...(event.sdk ? { sdk: pick(event.sdk, ["name", "version"]) } : {}),
  };
}

export const sentryEnvironment = () => process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV;

const commonOptions = (beforeSend) => ({
  dsn: SENTRY_DSN,
  environment: sentryEnvironment(),
  defaultIntegrations: false,
  sendDefaultPii: false,
  dataCollection: COLLECT_NOTHING,
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend,
  sendClientReports: false,
});

// The page's route pattern ("/care-circle/accept", "/profile"), never its URL or query string.
function currentRoute() {
  const pathname = typeof window !== "undefined" ? window.next?.router?.pathname : undefined;
  return typeof pathname === "string" ? pathname : undefined;
}

export function browserOptions(Sentry) {
  return {
    ...commonOptions((event) => scrubEvent({ ...event, tags: { route: currentRoute(), ...event.tags } })),
    // Unhandled errors and promise rejections on the page.
    integrations: [Sentry.globalHandlersIntegration(), Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
  };
}

export function serverOptions(Sentry) {
  return {
    ...commonOptions(scrubEvent),
    // Request errors come through onRequestError (instrumentation.js). The process's own handlers are left to Next.js.
    integrations: [Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
  };
}

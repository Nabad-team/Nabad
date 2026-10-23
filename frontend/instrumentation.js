// Runs once when the Next.js server starts. Error tracking only when NEXT_PUBLIC_SENTRY_DSN is set.
// See lib/sentry.js for what is (never) sent.
import { SENTRY_DSN, serverOptions } from "./lib/sentry";

export async function register() {
  if (SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(serverOptions(Sentry));
  }
}

// A page that failed on the server (the visitor sees the 500 page). context.routePath is the route pattern
// ("/care-circle/accept"), never the URL with its query string.
export async function onRequestError(error, request, context) {
  if (!SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.withScope((scope) => {
    scope.setTags({ route: context?.routePath, status: "500" });
    Sentry.captureRequestError(error, request, context);
  });
}

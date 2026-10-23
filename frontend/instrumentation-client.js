// Runs in the browser before the app starts (Next.js). Error tracking only when NEXT_PUBLIC_SENTRY_DSN is set; the
// SDK is loaded only then, so pages without it don't download it. See lib/sentry.js for what is (never) sent.
import { SENTRY_DSN, browserOptions } from "./lib/sentry";

if (SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => Sentry.init(browserOptions(Sentry)));
}

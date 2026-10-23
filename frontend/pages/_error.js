import ServerErrorPage from "./500";
import { SENTRY_DSN } from "../lib/sentry";

// Next.js shows this page for errors that 404.js and 500.js don't cover, such as a page that crashes in the browser.
// It looks like the 500 page, and reports the error when error tracking is on (lib/sentry.js: scrubbed, never any
// health or personal data).
export default function ErrorPage() {
  return <ServerErrorPage />;
}

ErrorPage.getInitialProps = async (context) => {
  const statusCode = context.res?.statusCode || context.err?.statusCode || 500;
  if (SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    await Sentry.withScope(async (scope) => {
      scope.setTags({ route: context.pathname, status: String(statusCode) });
      await Sentry.captureUnderscoreErrorException(context);
    });
  }
  return { statusCode };
};

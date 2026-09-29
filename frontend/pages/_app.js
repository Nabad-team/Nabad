import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import SessionTimeout from "../components/SessionTimeout";
import RequireSignIn from "../components/RequireSignIn";

// Next.js wraps every page with this component. We use it to share the
// active profile (self or a dependent) with all pages, and to run the inactivity sign-out timer on every page.
// Pages marked with `requireSignIn = true` are only shown to signed-in users.
export default function MyApp({ Component, pageProps }) {
  return (
    <ActiveProfileProvider>
      <SessionTimeout>
        {Component.requireSignIn ? (
          <RequireSignIn>
            <Component {...pageProps} />
          </RequireSignIn>
        ) : (
          <Component {...pageProps} />
        )}
      </SessionTimeout>
    </ActiveProfileProvider>
  );
}

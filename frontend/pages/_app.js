import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import SessionTimeout from "../components/SessionTimeout";
import RequireSignIn from "../components/RequireSignIn";

// Next.js wraps every page with this component. We use it to run the inactivity sign-out timer on every page,
// and to share the active profile (self or a dependent) with all pages. The profile provider sits inside
// SessionTimeout because it loads the profiles once the user is signed in.
// Pages marked with `requireSignIn = true` are only shown to signed-in users.
export default function MyApp({ Component, pageProps }) {
  return (
    <SessionTimeout>
      <ActiveProfileProvider>
        {Component.requireSignIn ? (
          <RequireSignIn>
            <Component {...pageProps} />
          </RequireSignIn>
        ) : (
          <Component {...pageProps} />
        )}
      </ActiveProfileProvider>
    </SessionTimeout>
  );
}

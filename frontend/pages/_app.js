import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import SessionTimeout from "../components/SessionTimeout";

// Next.js wraps every page with this component. We use it to share the
// active profile (self or a dependent) with all pages, and to run the inactivity sign-out timer on every page.
export default function MyApp({ Component, pageProps }) {
  return (
    <ActiveProfileProvider>
      <Component {...pageProps} />
      <SessionTimeout />
    </ActiveProfileProvider>
  );
}

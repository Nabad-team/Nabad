import { IBM_Plex_Sans } from "next/font/google";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import SessionTimeout from "../components/SessionTimeout";
import RequireSignIn from "../components/RequireSignIn";
import { AccessibilityProvider } from "../context/AccessibilityContext";
import "../styles/tokens.css";
import "../styles/base.css";
import "leaflet/dist/leaflet.css";
import "../styles/components.css";

// IBM Plex Sans, served from our own site by next/font (no request goes to Google from the browser).
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: "variable", display: "swap" });

// Next.js wraps every page with this component. We use it to run the inactivity sign-out timer on every page,
// and to share the active profile (self or a dependent) with all pages. The profile provider sits inside
// SessionTimeout because it loads the profiles once the user is signed in.
// Pages marked with `requireSignIn = true` are only shown to signed-in users.
export default function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Gives the font to the whole page (body, dialogs, everything), through --font-sans in styles/tokens.css. */}
      <style jsx global>{`
        :root {
          --font-plex: ${plex.style.fontFamily};
        }
      `}</style>
      <AccessibilityProvider>
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
      </AccessibilityProvider>
    </>
  );
}

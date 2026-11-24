import Head from "next/head";
import OfflineSupport from "../components/OfflineSupport";
import StagingBanner from "../components/StagingBanner";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import SessionTimeout from "../components/SessionTimeout";
import RequireSignIn from "../components/RequireSignIn";
import { AccessibilityProvider } from "../context/AccessibilityContext";
import "../styles/tokens.css";
import "../styles/base.css";
import "leaflet/dist/leaflet.css";
import "../styles/components.css";

// Atkinson Hyperlegible Next (body and headings) and Atkinson Hyperlegible Mono (doses, times, litres, counts: the
// .num class). Designed by the Braille Institute for readers with low vision; look-alike characters such as I l 1
// and 0 O stay distinct. Served from our own site by next/font (no request goes to Google from the browser).
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["400", "700", "800"], display: "swap" });
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], weight: ["400", "600"], display: "swap" });

// Next.js wraps every page with this component. We use it to run the inactivity sign-out timer on every page,
// and to share the active profile (self or a dependent) with all pages. The profile provider sits inside
// SessionTimeout because it loads the profiles once the user is signed in.
// Pages marked with `requireSignIn = true` are only shown to signed-in users.
export default function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Gives the fonts to the whole page (body, dialogs, everything), through --font-sans and --font-mono in
          styles/tokens.css. */}
      <style jsx global>{`
        :root {
          --font-atkinson: ${atkinson.style.fontFamily};
          --font-atkinson-mono: ${atkinsonMono.style.fontFamily};
        }
      `}</style>
      {/* viewport-fit=cover lets env(safe-area-inset-*) report the iPhone notch and home indicator; the page gutters,
          header, footer and phone tab bar pad by those insets (styles/components.css) so nothing hides under them. */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" key="viewport" />
      </Head>
      <StagingBanner />
      <OfflineSupport />
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

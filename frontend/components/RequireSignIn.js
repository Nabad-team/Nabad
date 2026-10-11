import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSessionStatus } from "./SessionTimeout";
import { signInRequiredUrl } from "../lib/session";

// Wraps pages that need sign-in (see _app.js). Nothing of the page is shown until the server
// confirms the user is signed in, so private health data never flashes on screen.
// A signed-out visitor is sent to /login?next=<this page> and comes back here after logging in.
export default function RequireSignIn({ children }) {
  const status = useSessionStatus();
  const router = useRouter();

  useEffect(() => {
    // "ended" (just signed out in this tab) is left alone: signOut() is already going to /login.
    if (status === "signedOut") router.replace(signInRequiredUrl(router.asPath));
  }, [status]);

  return status === "signedIn" ? children : null;
}

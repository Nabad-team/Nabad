import { useEffect } from "react";
import { useRouter } from "next/router";
import { useRetrySessionCheck, useSessionStatus } from "./SessionTimeout";
import { signInRequiredUrl } from "../lib/session";
import PageLayout from "./ui/PageLayout";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import { CardsSkeleton } from "./ui/Skeleton";

// Wraps pages that need sign-in (see _app.js). Nothing of the page is shown until the server
// confirms the user is signed in, so private health data never flashes on screen.
//   - While the server is asked (and asked again after a failed try), the loading placeholder shows, so a signed-in
//     user sees the page's shape instead of a blank page or the login page.
//   - Only a server that says "not signed in" (401) sends the visitor to /login?next=<this page>; they come back
//     here after logging in.
//   - If the server can't be reached even after a few tries, the page says so and offers "Try again".
export default function RequireSignIn({ children }) {
  const status = useSessionStatus();
  const retry = useRetrySessionCheck();
  const router = useRouter();

  useEffect(() => {
    // "ended" (just signed out in this tab) is left alone: signOut() is already going to /login.
    if (status === "signedOut") router.replace(signInRequiredUrl(router.asPath));
  }, [status]);

  if (status === "signedIn") return children;
  if (status === "unavailable") {
    return (
      <PageLayout title="Can't reach Nabad">
        <div className="stack">
          <Alert tone="danger" as="p" role="alert">
            We couldn't check that you're signed in. Please check your connection and try again. In an emergency in Lebanon, call 140.
          </Alert>
          <div><Button variant="secondary" onClick={retry}>Try again</Button></div>
        </div>
      </PageLayout>
    );
  }
  if (status === "checking") {
    return (
      <PageLayout title="Loading">
        <CardsSkeleton label="Loading..." count={2} title />
      </PageLayout>
    );
  }
  return null;
}

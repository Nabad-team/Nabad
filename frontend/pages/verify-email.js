import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { verifyEmail } from "../lib/api";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";

// Opened from the link in the verification email: /verify-email?token=...
// Public page (no sign-in needed), because people often open the email on a different device.
export default function VerifyEmailPage() {
  const router = useRouter();
  const [state, setState] = useState("checking"); // "checking" | "verified" | "failed"
  const [error, setError] = useState("");
  // A token works only once. React may run effects twice in development, so this
  // ref makes sure the token is sent a single time (a second send would report "invalid").
  const sentRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || sentRef.current) return;
    sentRef.current = true;
    const token = typeof router.query.token === "string" ? router.query.token : "";
    if (!token) { setError("This verification link is incomplete. Open the link from your email again."); setState("failed"); return; }
    verifyEmail(token)
      .then(() => setState("verified"))
      .catch((failure) => { setError(failure.message || "This verification link is invalid or has expired."); setState("failed"); });
  }, [router.isReady, router.query.token]);

  return (
    <PageLayout title="Verify your email" variant="auth">
      <PageTitle>Verify your email</PageTitle>
      {state === "checking" && <HeartbeatLoader label="Checking your link..." />}
      {state === "verified" && (
        <Alert tone="success" as="p" role="status" className="prose">Your email is verified. Thank you! <a href="/dashboard">Go to your dashboard</a></Alert>
      )}
      {state === "failed" && (
        <div className="stack prose">
          <Alert tone="danger" as="p" role="alert">{error}</Alert>
          <p>You can request a new link from your <a href="/dashboard">dashboard</a> after signing in.</p>
        </div>
      )}
    </PageLayout>
  );
}

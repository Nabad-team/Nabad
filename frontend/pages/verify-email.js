import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { verifyEmail } from "../lib/api";

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
    <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h1>Verify your email</h1>
      {state === "checking" && <p role="status">Checking your link...</p>}
      {state === "verified" && (
        <p role="status">Your email is verified. Thank you! <a href="/dashboard">Go to your dashboard</a></p>
      )}
      {state === "failed" && (
        <>
          <p role="alert" style={{ color: "crimson" }}>{error}</p>
          <p>You can request a new link from your <a href="/dashboard">dashboard</a> after signing in.</p>
        </>
      )}
    </main>
  );
}

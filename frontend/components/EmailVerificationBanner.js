import { useEffect, useState } from "react";
import { getMe, resendVerificationEmail } from "../lib/api";
import Alert from "./ui/Alert";
import Button from "./ui/Button";

// Reminds a signed-in user whose email is not verified yet, with a button to resend the link.
// Shows nothing while loading, when the email is verified, or if the check fails,
// so it can never block or break the page it sits on.
export default function EmailVerificationBanner() {
  const [user, setUser] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getMe().then((data) => { if (active) setUser(data.user); }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!user || user.emailVerified !== false) return null;

  async function resend() {
    setSending(true); setMessage(""); setError("");
    try { setMessage((await resendVerificationEmail()).message); }
    catch (failure) {
      setError(failure.status === 429 ? "A link was sent recently. Please wait a minute before asking again." : failure.message || "Could not send the email.");
    } finally { setSending(false); }
  }

  return (
    <Alert tone="warning" as="section" aria-label="Email verification" className="banner">
      <p>
        <strong>Please verify your email.</strong> We sent a link to {user.email}. Verifying it keeps your account secure and makes sure password reset emails reach you.
      </p>
      <Button variant="secondary" size="small" onClick={resend} disabled={sending}>
        {sending ? "Sending..." : "Resend verification email"}
      </Button>
      {message && <p role="status" className="banner__message">{message}</p>}
      {error && <p role="alert" className="banner__message field__error">{error}</p>}
    </Alert>
  );
}

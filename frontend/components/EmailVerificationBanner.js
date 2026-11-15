import { useEffect, useState } from "react";
import { getMe, resendVerificationEmail } from "../lib/api";

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

  // One slim line; the longer reason is the link's description for screen readers.
  return (
    <section aria-label="Email verification" className="verify-bar">
      <p className="verify-bar__line">
        <strong>Please verify your email</strong> <span className="verify-bar__email">(sent to {user.email}).</span>{" "}
        <button type="button" className="link-button" onClick={resend} disabled={sending} aria-describedby="verify-bar-why">
          {sending ? "Sending..." : "Resend email"}
        </button>
        <span id="verify-bar-why" className="visually-hidden">Verifying your email keeps your account secure and makes sure password reset emails reach you.</span>
      </p>
      {message && <p role="status" className="verify-bar__message">{message}</p>}
      {error && <p role="alert" className="verify-bar__message field__error">{error}</p>}
    </section>
  );
}

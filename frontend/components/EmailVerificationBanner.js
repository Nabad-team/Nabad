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

  return (
    <section aria-label="Email verification" style={{ border: "1px solid #d97706", background: "#fffbeb", borderRadius: 8, padding: 16, margin: "16px 0" }}>
      <p style={{ marginTop: 0 }}>
        <strong>Please verify your email.</strong> We sent a link to {user.email}. Verifying it keeps your account secure and makes sure password reset emails reach you.
      </p>
      <button type="button" onClick={resend} disabled={sending} style={{ padding: "8px 16px", borderRadius: 8, background: "#0f766e", color: "white", border: 0 }}>
        {sending ? "Sending..." : "Resend verification email"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    </section>
  );
}

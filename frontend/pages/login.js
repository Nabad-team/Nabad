import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { login, verifyTwoFactor, resendTwoFactor, googleLoginUrl } from "../lib/api";
import { minutesText, safeNextPath } from "../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const query = router.query || {};
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  // Why the user was sent here by the session timer (see components/SessionTimeout.js).
  const minutes = Number(query.minutes);
  const signedOutMessage =
    query.reason === "inactivity" && Number.isInteger(minutes) && minutes > 0
      ? "You were signed out after " + minutesText(minutes) + " of inactivity."
      : query.reason === "expired"
        ? "Your session has ended. Please sign in again."
        : "";

  useEffect(() => {
    if (typeof query.challenge === "string") setChallenge(query.challenge);
    if (query.error === "google_signin_failed") setError("Google sign-in could not be completed. Please try again.");
    if (query.error === "google_account_exists") setError("An account with this email already exists. Sign in with your password.");
  }, [query.challenge, query.error]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (challenge) {
        await verifyTwoFactor(challenge, code, rememberDevice);
      } else {
        const result = await login(email, password);
        if (result.twoFactorRequired) {
          setChallenge(result.challenge);
          setLoading(false);
          return;
        }
      }
      // Back to the page that asked for sign-in (only pages on our own site), otherwise the dashboard.
      router.push(safeNextPath(query.next));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setResendBusy(true);
    try {
      await resendTwoFactor(challenge);
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 380, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Log in to Nabad</h1>
      {signedOutMessage && <p role="status">{signedOutMessage}</p>}
      {challenge ? (
        <>
          <p>We sent a 6-digit verification code to your email. It expires in 10 minutes, works only once, and is cancelled after 5 incorrect tries.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="twoFactorCode">Verification code</label>
            <input id="twoFactorCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
              Remember this device for 30 days
            </label>
            {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify code"}</button>
          </form>
          <button type="button" onClick={handleResend} disabled={resendBusy} style={{ marginTop: 12 }}>{resendBusy ? "Sending..." : "Send a new code"}</button>
          <p><a href="/login">Use another sign-in method</a></p>
        </>
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}
            />

            {error && (
              <p role="alert" style={{ color: "crimson" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
              {loading ? "Please wait..." : "Log in"}
            </button>
          </form>
          <div style={{ textAlign: "center", margin: "20px 0" }}>or</div>
          <a href={googleLoginUrl()} style={{ display: "block", textAlign: "center", padding: 10, border: "1px solid #ccc", borderRadius: 6, textDecoration: "none" }}>Continue with Google</a>
          <p style={{ marginTop: 12 }}><a href="/forgot-password">Forgot password?</a></p>
        </>
      )}
    </main>
  );
}

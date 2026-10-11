import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { login, verifyTwoFactor, resendTwoFactor, googleLoginUrl } from "../lib/api";
import { minutesText, safeNextPath } from "../lib/session";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

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
    <PageLayout>
      <PageTitle lead={challenge ? null : "Welcome back."}>Log in to Nabad</PageTitle>
      {signedOutMessage && <Alert tone="info" as="p" role="status" className="auth-message">{signedOutMessage}</Alert>}
      {challenge ? (
        <div className="stack">
          <p className="prose">We sent a 6-digit verification code to your email. It expires in 10 minutes, works only once, and is cancelled after 5 incorrect tries.</p>
          <form onSubmit={handleSubmit} className="form">
            <Input id="twoFactorCode" label="Verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
            <label className="check">
              <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
              Remember this device for 30 days
            </label>
            {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
            <Button type="submit" disabled={loading} block>{loading ? "Verifying..." : "Verify code"}</Button>
          </form>
          <div className="form">
            <Button variant="secondary" onClick={handleResend} disabled={resendBusy} block>{resendBusy ? "Sending..." : "Send a new code"}</Button>
          </div>
          <p><a href="/login">Use another sign-in method</a></p>
        </div>
      ) : (
        <div className="stack">
          <form onSubmit={handleSubmit} className="form">
            <Input id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
            <Button type="submit" disabled={loading} block>
              {loading ? "Please wait..." : "Log in"}
            </Button>
          </form>
          <p className="divider-text">or</p>
          <div className="form">
            <Button variant="secondary" href={googleLoginUrl()} block>Continue with Google</Button>
          </div>
          <p><a href="/forgot-password">Forgot password?</a></p>
        </div>
      )}
    </PageLayout>
  );
}

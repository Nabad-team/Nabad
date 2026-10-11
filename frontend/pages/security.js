import { useEffect, useState } from "react";
import { beginTwoFactorSetup, enableTwoFactor, disableTwoFactor, getMe } from "../lib/api";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function SecurityPage() {
  const [enabled, setEnabled] = useState(false);
  const [authProvider, setAuthProvider] = useState("");
  const [setupStarted, setSetupStarted] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMe().then(({ user }) => { setEnabled(user.twoFactorEnabled); setAuthProvider(user.authProvider || "password"); }).catch((err) => setError(err.message));
  }, []);

  async function setup() {
    setError(""); setMessage("");
    try { await beginTwoFactorSetup(); setSetupStarted(true); setMessage("A verification code was sent to your email."); }
    catch (err) { setError(err.message); }
  }

  async function enable(e) {
    e.preventDefault(); setError("");
    try { await enableTwoFactor(code); setEnabled(true); setSetupStarted(false); setCode(""); setMessage("Two-factor authentication is enabled."); }
    catch (err) { setError(err.message); }
  }

  async function disable(e) {
    e.preventDefault(); setError("");
    try { await disableTwoFactor(password); setEnabled(false); setPassword(""); setMessage("Two-factor authentication is disabled."); }
    catch (err) { setError(err.message); }
  }

  return (
    <PageLayout title="Account security">
      <PageTitle>Account security</PageTitle>
      {error && <Alert tone="danger" as="p" role="alert" className="auth-message">{error}</Alert>}
      {authProvider === "google" && (
        <p className="prose">You sign in with Google, so Google protects your sign-in and Nabad does not send email codes. To add a second step, turn on 2-Step Verification in your Google account.</p>
      )}
      {authProvider === "password" && <>
      <p className="prose">Two-factor authentication adds a second step when you sign in: we email you a one-time code to enter after your password.</p>
      {message && <Alert tone="success" as="p" role="status" className="auth-message">{message}</Alert>}
      {enabled ? (
        <form onSubmit={disable} className="form section">
          <div>
            <h2>Two-factor authentication is on</h2>
            <p className="text-muted">A fresh code is sent at each sign-in, unless you chose to remember the device. You need your password to turn 2FA off, which also forgets every remembered device.</p>
          </div>
          <Input id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="form-actions">
            <Button type="submit" variant="secondary">Turn off 2FA</Button>
          </div>
        </form>
      ) : (
        !setupStarted ? <Button onClick={setup}>Set up two-factor authentication</Button> :
        <form onSubmit={enable} className="form section">
          <div>
            <h2>Confirm your email</h2>
            <p className="text-muted">Enter the 6-digit code sent to your email. It expires in 10 minutes and is cancelled after 5 incorrect attempts.</p>
          </div>
          <Input id="code" label="Verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <div className="form-actions">
            <Button type="submit">Enable 2FA</Button>
          </div>
        </form>
      )}
      </>}
      <p className="section"><a href="/profile">Back to profile</a></p>
    </PageLayout>
  );
}

// Account security settings: only for signed-in users (see components/RequireSignIn.js).
SecurityPage.requireSignIn = true;

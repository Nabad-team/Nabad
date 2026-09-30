import { useEffect, useState } from "react";
import { beginTwoFactorSetup, enableTwoFactor, disableTwoFactor, getMe } from "../lib/api";

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
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Account security</h1>
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {authProvider === "google" && (
        <p>You sign in with Google, so Google protects your sign-in and Nabad does not send email codes. To add a second step, turn on 2-Step Verification in your Google account.</p>
      )}
      {authProvider === "password" && <>
      <p>Two-factor authentication sends a one-time verification code to your email when you sign in.</p>
      {message && <p role="status">{message}</p>}
      {enabled ? (
        <form onSubmit={disable}>
          <h2>Two-factor authentication is on</h2>
          <p>A fresh code is sent at each sign-in, unless you chose to remember the device. You need your password to turn 2FA off, which also forgets every remembered device.</p>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button style={{ marginTop: 12 }}>Turn off 2FA</button>
        </form>
      ) : (
        !setupStarted ? <button onClick={setup}>Set up two-factor authentication</button> :
        <form onSubmit={enable}>
          <h2>Confirm your email</h2>
          <p>Enter the 6-digit code sent to your email. It expires in 10 minutes and is cancelled after 5 incorrect attempts.</p>
          <label htmlFor="code">Verification code</label>
          <input id="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button style={{ marginTop: 12 }}>Enable 2FA</button>
        </form>
      )}
      </>}
      <p><a href="/profile">Back to profile</a></p>
    </main>
  );
}

// Account security settings: only for signed-in users (see components/RequireSignIn.js).
SecurityPage.requireSignIn = true;

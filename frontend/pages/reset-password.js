import { useState } from "react";
import { useRouter } from "next/router";
import { resetPassword } from "../lib/api";
import { PASSWORD_HELP, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from "../lib/passwordPolicy";

export default function ResetPasswordPage() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e) { e.preventDefault(); setError(""); setLoading(true); try { const result = await resetPassword(router.query.token, password); setMessage(result.message); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <main style={{ maxWidth: 400, margin: "80px auto", fontFamily: "sans-serif" }}><h1>Choose a new password</h1><form onSubmit={submit}><label htmlFor="password">New password</label><p id="password-help">{PASSWORD_HELP}</p><input id="password" type="password" minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_PATTERN} aria-describedby="password-help" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} />{error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}{message && <p role="status">{message} <a href="/login">Log in</a></p>}<button disabled={loading || !router.isReady}>{loading ? "Updating..." : "Update password"}</button></form></main>;
}

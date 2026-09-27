import { useState } from "react";
import { requestPasswordReset } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e) { e.preventDefault(); setError(""); setLoading(true); try { const result = await requestPasswordReset(email); setMessage(result.message); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <main style={{ maxWidth: 400, margin: "80px auto", fontFamily: "sans-serif" }}><h1>Reset your password</h1><p>Enter your account email and we’ll send a reset link if it matches an account.</p><form onSubmit={submit}><label htmlFor="email">Email</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} />{error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}{message && <p role="status">{message}</p>}<button disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button></form><p><a href="/login">Back to log in</a></p></main>;
}

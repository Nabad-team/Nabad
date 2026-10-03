import { useRef, useState } from "react";
import { useRouter } from "next/router";
import { resetPassword } from "../lib/api";
import { findPasswordProblem } from "../lib/passwordPolicy";
import NewPasswordField from "../components/NewPasswordField";

export default function ResetPasswordPage() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  async function submit(e) {
    e.preventDefault();
    // The page doesn't know the account's name or email; the server checks those and reports them the same way.
    const problem = findPasswordProblem(password);
    if (problem) { setError(problem.message); passwordRef.current?.focus(); return; }
    setError(""); setLoading(true);
    try { const result = await resetPassword(router.query.token, password); setMessage(result.message); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <main style={{ maxWidth: 400, margin: "80px auto", fontFamily: "sans-serif" }}><h1>Choose a new password</h1><form onSubmit={submit}><NewPasswordField label="New password" value={password} onChange={setPassword} inputRef={passwordRef} />{error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}{message && <p role="status">{message} <a href="/login">Log in</a></p>}<button disabled={loading || !router.isReady}>{loading ? "Updating..." : "Update password"}</button></form></main>;
}

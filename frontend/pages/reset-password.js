import { useRef, useState } from "react";
import { useRouter } from "next/router";
import { resetPassword } from "../lib/api";
import { findPasswordProblem } from "../lib/passwordPolicy";
import NewPasswordField from "../components/NewPasswordField";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

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
  return (
    <PageLayout title="Choose a new password">
      <PageTitle>Choose a new password</PageTitle>
      <form onSubmit={submit} className="form">
        <NewPasswordField label="New password" value={password} onChange={setPassword} inputRef={passwordRef} />
        {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
        {message && <Alert tone="success" as="p" role="status">{message} <a href="/login">Log in</a></Alert>}
        <Button type="submit" disabled={loading || !router.isReady} block>{loading ? "Updating..." : "Update password"}</Button>
      </form>
    </PageLayout>
  );
}

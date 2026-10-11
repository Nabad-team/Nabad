import { useState } from "react";
import { requestPasswordReset } from "../lib/api";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e) { e.preventDefault(); setError(""); setLoading(true); try { const result = await requestPasswordReset(email); setMessage(result.message); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return (
    <PageLayout title="Reset your password">
      <PageTitle lead="Enter the email you signed up with. If it matches an account, we'll send you a link to choose a new password.">Reset your password</PageTitle>
      <form onSubmit={submit} className="form">
        <Input id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
        {message && <Alert tone="success" as="p" role="status">{message}</Alert>}
        <Button type="submit" disabled={loading} block>{loading ? "Sending..." : "Send reset link"}</Button>
        <p><a href="/login">Back to log in</a></p>
      </form>
    </PageLayout>
  );
}

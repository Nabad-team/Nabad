import { useRef, useState } from "react";
import { useRouter } from "next/router";
import { signup } from "../lib/api";
import { findPasswordProblem } from "../lib/passwordPolicy";
import NewPasswordField from "../components/NewPasswordField";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = findPasswordProblem(form.password, { name: form.name, email: form.email });
    if (problem) {
      setError(problem.message);
      passwordRef.current?.focus();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password);
      router.push("/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout>
      <PageTitle lead="It takes about a minute. You can add family members later.">Create your Nabad account</PageTitle>
      <form onSubmit={handleSubmit} className="form">
        <Input id="name" label="Name" autoComplete="name" value={form.name} onChange={update("name")} required />
        <Input id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={update("email")} required />

        <NewPasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} context={{ name: form.name, email: form.email }} inputRef={passwordRef} />

        {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
        <Button type="submit" disabled={loading} block>
          {loading ? "Creating account..." : "Sign up"}
        </Button>
      </form>
    </PageLayout>
  );
}

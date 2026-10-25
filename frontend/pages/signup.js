import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { signup, googleLoginUrl } from "../lib/api";
import { findPasswordProblem } from "../lib/passwordPolicy";
import { safeNextPath } from "../lib/session";
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
  // ?next= is the page to return to (only on our own site), for example a care circle invitation; ?email= fills in the
  // invited address.
  const query = router.query || {};
  const next = typeof query.next === "string" ? safeNextPath(query.next, "") : "";
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  useEffect(() => {
    if (typeof query.email === "string") setForm((current) => (current.email ? current : { ...current, email: query.email.slice(0, 254) }));
  }, [router.isReady]);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const problem = findPasswordProblem(form.password, {
      name: form.name,
      email: form.email,
    });

    if (problem) {
      setError(problem.message);
      passwordRef.current?.focus();
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signup(form.name, form.email, form.password);
      router.push(next || "/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout title="Sign up" variant="auth">
      <PageTitle lead="It takes about a minute. You can add family members later.">
        Create your Nabad account
      </PageTitle>

      <div className="stack">
        <form onSubmit={handleSubmit} className="form">
          <Input
            id="name"
            label="Name"
            autoComplete="name"
            value={form.name}
            onChange={update("name")}
            required
          />

          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            required
          />

          <NewPasswordField
            value={form.password}
            onChange={(password) =>
              setForm({ ...form, password })
            }
            context={{
              name: form.name,
              email: form.email,
            }}
            inputRef={passwordRef}
          />

          {error && (
            <Alert tone="danger" as="p" role="alert">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            disabled={loading}
            block
          >
            {loading
              ? "Creating account..."
              : "Sign up"}
          </Button>
        </form>

        <p>
          By creating an account you agree to the{" "}
          <Link href="/terms">Terms of Use</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <p className="divider-text">
          or
        </p>

        <div className="form">
          <Button
            variant="secondary"
            href={googleLoginUrl()}
            block
          >
            Continue with Google
          </Button>
        </div>

        <p>
          Already have an account?{" "}
          <a href={loginHref}>
            Log in
          </a>
        </p>
      </div>
    </PageLayout>
  );
}

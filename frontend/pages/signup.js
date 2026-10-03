import { useRef, useState } from "react";
import { useRouter } from "next/router";
import { signup } from "../lib/api";
import { findPasswordProblem } from "../lib/passwordPolicy";
import NewPasswordField from "../components/NewPasswordField";

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
    <main style={{ maxWidth: 380, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Create your Nabad account</h1>
      <form onSubmit={handleSubmit}>
        <label>Name</label>
        <input value={form.name} onChange={update("name")} required style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} />

        <label>Email</label>
        <input type="email" value={form.email} onChange={update("email")} required style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} />

        <NewPasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} context={{ name: form.name, email: form.email }} inputRef={passwordRef} />

        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  );
}


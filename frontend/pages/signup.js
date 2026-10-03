import { useState } from "react";
import { useRouter } from "next/router";
import { signup } from "../lib/api";
import { PASSWORD_HELP, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from "../lib/passwordPolicy";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
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

        <label htmlFor="password">Password</label>
        <p id="password-help">{PASSWORD_HELP}</p>
        <input id="password" type="password" value={form.password} onChange={update("password")} required minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_PATTERN} aria-describedby="password-help" autoComplete="new-password" style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} />

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  );
}


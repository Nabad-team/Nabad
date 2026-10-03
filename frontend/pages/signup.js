import { useState } from "react";
import { useRouter } from "next/router";
import { signup } from "../lib/api";
import { getPasswordStrength, PASSWORD_HELP, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from "../lib/passwordPolicy";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordStrength = getPasswordStrength(form.password);

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
        {passwordStrength && (
          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <div role="meter" aria-label="Password strength" aria-valuemin={1} aria-valuemax={5} aria-valuenow={passwordStrength.score} aria-valuetext={passwordStrength.label} style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((segment) => (
                <span key={segment} aria-hidden="true" style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: segment <= passwordStrength.score ? passwordStrength.color : "#d0d5dd" }} />
              ))}
            </div>
            <p role="status" aria-live="polite" style={{ margin: "6px 0 0", color: passwordStrength.color }}>
              Password strength: <strong>{passwordStrength.label}</strong>. {passwordStrength.detail}
            </p>
          </div>
        )}

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  );
}


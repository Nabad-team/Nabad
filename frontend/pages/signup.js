import { useState } from "react";
import { useRouter } from "next/router";
import { signup } from "../lib/api";

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

        <label>Password (min 8 characters)</label>
        <input type="password" value={form.password} onChange={update("password")} required minLength={8} style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} />

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  );
}


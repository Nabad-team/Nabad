import { useState } from "react";
import { useRouter } from "next/router";
import { login, verifyTwoFactor } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (challenge) await verifyTwoFactor(challenge, code);
      else {
        const result = await login(email, password);
        if (result.twoFactorRequired) { setChallenge(result.challenge); setLoading(false); return; }
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 380, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Log in to Nabad</h1>
      <form onSubmit={handleSubmit}>
        {!challenge && <><label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: 8, margin: "6px 0 16px" }}
        /></>}
        {challenge && <><label htmlFor="twoFactorCode">Authenticator code</label><input id="twoFactorCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value)} required style={{ width: "100%", padding: 8, margin: "6px 0 16px" }} /></>}
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Please wait..." : challenge ? "Verify code" : "Log in"}
        </button>
      </form>
      {!challenge && <p style={{ marginTop: 12 }}>
        <a href="/forgot-password">Forgot password?</a>
      </p>}
    </main>
  );
}


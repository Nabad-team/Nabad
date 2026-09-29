import { useState } from "react";
import Head from "next/head";
import ProfileHeader from "../components/ProfileHeader";
import { assessSymptoms, getEmergencyRoute } from "../lib/triageApi";

const TEAL = "#0f766e";
const RED = "#b91c1c";

export default function TriagePage() {
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [routing, setRouting] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setRouting(null);

    try {
      const data = await assessSymptoms(symptoms);
      setResult(data);
      if (data.level === "emergency") setRouting(data.routing);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function routeEmergency() {
    setError("");
    try {
      setRouting(await getEmergencyRoute());
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px", fontFamily: "sans-serif", color: "#1f2937" }}>
      <Head><title>Symptom triage | Nabad</title></Head>
      <ProfileHeader />
      <h1>Symptom triage</h1>
      <p>Describe what you are experiencing. Nabad provides guidance only and does not diagnose medical conditions.</p>

      <form onSubmit={submit}>
        <label htmlFor="symptoms"><strong>Symptoms</strong></label>
        <textarea
          id="symptoms"
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Describe your symptoms in your own words"
          maxLength={2000}
          style={{ width: "100%", minHeight: 150, padding: 12, boxSizing: "border-box", marginTop: 8 }}
        />
        <button type="submit" disabled={loading || symptoms.trim().length < 3} style={{ marginTop: 12, padding: "10px 20px", background: TEAL, color: "white", border: 0, borderRadius: 8 }}>
          {loading ? "Assessing..." : "Get guidance"}
        </button>
      </form>

      {error && <p role="alert" style={{ color: RED }}>{error}</p>}

      {result && (
        <section aria-live="polite" style={{ marginTop: 24, border: "1px solid #d1d5db", borderRadius: 10, padding: 16 }}>
          <h2>Guidance</h2>
          <p><strong>Status:</strong> {result.level.replaceAll("_", " ")}</p>
          <p>{result.disclaimer}</p>
          {result.guidance && <p>{result.guidance}</p>}
          {result.level === "needs_clinical_review" && (
            <p>Please contact a qualified healthcare professional for an assessment.</p>
          )}
        </section>
      )}

      <section style={{ marginTop: 32, border: "2px solid " + RED, borderRadius: 10, padding: 16 }}>
        <h2>Emergency routing</h2>
        <p>If you believe this is an emergency, do not wait for an assessment.</p>
        <button type="button" onClick={routeEmergency} style={{ padding: "10px 20px", background: RED, color: "white", border: 0, borderRadius: 8 }}>
          Show emergency contact
        </button>

        {routing && (
          <div style={{ marginTop: 16 }}>
            <p><strong>{routing.contactName}</strong>{routing.contactNumber ? `: ${routing.contactNumber}` : ""}</p>
            <p>{routing.instructions}</p>
            <a
              href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(routing.mapQuery)}
              target="_blank"
              rel="noreferrer"
            >
              Find an emergency department nearby
            </a>
          </div>
        )}
      </section>

      <p style={{ marginTop: 24 }}><a href="/dashboard" style={{ color: TEAL }}>Back to dashboard</a></p>
    </main>
  );
}

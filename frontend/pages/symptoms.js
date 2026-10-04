import { useState } from "react";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord } from "../lib/symptomApi";

export default function SymptomsPage() {
  const { activeProfile } = useActiveProfile();
  const [symptoms, setSymptoms] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!activeProfile) {
      setError("No active profile selected.");
      return;
    }

    if (!symptoms.trim()) {
      setError("Please enter symptoms.");
      return;
    }

    try {
      await addSymptomRecord(
        activeProfile.id,
        activeProfile.fullName,
        symptoms.trim()
      );

      setMessage(`Symptoms recorded for ${activeProfile.fullName}.`);
      setSymptoms("");
    } catch (err) {
      console.error(err);
      setError("Could not save symptoms.");
    }
  }

  if (!activeProfile) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Symptom Entry</h1>
        <p>No active profile selected.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "700px",
        margin: "0 auto",
        padding: "2rem",
      }}
    >
      <h1>Enter Symptoms</h1>

      <p>
        You are entering symptoms for:
        <strong> {activeProfile.fullName}</strong>
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginTop: "1.5rem" }}>
          <label htmlFor="symptoms">
            <strong>Symptoms</strong>
          </label>

          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder={`Enter symptoms for ${activeProfile.fullName}`}
            rows="6"
            style={{
              display: "block",
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.75rem",
              fontSize: "1rem",
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1.5rem",
            cursor: "pointer",
          }}
        >
          Submit Symptoms
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: "1rem",
          }}
        >
          {message}
        </p>
      )}

      {error && (
        <p
          style={{
            marginTop: "1rem",
          }}
        >
          {error}
        </p>
      )}
    </main>
  );
}
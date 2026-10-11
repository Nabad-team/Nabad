import { useState } from "react";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { assessSymptoms } from "../lib/triageApi";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function TriagePage() {
  const { activeProfile } = useActiveProfile();
  const [symptoms, setSymptoms] = useState("");
  const [country, setCountry] = useState("LB");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      setResult(await assessSymptoms(symptoms.trim(), { country }));
    } catch (failure) {
      setError(failure.message || "We could not complete the assessment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout title="Safety check" header={<ProfileHeader showPicture={false} />}>
      <PageTitle>Safety check</PageTitle>
      <p>
        Describe symptoms for {activeProfile?.fullName || "the active profile"}. This gives general
        guidance, not a diagnosis.
      </p>

      <form onSubmit={handleSubmit} className="form">
        <Input
          as="textarea"
          id="triage-symptoms"
          label="Symptoms"
          value={symptoms}
          onChange={(event) => setSymptoms(event.target.value)}
          placeholder="For example: chest pain and trouble breathing."
          rows="6"
          required
        />
        <div className="field">
          <label htmlFor="triage-country" className="field__label">Location</label>
          <select id="triage-country" className="input" value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="LB">Lebanon</option>
            <option value="OTHER">Other location</option>
          </select>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Checking..." : "Check urgency"}</Button>
      </form>

      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {result && (
        <section className="urgency urgency--routine" aria-labelledby="triage-result-heading">
          <h2 id="triage-result-heading">Safety check result: {result.level}</h2>
          <p>{result.disclaimer}</p>
          {result.guidance && <p>{result.guidance}</p>}
          {result.routing && (
            <p>
              <strong>{result.routing.contactName}</strong>
              {result.routing.contactNumber ? `: ${result.routing.contactNumber}. ` : ". "}
              {result.routing.instructions}
            </p>
          )}
        </section>
      )}
    </PageLayout>
  );
}

TriagePage.requireSignIn = true;

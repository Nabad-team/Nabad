import { useState } from "react";
import { triageProviderUrl } from "../lib/providerFilters";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { assessSymptoms } from "../lib/triageApi";
import { getEmergencyContact } from "../lib/api";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import ReadAloudButton from "../components/ReadAloudButton";

export default function TriagePage() {
  const { activeProfile } = useActiveProfile();

  const [symptoms, setSymptoms] = useState("");
  const [country, setCountry] = useState("LB");
  const [result, setResult] = useState(null);
  const [emergencyContact, setEmergencyContact] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setResult(null);
    setEmergencyContact(null);
    setBusy(true);

    try {
      const assessment = await assessSymptoms(
        symptoms.trim(),
        { country }
      );

      setResult(assessment);

      // Only load the saved emergency contact when
      // the safety check finds an emergency.
      if (
        assessment?.level?.toLowerCase() === "emergency"
      ) {
        try {
          const contactResponse =
            await getEmergencyContact();

          setEmergencyContact(
            contactResponse.contact || null
          );
        } catch {
          // The emergency result should still be shown
          // even if the saved contact cannot be loaded.
          setEmergencyContact(null);
        }
      }
    } catch (failure) {
      setError(
        failure.message ||
          "We could not complete the assessment."
      );
    } finally {
      setBusy(false);
    }
  }

  function spokenResult(resultToRead) {
    return [
      `Safety check result: ${resultToRead.level}.`,
      resultToRead.disclaimer,
      resultToRead.guidance,

      resultToRead.selfCareGuidance
        ? `Self-care guidance: ${resultToRead.selfCareGuidance.join(
            ". "
          )}.`
        : "",

      resultToRead.routing
        ? `${resultToRead.routing.contactName}${
            resultToRead.routing.contactNumber
              ? `: ${resultToRead.routing.contactNumber}.`
              : "."
          } ${resultToRead.routing.instructions}`
        : "",

      emergencyContact
        ? `Your emergency contact is ${emergencyContact.name}, phone number ${emergencyContact.phone}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const isEmergency =
    result?.level?.toLowerCase() === "emergency";

  const emergencyContactPhone =
    emergencyContact?.phone
      ? String(emergencyContact.phone).replace(
          /[^\d+]/g,
          ""
        )
      : "";

  return (
    <PageLayout
      title="Safety check"
      header={
        <ProfileHeader showPicture={false} />
      }
    >
      <PageTitle>Safety check</PageTitle>

      <p>
        Describe symptoms for{" "}
        {activeProfile?.fullName ||
          "the active profile"}
        . This gives general guidance, not a
        diagnosis.
      </p>

      <form
        onSubmit={handleSubmit}
        className="form"
      >
        <Input
          as="textarea"
          id="triage-symptoms"
          label="Symptoms"
          value={symptoms}
          onChange={(event) =>
            setSymptoms(event.target.value)
          }
          placeholder="For example: chest pain and trouble breathing."
          rows="6"
          required
        />

        <div className="field">
          <label
            htmlFor="triage-country"
            className="field__label"
          >
            Location
          </label>

          <select
            id="triage-country"
            className="input"
            value={country}
            onChange={(event) =>
              setCountry(event.target.value)
            }
          >
            <option value="LB">
              Lebanon
            </option>

            <option value="OTHER">
              Other location
            </option>
          </select>
        </div>

        <Button
          type="submit"
          disabled={busy}
        >
          {busy
            ? "Checking..."
            : "Check urgency"}
        </Button>
      </form>

      {error && (
        <Alert
          tone="danger"
          as="p"
          role="alert"
        >
          {error}
        </Alert>
      )}

      {isEmergency &&
        result?.routing?.contactNumber && (
          <Alert
            tone="danger"
            role="alert"
          >
            <h2>Emergency — call now</h2>

            <p>
              <strong>
                {result.routing.contactName}
              </strong>
            </p>

            <p>
              Emergency number:{" "}
              <strong>
                {result.routing.contactNumber}
              </strong>
            </p>

            <p>
              <a
                href={`tel:${result.routing.contactNumber}`}
              >
                Call{" "}
                {result.routing.contactNumber}
              </a>
            </p>

            {emergencyContact && (
              <div>
                <h3>
                  Your emergency contact
                </h3>

                <p>
                  <strong>
                    {emergencyContact.name}
                  </strong>
                </p>

                <p>
                  {emergencyContact.phone}
                </p>

                <p>
                  <a
                    href={`tel:${emergencyContactPhone}`}
                  >
                    Call{" "}
                    {emergencyContact.name}
                  </a>
                </p>
              </div>
            )}
          </Alert>
        )}

      {result && (
        <section
          className="urgency urgency--routine"
          aria-labelledby="triage-result-heading"
        >
          <h2 id="triage-result-heading">
            Safety check result:{" "}
            {result.level}
          </h2>

          <p>{result.disclaimer}</p>
          {country === "LB" && <p><a className="button button--secondary" href={triageProviderUrl(result)}>
            {isEmergency ? "Find hospitals with a published 24/7 ER" : "Find hospitals and clinics"}
          </a></p>}

          {result.guidance && (
            <p>{result.guidance}</p>
          )}

          {result.selfCareGuidance && (
            <div>
              <h3>Self-care guidance</h3>

              <ul>
                {result.selfCareGuidance.map(
                  (item, index) => (
                    <li key={index}>
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {result.routing && (
            <p>
              <strong>
                {result.routing.contactName}
              </strong>

              {result.routing.contactNumber
                ? `: ${result.routing.contactNumber}. `
                : ". "}

              {result.routing.instructions}
            </p>
          )}

          <p>
            <ReadAloudButton
              text={spokenResult(result)}
            />
          </p>
        </section>
      )}
    </PageLayout>
  );
}

TriagePage.requireSignIn = true;

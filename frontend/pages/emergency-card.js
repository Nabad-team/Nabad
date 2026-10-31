import { useEffect, useState } from "react";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getEmergencyCard } from "../lib/emergencyCardApi";
import { factText } from "../lib/healthProfile";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";

const allergyTypes = { medication: "Medication", food: "Food", other: "Other" };
const medicationForms = { tablet: "Tablet", syrup: "Syrup", injection: "Injection", inhaler: "Inhaler", drops: "Drops", other: "Other" };
const birthDate = value => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "Not recorded";

export default function EmergencyCardPage() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const [state, setState] = useState(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!profileId) return;
    const controller = new AbortController();
    let current = true;
    setState({ profileId });
    getEmergencyCard(profileId, controller.signal).then(card => {
      if (card.profile.id !== profileId) throw new Error("Profile mismatch");
      if (current) setState({ profileId, card });
    }).catch(error => {
      if (current && error.name !== "AbortError") setState({ profileId, error: "We couldn't load the emergency card. Please try again." });
    });
    return () => { current = false; controller.abort(); };
  }, [profileId, refresh]);
  // Never paint or print the previous patient's snapshot during a profile switch.
  const card = state && state.profileId === profileId ? state.card : null;
  const error = state && state.profileId === profileId ? state.error : "";
  return <PageLayout title="Emergency information card" header={<ProfileHeader showPicture={false} />}>
    <div className="emergency-card-controls">
      <PageTitle lead="Keep your important health information ready to show a healthcare provider.">Emergency information card</PageTitle>
      <p>Review the card before printing. It contains private health information; keep the printed copy somewhere safe.</p>
      <div className="form-actions">
        <Button disabled={!card} onClick={() => window.print()}>Print emergency card</Button>
        <Button variant="secondary" disabled={!profileId} onClick={() => setRefresh(value => value + 1)}>Refresh card</Button>
        <Button variant="secondary" href="/my-health">Update health information</Button>
        <Button variant="secondary" href="/medications">Update medications</Button>
        {profileId === "self" && <Button variant="secondary" href="/profile">Update emergency contact</Button>}
      </div>
      {!profileId ? <p>Select a profile to prepare its emergency card.</p>
        : error ? <Alert tone="danger" role="alert">{error}</Alert>
          : !card ? <HeartbeatLoader label="Preparing emergency card..." /> : null}
    </div>
    {card && <article className="emergency-card" aria-label={`Emergency information card for ${card.profile.fullName}`}>
      <header className="emergency-card__heading">
        <p>Nabad · Emergency information card</p>
        <h2>{card.profile.fullName}</h2>
        <p><strong>Date of birth:</strong> {birthDate(card.profile.dateOfBirth)}</p>
        <p><strong>Blood type:</strong> {card.bloodType === "unknown" ? "Unknown" : card.bloodType || "Not recorded"}</p>
      </header>
      <section aria-labelledby="card-conditions"><h3 id="card-conditions">Medical conditions</h3>
        {card.conditions.length ? <ul>{card.conditions.map((value, index) => <li key={index}>{factText({ category: "condition", value })}</li>)}</ul> : <p>No medical conditions recorded.</p>}
      </section>
      <section aria-labelledby="card-allergies"><h3 id="card-allergies">Allergies</h3>
        {card.allergies.length ? <ul>{card.allergies.map((allergy, index) => <li key={index}><strong>{allergy.name}</strong> ({allergyTypes[allergy.type] || allergy.type})<br />Reaction: {allergy.reaction || "Not recorded"}</li>)}</ul> : <p>No allergies recorded. This does not confirm there are no known allergies.</p>}
      </section>
      <section aria-labelledby="card-medications"><h3 id="card-medications">Active medications</h3>
        {card.medications.length ? <ul>{card.medications.map((medication, index) => <li key={index}><strong>{medication.name}</strong><br />Dose: {medication.dose ? [medication.dose, medication.unit].filter(Boolean).join(" ") : "Not recorded"} · Form: {medicationForms[medication.form] || "Not recorded"}<br />Frequency: {medication.frequency || "Not recorded"}</li>)}</ul> : <p>No active medications recorded.</p>}
      </section>
      <section aria-labelledby="card-contact"><h3 id="card-contact">Emergency contact</h3>
        {card.emergencyContact ? <p><strong>{card.emergencyContact.name}</strong><br /><a href={`tel:${card.emergencyContact.phone}`}>{card.emergencyContact.phone}</a></p> : <p>No emergency contact recorded for this profile.</p>}
      </section>
      <footer><p>Prepared {new Date(card.preparedAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })} (Beirut time).</p>
        <p>Based on saved health information. It may be incomplete or out of date. Confirm details with the patient or caregiver.</p>
      </footer>
    </article>}
  </PageLayout>;
}
EmergencyCardPage.requireSignIn = true;

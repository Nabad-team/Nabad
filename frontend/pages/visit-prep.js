import { useEffect, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getHealthProfile } from "../lib/healthProfileApi";
import { factText } from "../lib/healthProfile";
import { getSymptomsForProfile } from "../lib/symptomApi";
import { formatDate } from "../lib/dates";

const CATEGORY_LABELS = {
  sex: "Sex assigned at birth", height: "Height", weight: "Weight", bloodType: "Blood type",
  pregnancy: "Pregnancy", smoking: "Smoking", condition: "Long-term condition", allergy: "Allergy",
};
const SUMMARY_LIMIT = 20;
const ALLERGY_TYPES = { medication: "Medication", food: "Food", other: "Other" };

function summaryFactText(fact) {
  if (fact.category !== "allergy") return factText(fact);
  const { type, name, reaction } = fact.value;
  return `${name} (${ALLERGY_TYPES[type] || type}${reaction ? `; reaction: ${reaction}` : ""})`;
}

export default function VisitPrepPage() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profileId) return undefined;
    let current = true;
    setData(null);
    setError("");
    Promise.all([getHealthProfile(profileId), getSymptomsForProfile(profileId)])
      .then(([health, symptoms]) => { if (current) setData({ health, symptoms }); })
      .catch(() => { if (current) setError("We couldn't prepare this summary. Please check your connection and try again."); });
    return () => { current = false; };
  }, [profileId]);

  const name = activeProfile?.fullName || "This profile";
  const facts = data?.health.facts || [];
  const background = facts.filter((fact) => ["condition", "allergy", "pregnancy", "smoking", "bloodType"].includes(fact.category));
  const basics = facts.filter((fact) => ["sex", "height", "weight"].includes(fact.category));
  const symptomRecords = (data?.symptoms || []).slice(0, SUMMARY_LIMIT);

  return (
    <PageLayout title="Visit preparation" header={<ProfileHeader showPicture={false} />}>
      <PageTitle lead="A structured summary of saved symptom checks and confirmed health information." >Visit preparation</PageTitle>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {!data && !error && <HeartbeatLoader label="Preparing your summary..." />}
      {data && (
        <>
        <div className="visit-prep__actions">
          <Button variant="secondary" onClick={() => window.print()}>Print or save as PDF</Button>
        </div>
        <div className="stack visit-prep">
          <Card className="section" aria-labelledby="visit-prep-person-heading">
            <h2 id="visit-prep-person-heading">Patient and health background</h2>
            <p><strong>Name:</strong> {name}</p>
            {data.health.age && <p><strong>Age:</strong> {data.health.age.text}</p>}
            {data.health.dateOfBirth && <p><strong>Date of birth:</strong> {formatDate(data.health.dateOfBirth)}</p>}
            <h3>Relevant health information</h3>
            {background.length ? <ul>{background.map((fact) => <li key={fact.id}><strong>{CATEGORY_LABELS[fact.category]}:</strong> {summaryFactText(fact)}</li>)}</ul> : <p className="text-muted">No confirmed conditions, allergies or other background information recorded.</p>}
            {basics.length > 0 && <>
              <h3>Other recorded details</h3>
              <ul>{basics.map((fact) => <li key={fact.id}><strong>{CATEGORY_LABELS[fact.category]}:</strong> {factText(fact)}</li>)}</ul>
            </>}
          </Card>

          <Card className="section" aria-labelledby="visit-prep-symptoms-heading">
            <h2 id="visit-prep-symptoms-heading">Recent symptom checks</h2>
            {symptomRecords.length ? <ol className="visit-prep__symptoms" aria-label="Recent symptom checks">
              {symptomRecords.map((record) => (
                <li key={record.id}>
                  <p><strong>{formatDate(String(record.createdAt || "").slice(0, 10))}</strong>{record.urgencyResult?.label ? ` · ${record.urgencyResult.label}` : ""}</p>
                  <p>{record.symptoms || record.description}</p>
                  {record.conversation?.length > 2 && <ul aria-label="Follow-up details">{record.conversation.slice(2).filter((message) => message.role === "patient").map((message, index) => <li key={`${record.id}-${index}`}>{message.content}</li>)}</ul>}
                </li>
              ))}
            </ol> : <p className="text-muted">No saved symptom checks yet.</p>}
            {data.symptoms.length > SUMMARY_LIMIT && <p className="text-muted">Showing the {SUMMARY_LIMIT} most recent checks.</p>}
          </Card>
          <p className="text-muted">Based on information saved in Nabad. Please review it with your clinician; it may not include everything you want to discuss.</p>
          <p className="visit-prep__back"><a href="/dashboard">Back to dashboard</a></p>
        </div>
        </>
      )}
    </PageLayout>
  );
}

VisitPrepPage.requireSignIn = true;

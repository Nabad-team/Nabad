import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PageLayout from "../../components/ui/PageLayout";
import PageTitle from "../../components/ui/PageTitle";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Alert from "../../components/ui/Alert";
import { HeartbeatLoader } from "../../components/ui/Heartbeat";
import { confirmSharedVisitPrep, getSharedVisitPrep, sharedDocumentDownloadUrl } from "../../lib/visitPrepApi";

const dateTime = (value) => new Date(value).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

export default function SharedVisitPrepPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [accurate, setAccurate] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!router.isReady || !token) return;
    let current = true;
    getSharedVisitPrep(token).then((value) => { if (current) setSheet(value); }).catch((failure) => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [router.isReady, token]);

  async function confirm(event) {
    event.preventDefault();
    if (!clinicianName.trim() || !accurate) { setError("Enter your name and confirm that the sheet is accurate."); return; }
    setConfirming(true); setError("");
    try {
      const result = await confirmSharedVisitPrep(token, clinicianName.trim());
      setSheet((current) => ({ ...current, ...result }));
    } catch (failure) { setError(failure.message); }
    finally { setConfirming(false); }
  }

  return (
    <PageLayout title="Shared visit preparation">
      <PageTitle lead="A read-only visit summary shared securely by the patient or their caregiver.">Shared visit preparation</PageTitle>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {!sheet && !error && <HeartbeatLoader label="Opening shared visit sheet..." />}
      {sheet && <div className="stack visit-prep shared-visit-prep">
        <Alert tone="info" as="p">This snapshot was shared on {dateTime(sheet.createdAt)} and is available until {dateTime(sheet.expiresAt)}. Confirm details directly with the patient.</Alert>
        <Card className="section"><h2>Patient</h2><p>{sheet.patientName}</p></Card>
        {sheet.sections.map((section, index) => <Card className="section" key={`${section.title}-${index}`}>
          <h2>{section.title}</h2><p className="shared-visit-prep__text">{section.text}</p>
        </Card>)}
        {sheet.documents.length > 0 && <Card className="section"><h2>Shared documents</h2><ul>
          {sheet.documents.map((document) => <li key={document.id}><a href={sharedDocumentDownloadUrl(token, document.id)}>{document.filename}</a></li>)}
        </ul></Card>}
        <Card className="section" aria-labelledby="clinician-confirmation-heading">
          <h2 id="clinician-confirmation-heading">Clinician confirmation</h2>
          {sheet.confirmedAt ? <Alert tone="success" as="p" role="status">Marked accurate by {sheet.confirmedBy} on {dateTime(sheet.confirmedAt)}.</Alert> : <form className="form" onSubmit={confirm}>
            <p className="text-muted">Confirm only after reviewing this snapshot with the patient. Confirmation cannot be changed through this link.</p>
            <Input id="clinician-name" label="Your name" value={clinicianName} onChange={(event) => setClinicianName(event.target.value)} maxLength="120" autoComplete="name" required />
            <label className="check-row"><input type="checkbox" checked={accurate} onChange={(event) => setAccurate(event.target.checked)} /> <span>I reviewed this visit sheet with the patient and it is accurate.</span></label>
            <Button type="submit" disabled={confirming}>{confirming ? "Confirming..." : "Mark as accurate"}</Button>
          </form>}
        </Card>
      </div>}
    </PageLayout>
  );
}

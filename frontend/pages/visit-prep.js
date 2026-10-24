import { useEffect, useRef, useState } from "react";
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
import { getMedicalDocuments, medicalDocumentDownloadUrl } from "../lib/medicalDocumentApi";
import { formatDate } from "../lib/dates";

const CATEGORY_LABELS = {
  sex: "Sex assigned at birth", height: "Height", weight: "Weight", bloodType: "Blood type",
  pregnancy: "Pregnancy", smoking: "Smoking", condition: "Long-term condition", allergy: "Allergy",
};
const SUMMARY_LIMIT = 20;
const ALLERGY_TYPES = { medication: "Medication", food: "Food", other: "Other" };
const MEDICATION_FORMS = { tablet: "Tablet", syrup: "Syrup", injection: "Injection", inhaler: "Inhaler", drops: "Drops", other: "Other" };
const DOCUMENT_TYPES = { imaging: "Imaging", lab: "Lab result", letter: "Letter", other: "Other" };

function summaryFactText(fact) {
  if (fact.category !== "allergy") return factText(fact);
  const { type, name, reaction } = fact.value;
  return `${name} (${ALLERGY_TYPES[type] || type}${reaction ? `; reaction: ${reaction}` : ""})`;
}

function medicationDetails(medication) {
  const dose = [medication.dose, medication.unit].filter(Boolean).join(" ");
  const form = medication.form && medication.form !== "other" ? MEDICATION_FORMS[medication.form] || medication.form : "";
  return [dose, form, medication.frequency].filter(Boolean).join(" · ");
}

export default function VisitPrepPage() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const profileRef = useRef(profileId);
  profileRef.current = profileId;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState(null);
  const [documentsRequested, setDocumentsRequested] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [visitNotes, setVisitNotes] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!profileId) return undefined;
    let current = true;
    setData(null);
    setError("");
    setDocuments(null);
    setDocumentsRequested(false);
    setDocumentsError("");
    setSelectedDocumentIds([]);
    setVisitNotes("");
    setNotesDraft("");
    setEditing(false);
    setNotice("");
    Promise.all([getHealthProfile(profileId), getSymptomsForProfile(profileId)])
      .then(([health, symptoms]) => { if (current) setData({ health, symptoms }); })
      .catch(() => { if (current) setError("We couldn't prepare this summary. Please check your connection and try again."); });
    return () => { current = false; };
  }, [profileId]);

  const name = activeProfile?.fullName || "This profile";
  const facts = data?.health.facts || [];
  const background = facts.filter((fact) => ["condition", "allergy", "pregnancy", "smoking", "bloodType"].includes(fact.category));
  const basics = facts.filter((fact) => ["sex", "height", "weight"].includes(fact.category));
  const medications = data?.health.medications || [];
  const symptomRecords = (data?.symptoms || []).slice(0, SUMMARY_LIMIT);
  const selectedDocuments = (documents || []).filter((document) => selectedDocumentIds.includes(document.id));

  function toggleDocument(id) {
    setSelectedDocumentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function loadDocuments() {
    if (!profileId) return;
    const requestedProfile = profileId;
    setDocumentsRequested(true);
    setDocuments(null);
    setDocumentsError("");
    getMedicalDocuments(requestedProfile)
      .then((result) => { if (profileRef.current === requestedProfile) setDocuments(result.documents || []); })
      .catch(() => {
        if (profileRef.current === requestedProfile) {
          setDocuments([]);
          setDocumentsError("Uploaded documents couldn't be loaded. Try again or open Medical documents.");
        }
      });
  }

  function startEditing() {
    setNotesDraft(visitNotes);
    setEditing(true);
    setNotice("");
  }

  function saveEdits(event) {
    event.preventDefault();
    setVisitNotes(notesDraft.trim());
    setEditing(false);
    setNotice("Your changes are included in this visit sheet and its printout.");
  }

  return (
    <PageLayout title="Visit preparation" header={<ProfileHeader showPicture={false} />}>
      <PageTitle lead="A structured summary of saved symptom checks and confirmed health information." >Visit preparation</PageTitle>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {!data && !error && <HeartbeatLoader label="Preparing your summary..." />}
      {data && (
        <>
        <div className="visit-prep__actions">
          {!editing && <Button variant="secondary" onClick={startEditing}>Edit visit sheet</Button>}
          <Button variant="secondary" disabled={editing} onClick={() => window.print()}>Print or save as PDF</Button>
        </div>
        {notice && <p className="visit-prep__notice" role="status">{notice}</p>}
        {editing && <Card className="section visit-prep__editor" aria-labelledby="visit-prep-editor-heading">
          <h2 id="visit-prep-editor-heading">Review and edit your visit sheet</h2>
          <p className="text-muted">Add or correct anything you want your clinician to know. Your changes stay on this page and are included when you print; reloading clears them.</p>
          <form className="form" onSubmit={saveEdits}>
            <label className="field__label" htmlFor="visit-prep-notes">Notes for your clinician</label>
            <textarea id="visit-prep-notes" className="input" rows="6" maxLength="5000" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="What would you like to discuss? Is anything missing or incorrect?" />
            <div className="visit-prep__edit-actions">
              <Button type="submit">Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => { setEditing(false); setNotesDraft(visitNotes); }}>Cancel</Button>
            </div>
          </form>
        </Card>}
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

          <Card className="section" aria-labelledby="visit-prep-medications-heading">
            <h2 id="visit-prep-medications-heading">Current medications</h2>
            {medications.length ? <ul aria-label="Current medications">
              {medications.map((medication) => (
                <li key={medication.id}>
                  <strong>{medication.name}</strong>
                  {medicationDetails(medication) && ` · ${medicationDetails(medication)}`}
                </li>
              ))}
            </ul> : <p className="text-muted">No active medications recorded.</p>}
          </Card>

          <Card className="section visit-prep__document-picker" aria-labelledby="visit-prep-documents-heading">
            <h2 id="visit-prep-documents-heading">Documents for this visit</h2>
            <p className="text-muted">Select relevant uploaded records to include as references on this sheet.</p>
            {!documentsRequested ? <Button variant="secondary" onClick={loadDocuments}>Choose uploaded documents</Button> : <>
              {documentsError && <Alert tone="danger" role="alert">{documentsError} <a href="/medical-documents">Open medical documents</a></Alert>}
              {documents === null ? <HeartbeatLoader label="Loading uploaded documents..." /> : documentsError ? <Button variant="secondary" onClick={loadDocuments}>Retry loading documents</Button> : documents.length ? <ul className="visit-prep__document-options">
              {documents.map((document) => (
                <li key={document.id}>
                  <label>
                    <input type="checkbox" checked={selectedDocumentIds.includes(document.id)} onChange={() => toggleDocument(document.id)} />
                    <span><strong>{document.filename}</strong><span className="text-muted">{DOCUMENT_TYPES[document.documentType] || "Other"}{document.documentDate ? ` · ${formatDate(document.documentDate)}` : " · Date not provided"}</span></span>
                  </label>
                </li>
              ))}
              </ul> : <p className="text-muted">No uploaded documents for this profile. <a href="/medical-documents">Upload a medical document</a>.</p>}
            </>}
          </Card>

          {selectedDocuments.length > 0 && <Card className="section visit-prep__attached" aria-labelledby="visit-prep-attached-heading">
            <h2 id="visit-prep-attached-heading">Documents attached to this visit</h2>
            <ul>{selectedDocuments.map((document) => <li key={document.id}>
              <strong>{document.filename}</strong> · {DOCUMENT_TYPES[document.documentType] || "Other"}{document.documentDate ? ` · ${formatDate(document.documentDate)}` : " · Date not provided"} {" "}
              <a href={medicalDocumentDownloadUrl(profileId, document.id)}>Download</a>
            </li>)}</ul>
            <p className="text-muted">Download these files separately to share the original documents with your clinician.</p>
          </Card>}

          {visitNotes && <Card className="section visit-prep__notes" aria-labelledby="visit-prep-notes-heading">
            <h2 id="visit-prep-notes-heading">Notes for your clinician</h2>
            <p>{visitNotes}</p>
          </Card>}

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

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
import { exportVisitPrep } from "../lib/visitPrepExport";
import { exportVisitPrepPdf } from "../lib/visitPrepPdf";
import { getVisitPrep, saveVisitPrep } from "../lib/visitPrepApi";

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
  const [overrides, setOverrides] = useState({});
  const [sectionDrafts, setSectionDrafts] = useState({});
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);

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
    setOverrides({});
    setSectionDrafts({});
    Promise.all([getHealthProfile(profileId), getSymptomsForProfile(profileId), getVisitPrep(profileId)])
      .then(async ([health, symptoms, sheet]) => {
        let savedDocuments = null;
        if (sheet.documentIds.length) savedDocuments = await getMedicalDocuments(profileId);
        if (current) {
          setOverrides(sheet.overrides || {});
          setVisitNotes(sheet.notes || "");
          setSelectedDocumentIds(sheet.documentIds || []);
          if (savedDocuments) { setDocuments(savedDocuments.documents); setDocumentsRequested(true); }
          setData({ health, symptoms });
        }
      })
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
  const editableSections = [
    ["background", "Patient and health background"],
    ["medications", "Current medications"],
    ["symptoms", "Recent symptom checks"],
  ];

  function sectionText(key) {
    const section = sheetRef.current?.querySelector(`[data-summary-section="${key}"]`)?.cloneNode(true);
    if (!section) return "";
    section.querySelectorAll("p, li, h3").forEach((element) => element.append("\n"));
    return section.textContent.trim();
  }

  async function exportSheet() {
    setExporting(true);
    setError("");
    try {
      await exportVisitPrep({ name, sections: [...editableSections.map(([key, title]) => [title, sectionText(key)]), ...(visitNotes ? [["Notes for your clinician", visitNotes]] : [])], documents: selectedDocuments, downloadUrl: (id) => medicalDocumentDownloadUrl(profileId, id) });
    } catch (exportError) {
      setError(exportError.message || "We couldn't export this visit sheet. Please try again.");
    } finally { setExporting(false); }
  }

  async function printSheet() {
    setExporting(true); setError("");
    try {
      await exportVisitPrepPdf({ name, sections: [...editableSections.map(([key, title]) => [title, sectionText(key)]), ...(visitNotes ? [["Notes for your clinician", visitNotes]] : [])], documents: selectedDocuments, downloadUrl: (id) => medicalDocumentDownloadUrl(profileId, id) });
      if (profileRef.current === profileId) setNotice("PDF downloaded with the selected documents. Open it to print or share.");
    } catch (failure) { if (profileRef.current === profileId) setError(failure.message || "Could not create the PDF."); }
    finally { setExporting(false); }
  }

  async function toggleDocument(id) {
    const ids = selectedDocumentIds.includes(id) ? selectedDocumentIds.filter((item) => item !== id) : [...selectedDocumentIds, id];
    setSaving(true); setError("");
    try {
      await saveVisitPrep(profileId, { overrides, notes: visitNotes, documentIds: ids });
      if (profileRef.current === profileId) setSelectedDocumentIds(ids);
    } catch (failure) { if (profileRef.current === profileId) setError(failure.message); }
    finally { setSaving(false); }
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
    setSectionDrafts(Object.fromEntries(editableSections.map(([key]) => [key, sectionText(key)])));
    setEditing(true);
    setNotice("");
  }

  async function saveEdits(event) {
    event.preventDefault();
    setSaving(true); setError("");
    const changes = { ...overrides };
    for (const [key, value] of Object.entries(sectionDrafts)) {
      if (value !== sectionText(key)) changes[key] = value;
    }
    try {
      await saveVisitPrep(profileId, { overrides: changes, notes: notesDraft.trim(), documentIds: selectedDocumentIds });
      if (profileRef.current !== profileId) return;
      setVisitNotes(notesDraft.trim()); setOverrides(changes); setEditing(false);
      setNotice("Your changes are saved and included in this visit sheet and its printout.");
    } catch (failure) { if (profileRef.current === profileId) setError(failure.message); }
    finally { setSaving(false); }
  }

  return (
    <PageLayout title="Visit preparation" header={<ProfileHeader showPicture={false} />}>
      <PageTitle lead="A structured summary of saved symptom checks and confirmed health information." >Visit preparation</PageTitle>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {!data && !error && <HeartbeatLoader label="Preparing your summary..." />}
      {data && (
        <>
        <div className="visit-prep__actions">
          {!editing && <Button variant="secondary" disabled={exporting || saving} onClick={startEditing}>Edit visit sheet</Button>}
          <Button variant="secondary" disabled={editing || exporting || saving} onClick={printSheet}>Print or save as PDF</Button>
          <Button variant="secondary" disabled={editing || exporting || saving} onClick={exportSheet}>{exporting ? "Exporting..." : "Export sheet with attachments"}</Button>
        </div>
        {notice && <p className="visit-prep__notice" role="status">{notice}</p>}
        {editing && <Card className="section visit-prep__editor" aria-labelledby="visit-prep-editor-heading">
          <h2 id="visit-prep-editor-heading">Review and edit your visit sheet</h2>
          <p className="text-muted">Add or correct anything you want your clinician to know. Saved changes and document selections are kept for this profile when you return.</p>
          <form className="form" onSubmit={saveEdits}><fieldset disabled={saving} style={{ border: 0, padding: 0, minWidth: 0 }}>
            {editableSections.map(([key, title]) => <div key={key}>
              <label className="field__label" htmlFor={`visit-prep-edit-${key}`}>{title}</label>
              <textarea id={`visit-prep-edit-${key}`} className="input" rows="6" maxLength="20000" value={sectionDrafts[key] || ""} onChange={(event) => setSectionDrafts((current) => ({ ...current, [key]: event.target.value }))} />
            </div>)}
            <label className="field__label" htmlFor="visit-prep-notes">Notes for your clinician</label>
            <textarea id="visit-prep-notes" className="input" rows="6" maxLength="5000" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="What would you like to discuss? Is anything missing or incorrect?" />
            <div className="visit-prep__edit-actions">
              <Button type="submit">Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => { setEditing(false); setNotesDraft(visitNotes); }}>Cancel</Button>
            </div>
          </fieldset></form>
        </Card>}
        <div className="stack visit-prep" ref={sheetRef}>
          <Card className="section" aria-labelledby="visit-prep-person-heading">
            <h2 id="visit-prep-person-heading">Patient and health background</h2>
            <div data-summary-section="background" className="visit-prep__summary-text">
            {overrides.background !== undefined ? <p>{overrides.background}</p> : <>
            <p><strong>Name:</strong> {name}</p>
            {data.health.age && <p><strong>Age:</strong> {data.health.age.text}</p>}
            {data.health.dateOfBirth && <p><strong>Date of birth:</strong> {formatDate(data.health.dateOfBirth)}</p>}
            <h3>Relevant health information</h3>
            {background.length ? <ul>{background.map((fact) => <li key={fact.id}><strong>{CATEGORY_LABELS[fact.category]}:</strong> {summaryFactText(fact)}</li>)}</ul> : <p className="text-muted">No confirmed conditions, allergies or other background information recorded.</p>}
            {basics.length > 0 && <>
              <h3>Other recorded details</h3>
              <ul>{basics.map((fact) => <li key={fact.id}><strong>{CATEGORY_LABELS[fact.category]}:</strong> {factText(fact)}</li>)}</ul>
            </>}
            </>}
            </div>
          </Card>

          <Card className="section" aria-labelledby="visit-prep-medications-heading">
            <h2 id="visit-prep-medications-heading">Current medications</h2>
            <div data-summary-section="medications" className="visit-prep__summary-text">
            {overrides.medications !== undefined ? <p>{overrides.medications}</p> : <>
            {medications.length ? <ul aria-label="Current medications">
              {medications.map((medication) => (
                <li key={medication.id}>
                  <strong>{medication.name}</strong>
                  {medicationDetails(medication) && ` · ${medicationDetails(medication)}`}
                </li>
              ))}
            </ul> : <p className="text-muted">No active medications recorded.</p>}
            </>}
            </div>
          </Card>

          <Card className="section visit-prep__document-picker" aria-labelledby="visit-prep-documents-heading">
            <h2 id="visit-prep-documents-heading">Documents for this visit</h2>
            <p className="text-muted">Select relevant uploaded records to include with this sheet. Selections are saved automatically.</p>
            {!documentsRequested ? <Button variant="secondary" onClick={loadDocuments}>Choose uploaded documents</Button> : <>
              {documentsError && <Alert tone="danger" role="alert">{documentsError} <a href="/medical-documents">Open medical documents</a></Alert>}
              {documents === null ? <HeartbeatLoader label="Loading uploaded documents..." /> : documentsError ? <Button variant="secondary" onClick={loadDocuments}>Retry loading documents</Button> : documents.length ? <ul className="visit-prep__document-options">
              {documents.map((document) => (
                <li key={document.id}>
                  <label>
                    <input type="checkbox" disabled={saving || exporting || editing} checked={selectedDocumentIds.includes(document.id)} onChange={() => toggleDocument(document.id)} />
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
            <p className="text-muted">Print or save as PDF downloads one PDF with selected PDF pages and images appended. Open the downloaded file to print. For other file formats, use Export sheet with attachments to include the original files.</p>
          </Card>}

          {visitNotes && <Card className="section visit-prep__notes" aria-labelledby="visit-prep-notes-heading">
            <h2 id="visit-prep-notes-heading">Notes for your clinician</h2>
            <p>{visitNotes}</p>
          </Card>}

          <Card className="section" aria-labelledby="visit-prep-symptoms-heading">
            <h2 id="visit-prep-symptoms-heading">Recent symptom checks</h2>
            <div data-summary-section="symptoms" className="visit-prep__summary-text">
            {overrides.symptoms !== undefined ? <p>{overrides.symptoms}</p> : <>
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
            </>}
            </div>
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

import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import { HeartbeatLoader } from "./ui/Heartbeat";
import { deleteProfileDocument, getProfileCoverage, profileDocumentDownloadUrl, updateProfileCoverage, uploadProfileDocument } from "../lib/profileCoverageApi";

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const EMPTY = { hasInsurance: false, hasNssf: false, patientId: null, insuranceCard: null, nssfDocument: null };
const fileToPayload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("We couldn't read this document. Please choose it again."));
  reader.onload = () => resolve({ filename: file.name, mimeType: file.type, data: String(reader.result).split(",")[1] });
  reader.readAsDataURL(file);
});
const prettySize = (size) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;

function DocumentUpload({ profileId, kind, label, document, onChanged }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.size || file.size > MAX_SIZE || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setError("Choose a PDF, JPG or PNG document up to 5 MB."); return;
    }
    setBusy(true); setError("");
    try { onChanged(await uploadProfileDocument(profileId, kind, await fileToPayload(file))); }
    catch (uploadError) { setError(uploadError.message || "We couldn't upload this document."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Remove the saved ${label.toLowerCase()}?`)) return;
    setBusy(true); setError("");
    try { onChanged(await deleteProfileDocument(profileId, kind)); }
    catch (deleteError) { setError(deleteError.message || "We couldn't remove this document."); }
    finally { setBusy(false); }
  }
  return <div className="section">
    <h3>{label}</h3>
    {document ? <>
      <p><strong>{document.filename}</strong> <span className="text-muted">({prettySize(document.size)})</span></p>
      <div className="form-actions">
        <a className="button button--secondary" href={profileDocumentDownloadUrl(profileId, kind)}>Download</a>
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>Replace</Button>
        <Button variant="danger" onClick={remove} disabled={busy}>Remove</Button>
      </div>
    </> : <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>{busy ? "Uploading..." : `Upload ${label.toLowerCase()}`}</Button>}
    <input ref={input} className="visually-hidden" type="file" accept={ACCEPT} onChange={upload} aria-label={`Choose ${label.toLowerCase()}`} />
    {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
  </div>;
}

export default function ProfileCoverage({ profile }) {
  const profileId = profile?.id;
  const [coverage, setCoverage] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!profileId) return;
    let current = true;
    setCoverage(null); setError("");
    getProfileCoverage(profileId).then((data) => { if (current) setCoverage({ ...EMPTY, ...data }); })
      .catch(() => { if (current) setError("Could not load identification and coverage details."); });
    return () => { current = false; };
  }, [profileId]);

  async function toggle(field, checked) {
    setSaving(true); setError("");
    try { setCoverage(await updateProfileCoverage(profileId, { hasInsurance: field === "hasInsurance" ? checked : coverage.hasInsurance, hasNssf: field === "hasNssf" ? checked : coverage.hasNssf })); }
    catch (saveError) { setError(saveError.message || "Could not save coverage details."); }
    finally { setSaving(false); }
  }

  return <Card className="section" aria-labelledby="coverage-heading">
    <h2 id="coverage-heading">Identification and coverage</h2>
    <p className="text-muted">Private administrative documents for {profile?.isSelf ? "your profile" : profile?.fullName}. They are not included with medical documents or visit preparation.</p>
    {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
    {!coverage ? !error && <HeartbeatLoader label="Loading coverage details..." /> : <>
      <DocumentUpload profileId={profileId} kind="patient_id" label="Patient ID" document={coverage.patientId} onChanged={setCoverage} />
      <label className="checkbox-row"><input type="checkbox" checked={coverage.hasInsurance} disabled={saving} onChange={(event) => toggle("hasInsurance", event.target.checked)} /> This patient has medical insurance</label>
      {coverage.hasInsurance && <DocumentUpload profileId={profileId} kind="insurance_card" label="Medical insurance card" document={coverage.insuranceCard} onChanged={setCoverage} />}
      <label className="checkbox-row"><input type="checkbox" checked={coverage.hasNssf} disabled={saving} onChange={(event) => toggle("hasNssf", event.target.checked)} /> This patient has NSSF coverage</label>
      {coverage.hasNssf && <DocumentUpload profileId={profileId} kind="nssf" label="NSSF document" document={coverage.nssfDocument} onChanged={setCoverage} />}
    </>}
  </Card>;
}

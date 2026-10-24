import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getMedicalDocuments, medicalDocumentDownloadUrl, uploadMedicalDocument } from "../lib/medicalDocumentApi";

const MAX_SIZE = 10 * 1024 * 1024;
const prettySize = (size) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
const prettyDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}. Please choose it again.`));
    reader.onload = () => resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", data: String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  });
}

export default function MedicalDocumentsPage() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const inputRef = useRef(null);
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  useEffect(() => {
    if (!profileId) return;
    const requested = profileId;
    setDocuments(null);
    setError("");
    getMedicalDocuments(requested)
      .then((data) => { if (profileRef.current === requested) setDocuments(data.documents); })
      .catch(() => { if (profileRef.current === requested) setError("We couldn't load this profile's documents. Please refresh the page."); });
  }, [profileId]);

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const targetProfileId = profileId;
    if (!targetProfileId) return;
    if (files.length > 10) { setError("Choose up to 10 files at a time."); return; }
    for (const file of files) {
      if (!file.size) { setError(`${file.name} is empty.`); return; }
      if (file.size > MAX_SIZE) { setError(`${file.name} is larger than 10 MB.`); return; }
    }
    setBusy(true); setError(""); setNotice(""); setUploadProgress("");
    let uploaded = 0;
    try {
      for (const file of files) {
        const payload = await fileToPayload(file);
        const result = await uploadMedicalDocument(targetProfileId, payload);
        uploaded += 1;
        if (profileRef.current === targetProfileId) {
          setDocuments((current) => [result.document, ...(current || [])]);
          setUploadProgress(`${uploaded} of ${files.length} uploaded`);
        }
      }
      if (profileRef.current === targetProfileId) {
        setNotice(files.length === 1 ? "Document uploaded." : `${files.length} documents uploaded.`);
        setUploadProgress("");
      }
    } catch (uploadError) {
      if (profileRef.current === targetProfileId) {
        setError(uploadError.message || "We couldn't upload the selected documents. Please try again.");
        if (uploaded) setNotice(`${uploaded} of ${files.length} documents uploaded before the upload stopped.`);
      }
    } finally { setBusy(false); setUploadProgress(""); }
  }

  return (
    <PageLayout title="Medical documents" header={<ProfileHeader showPicture={false} />}>
      <PageTitle>Medical documents</PageTitle>
      <Card className="medical-documents section" aria-labelledby="documents-heading">
        <div className="medical-documents__header">
          <div>
            <h2 id="documents-heading">{activeProfile?.isSelf ? "Your documents" : `${activeProfile?.fullName || "Profile"}'s documents`}</h2>
            <p className="text-muted">Store X-rays, lab results and letters for this profile. Any file type up to 10 MB each.</p>
          </div>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy || !profileId} aria-label="Add medical documents">
            <span className="medical-documents__plus" aria-hidden="true">+</span> Add documents
          </Button>
          <input ref={inputRef} className="visually-hidden" type="file" multiple onChange={handleFiles} aria-label="Choose medical documents" />
        </div>
        {error && <Alert tone="danger" role="alert">{error}</Alert>}
        {notice && <p role="status" className="text-muted">{notice}</p>}
        {busy && <HeartbeatLoader label={uploadProgress ? `Uploading documents: ${uploadProgress}...` : "Uploading documents..."} />}
        {documents === null ? <HeartbeatLoader label="Loading documents..." /> : documents.length ? (
          <ul className="medical-documents__list">
            {documents.map((document) => (
              <li key={document.id}>
                <div><strong>{document.filename}</strong><p className="text-muted">{prettyDate(document.uploadedAt)} · {prettySize(document.size)}</p></div>
                <a href={medicalDocumentDownloadUrl(profileId, document.id)} className="button button--secondary">Download</a>
              </li>
            ))}
          </ul>
        ) : <p className="medical-documents__empty">No documents added yet. Use <strong>Add documents</strong> to upload medical files for this profile.</p>}
      </Card>
      <p className="section"><a href="/dashboard">Back to dashboard</a></p>
    </PageLayout>
  );
}

MedicalDocumentsPage.requireSignIn = true;

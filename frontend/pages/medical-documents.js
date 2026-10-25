import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { deleteMedicalDocument, getMedicalDocuments, medicalDocumentDownloadUrl, updateMedicalDocumentMetadata, uploadMedicalDocument } from "../lib/medicalDocumentApi";

const MAX_SIZE = 10 * 1024 * 1024;
const DOCUMENT_TYPES = [["imaging", "Imaging (X-ray or scan)"], ["lab", "Lab result"], ["letter", "Letter"], ["other", "Other"]];
const prettySize = (size) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
const prettyDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
const dateLabel = (value) => value ? prettyDate(`${value}T00:00:00`) : "Date not provided";

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}. Please choose it again.`));
    reader.onload = () => resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", data: String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  });
}

function DocumentMetadataEditor({ profileId, document, onSaved }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(document.documentType || "other");
  const [date, setDate] = useState(document.documentDate || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const updated = await updateMedicalDocumentMetadata(profileId, document.id, { documentType: type, documentDate: date });
      onSaved(updated); setNotice("Document details saved."); setOpen(false);
    } catch (saveError) { setError(saveError.message || "We couldn't save these document details."); }
    finally { setBusy(false); }
  }
  return (
    <div className="medical-documents__edit">
      <Button variant="secondary" disabled={busy} aria-expanded={open} aria-controls={open ? `document-editor-${document.id}` : undefined} onClick={() => {
        setType(document.documentType || "other"); setDate(document.documentDate || "");
        setError(""); setNotice(""); setOpen(!open);
      }}>Edit type or date</Button>
      {open && <form id={`document-editor-${document.id}`} onSubmit={save} className="form">
        <div className="medical-documents__edit-field">
        <label className="field__label" htmlFor={`edit-document-type-${document.id}`}>Document type</label>
        <select id={`edit-document-type-${document.id}`} className="input" value={type} onChange={(event) => setType(event.target.value)} disabled={busy}>
          {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        </div>
        <div className="medical-documents__edit-field">
        <label className="field__label" htmlFor={`edit-document-date-${document.id}`}>Document date</label>
        <input id={`edit-document-date-${document.id}`} className="input" type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} disabled={busy} />
        </div>
        <div className="medical-documents__edit-actions">
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save details"}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
        </div>
        {error && <Alert tone="danger" role="alert">{error}</Alert>}
      </form>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

export default function MedicalDocumentsPage() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const inputRef = useRef(null);
  const profileRef = useRef(profileId);
  profileRef.current = profileId;
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [documentDate, setDocumentDate] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!profileId) return undefined;
    const requested = profileId;
    setDocuments(null); setError("");
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
        const result = await uploadMedicalDocument(targetProfileId, payload, { documentType, documentDate });
        uploaded += 1;
        if (profileRef.current === targetProfileId) {
          setDocuments((current) => [result.document, ...(current || [])]);
          setUploadProgress(`${uploaded} of ${files.length} uploaded`);
        }
      }
      if (profileRef.current === targetProfileId) setNotice(files.length === 1 ? "Document uploaded." : `${files.length} documents uploaded.`);
    } catch (uploadError) {
      if (profileRef.current === targetProfileId) {
        setError(uploadError.message || "We couldn't upload the selected documents. Please try again.");
        if (uploaded) setNotice(`${uploaded} of ${files.length} documents uploaded before the upload stopped.`);
      }
    } finally { setBusy(false); setUploadProgress(""); }
  }

  const visibleDocuments = (documents || []).filter((document) => {
    const type = document.documentType || "other";
    const date = document.documentDate || "";
    return (!filterType || type === filterType) && (!dateFrom || (date && date >= dateFrom)) && (!dateTo || (date && date <= dateTo));
  });
  const handleMetadataSaved = (updated) => setDocuments((current) => current?.map((document) => document.id === updated.id ? updated : document) || []);

  async function handleDelete(document) {
    if (!window.confirm(`Delete ${document.filename}? This cannot be undone.`)) return;
    const targetProfileId = profileId;
    setDeletingId(document.id); setError(""); setNotice("");
    try {
      await deleteMedicalDocument(targetProfileId, document.id);
      if (profileRef.current === targetProfileId) {
        setDocuments((current) => current?.filter((item) => item.id !== document.id) || []);
        setNotice(`${document.filename} deleted.`);
      }
    } catch (deleteError) {
      if (profileRef.current === targetProfileId) setError(deleteError.message || "We couldn't delete this document. Please try again.");
    } finally { setDeletingId(""); }
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
          <div className="medical-documents__metadata">
            <label className="field__label" htmlFor="medical-document-type">Document type</label>
            <select id="medical-document-type" className="input" value={documentType} onChange={(event) => setDocumentType(event.target.value)} disabled={busy}>
              {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="field__label" htmlFor="medical-document-date">Document date (if known)</label>
            <input id="medical-document-date" className="input" type="date" min="1900-01-01" max="2100-12-31" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} disabled={busy} />
            <p className="text-muted">These details will be used for every file in this upload.</p>
          </div>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy || !profileId} aria-label="Add medical documents"><span className="medical-documents__plus" aria-hidden="true">+</span> Add documents</Button>
          <input ref={inputRef} className="visually-hidden" type="file" multiple onChange={handleFiles} aria-label="Choose medical documents" />
        </div>
        {error && <Alert tone="danger" role="alert">{error}</Alert>}
        {notice && <p role="status" className="text-muted">{notice}</p>}
        {busy && <HeartbeatLoader label={uploadProgress ? `Uploading documents: ${uploadProgress}...` : "Uploading documents..."} />}
        {documents === null ? <HeartbeatLoader label="Loading documents..." /> : documents.length ? <>
          <div className="medical-documents__filters" aria-label="Filter documents">
            <label className="field__label" htmlFor="filter-document-type">Filter by type</label>
            <select id="filter-document-type" className="input" value={filterType} onChange={(event) => setFilterType(event.target.value)}>
              <option value="">All types</option>
              {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="field__label" htmlFor="filter-document-date-from">Document date from</label>
            <input id="filter-document-date-from" className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <label className="field__label" htmlFor="filter-document-date-to">Document date to</label>
            <input id="filter-document-date-to" className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          {visibleDocuments.length ? <ul className="medical-documents__list">{visibleDocuments.map((document) => (
            <li key={document.id}>
              <div><strong>{document.filename}</strong><p className="text-muted">Uploaded {prettyDate(document.uploadedAt)} · {prettySize(document.size)}</p></div>
              <p>{DOCUMENT_TYPES.find(([value]) => value === (document.documentType || "other"))?.[1] || "Other"} · {dateLabel(document.documentDate)}</p>
              <a href={medicalDocumentDownloadUrl(profileId, document.id)} className="button button--secondary">Download</a>
              <Button type="button" variant="secondary" disabled={deletingId === document.id} onClick={() => handleDelete(document)}>{deletingId === document.id ? "Deleting..." : "Delete"}</Button>
              <DocumentMetadataEditor profileId={profileId} document={document} onSaved={handleMetadataSaved} />
            </li>
          ))}</ul> : <p className="medical-documents__empty">No documents match these filters. Clear the type and date filters to see all documents.</p>}
        </> : <p className="medical-documents__empty">No documents added yet. Use <strong>Add documents</strong> to upload medical files for this profile.</p>}
      </Card>
      <p className="section"><a href="/dashboard">Back to dashboard</a></p>
    </PageLayout>
  );
}

MedicalDocumentsPage.requireSignIn = true;

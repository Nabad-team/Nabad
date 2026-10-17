import { useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { request } from "../lib/api";
import { useActiveProfile } from "../context/ActiveProfileContext";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "csv", "jpg", "jpeg", "png", "webp"]);
const EXTENSION_MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain", csv: "text/csv", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const URGENCY_LABELS = {
  emergency: "Get emergency medical help now",
  urgent: "Contact a clinician today",
  soon: "Arrange a prompt clinician review",
  routine: "Review this with the ordering clinician",
  unclear: "Ask a clinician to review this report",
};

function ResultsIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M13 5h15l10 10v25H13a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" />
      <path d="M28 5v10h10M16 23h12M16 29h9" />
      <circle cx="32" cy="32" r="7" />
      <path d="m37 37 5 5" />
    </svg>
  );
}

export default function TestResultsPage() {
  const { activeProfile } = useActiveProfile();
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    setResult(null);
    setMessages([]);
    setError("");
    setConsent(false);
    if (!selected) { setFile(null); return; }
    const extension = selected.name.split(".").pop()?.toLowerCase();
    const mimeType = IMAGE_TYPES.has(selected.type) || selected.type === "application/pdf" ? selected.type : EXTENSION_MIME[extension];
    if (!extension || !ACCEPTED_EXTENSIONS.has(extension) || !mimeType) {
      setFile(null);
      setError("Choose a PDF, DOCX, TXT, CSV, or JPG, PNG, or WebP report file.");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setError("Choose a file under 3 MB.");
      event.target.value = "";
      return;
    }
    setFile(selected);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!question.trim() || !consent || busy) return;
    const currentQuestion = question.trim();
    const previousMessages = messages.slice(-8);
    setError("");
    setBusy(true);
    try {
      let upload = null;
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        const extension = file.name.split(".").pop()?.toLowerCase();
        const mimeType = IMAGE_TYPES.has(file.type) || file.type === "application/pdf" ? file.type : EXTENSION_MIME[extension];
        upload = { mimeType, extension, data: btoa(binary) };
      }
      if (file && !result) {
        const analysis = await request("/reports/analyze", {
          method: "POST",
          body: JSON.stringify({ file: upload, question: currentQuestion, consent: true }),
        });
        setResult(analysis);
        const explanation = [analysis.summary, ...analysis.findings.map((finding) => `${finding.name}: ${finding.explanation} Next step: ${finding.followUp}`), analysis.nextStep].join("\n").slice(0, 1200);
        setMessages([...messages, { role: "user", content: currentQuestion }, { role: "assistant", content: explanation, disclaimer: analysis.disclaimer }].slice(-20));
      } else {
        const answer = await request("/reports/chat", {
          method: "POST",
          body: JSON.stringify({ file: upload, question: currentQuestion, history: previousMessages, consent: true }),
        });
        setMessages([...messages, { role: "user", content: currentQuestion }, { role: "assistant", content: answer.answer, evidence: answer.evidence, disclaimer: answer.disclaimer }].slice(-20));
      }
      setQuestion("");
    } catch (err) {
      setError(err.message || "The report could not be safely analyzed. Please try again or ask your clinician.");
    } finally {
      setBusy(false);
    }
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setMessages([]);
    setError("");
    setConsent(false);
    const input = document.getElementById("test-report-file");
    if (input) input.value = "";
  }

  return (
    <PageLayout
      title="Health assistant"
      header={<ProfileHeader showPicture={false} />}
    >
      <PageTitle lead="Ask health questions, or attach a written test report and ask about its findings.">
        Health assistant
      </PageTitle>

      <section className="results-intro" aria-labelledby="results-status">
        <div className="results-intro__icon"><ResultsIcon /></div>
        <h2 id="results-status">Ask a health question</h2>
        <p>
          {activeProfile?.fullName ? <>For <strong>{activeProfile.fullName}</strong>. </> : null}
          Ask a general health question or attach a PDF, Word document, text or CSV file, or a clear photo of a written report. You can ask follow-up questions in the same conversation.
        </p>
        <p>
          This tool cannot interpret raw MRI/CT scan images or DICOM files. It is not a diagnostic service,
          cannot confirm that results are safe, and must not be used to delay care.
        </p>
      </section>

      <form className="report-form" onSubmit={sendMessage}>
        <div className="field">
          <label className="field__label" htmlFor="test-report-file">Attach a test result <span className="text-muted">(optional)</span></label>
          <input
            id="test-report-file"
            className="input report-form__file"
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,image/jpeg,image/png,image/webp,.pdf,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp"
            onChange={selectFile}
            aria-describedby="report-file-help"
            disabled={busy}
          />
          <p className="field__hint" id="report-file-help">PDF, DOCX, TXT, CSV, JPG, PNG, or WebP. Maximum 3 MB. Scanned PDFs and image-only Word files may not contain readable text.</p>
        </div>

        {file && <div className="report-form__selected" role="status"><span>{file.name}</span><Button type="button" variant="secondary" size="small" onClick={clearFile} disabled={busy}>Remove file</Button></div>}

        <div className="field">
          <label className="field__label" htmlFor="report-question">Your question</label>
          <textarea
            id="report-question"
            className="input report-form__question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1200}
            rows={3}
            placeholder="For example: What does this flagged result mean? Or ask a general health question."
            required
            disabled={busy}
          />
        </div>

        <label className="check report-form__consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy} />
          I understand my question and any attached report will be sent to Nabad's configured AI provider and may contain sensitive health information.
        </label>

        {error && <Alert tone="danger" role="alert">{error}</Alert>}

        <div className="report-form__actions">
          <Button type="submit" disabled={!question.trim() || !consent || busy}>{busy ? "Thinking..." : "Send question"}</Button>
          <Button href="/symptoms" variant="secondary">Check symptoms</Button>
          {messages.length > 0 && <Button type="button" variant="secondary" onClick={() => { setMessages([]); setResult(null); setError(""); }} disabled={busy}>New conversation</Button>}
        </div>

        <p className="report-privacy-note">
          Messages and files are processed for each request and are not saved by Nabad. If a file is attached, it is sent again with each follow-up. Upload only if you are comfortable sharing it.
        </p>
      </form>

      {messages.length > 0 && (
        <section className="report-chat" aria-label="Conversation" aria-live="polite">
          {messages.map((message, index) => (
            <article className={`report-chat__message report-chat__message--${message.role}`} key={`${message.role}-${index}`}>
              <h3>{message.role === "user" ? "You" : "Nabad assistant"}</h3>
              <p>{message.content}</p>
              {message.evidence?.length > 0 && <p className="report-chat__evidence"><strong>From the report:</strong> {message.evidence.join(" / ")}</p>}
              {message.disclaimer && <p className="report-chat__disclaimer">{message.disclaimer}</p>}
            </article>
          ))}
        </section>
      )}

      {result && (
        <section className={`report-result report-result--${result.urgency}`} aria-labelledby="report-result-heading" aria-live="polite">
          <p className="report-result__eyebrow">AI explanation · not reviewed by a clinician</p>
          <h2 id="report-result-heading">{URGENCY_LABELS[result.urgency] || URGENCY_LABELS.unclear}</h2>
          <p>{result.summary}</p>

          {result.findings.length > 0 ? (
            <div className="report-findings">
              <h3>Important findings</h3>
              {result.findings.map((finding, index) => (
                <article className="report-finding" key={`${finding.name}-${index}`}>
                  <h4>{finding.name}</h4>
                  <p><strong>In the report:</strong> {finding.sourceQuote}</p>
                  <p><strong>Reported result:</strong> {finding.result}</p>
                  <p><strong>In simpler words:</strong> {finding.explanation}</p>
                  {finding.reference && <p><strong>Reference:</strong> {finding.reference}</p>}
                  <p><strong>Next step:</strong> {finding.followUp}</p>
                </article>
              ))}
            </div>
          ) : <p>No clearly marked abnormal findings were identified in what the AI could read. This does not confirm that everything is normal.</p>}

          <h3>What to do next</h3>
          <p>{result.nextStep}</p>
          {result.uncertainties.length > 0 && (
            <div>
              <h3>Limits of this explanation</h3>
              <ul>{result.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </div>
          )}
          {result.urgency === "emergency" && <p className="report-result__emergency"><strong>If you may be in immediate danger, contact local emergency services now.</strong></p>}
          <p className="report-result__disclaimer">{result.disclaimer}</p>
        </section>
      )}

      <p className="results-safety-note">
        If symptoms feel severe or this may be an emergency, contact local emergency services or seek urgent medical care now. Do not wait for an online result review.
      </p>
    </PageLayout>
  );
}

TestResultsPage.requireSignIn = true;

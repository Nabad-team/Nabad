import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { request } from "../lib/api";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getReportConversations, deleteReportConversation } from "../lib/reportConversationApi";

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
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const profileId = activeProfile?.id || "self";
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  useEffect(() => {
    let current = true;
    setConversations([]);
    setConversationId(null);
    setMessages([]);
    setResult(null);
    setFile(null);
    setHistoryError("");
    getReportConversations(profileId)
      .then((data) => { if (current && profileRef.current === profileId) setConversations(data.conversations); })
      .catch(() => { if (current && profileRef.current === profileId) setHistoryError("Saved conversations could not be loaded."); });
    return () => { current = false; };
  }, [profileId]);

  async function refreshConversations() {
    try {
      const data = await getReportConversations(profileId);
      if (profileRef.current === profileId) setConversations(data.conversations);
    } catch {
      setHistoryError("Your new conversation was saved, but the history list could not be refreshed.");
    }
  }

  function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    setResult(null);
    setMessages([]);
    setConversationId(null);
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
    const requestedProfileId = profileId;
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
        const analysis = await request(`/reports/analyze?profileId=${encodeURIComponent(profileId)}`, {
          method: "POST",
          body: JSON.stringify({ file: upload, question: currentQuestion, consent: true }),
        });
        if (profileRef.current !== requestedProfileId) return;
        setResult(analysis);
        setConversationId(analysis.conversationId);
        // The structured review below is the authoritative first response.
        // Follow-up chat messages are displayed separately instead of duplicating it.
        setMessages([]);
        await refreshConversations();
      } else {
        const answer = await request(`/reports/chat?profileId=${encodeURIComponent(profileId)}`, {
          method: "POST",
          body: JSON.stringify({ file: upload, question: currentQuestion, history: previousMessages, ...(conversationId ? { conversationId } : {}), consent: true }),
        });
        if (profileRef.current !== requestedProfileId) return;
        setConversationId(answer.conversationId);
        setMessages([
          ...messages,
          { role: "user", content: currentQuestion },
          { role: "assistant", content: answer.answer, evidence: answer.evidence, citations: answer.citations, disclaimer: answer.disclaimer },
        ].slice(-20));
        await refreshConversations();
      }
      setQuestion("");
    } catch (err) {
      if (profileRef.current !== requestedProfileId) return;
      if (err.status === 404 && conversationId) {
        setConversationId(null);
        setConversations((items) => items.filter((item) => item.id !== conversationId));
        setMessages([]);
        setResult(null);
        setFile(null);
        setError("That saved conversation is no longer available. Your message is still here. Send it again to start a new chat.");
        return;
      }
      const message = err.message || "The report could not be safely analyzed. Please try again or ask your clinician.";
      setError(err.requestId ? `${message} (Reference: ${err.requestId})` : message);
    } finally {
      setBusy(false);
    }
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setMessages([]);
    setConversationId(null);
    setError("");
    setConsent(false);
    const input = document.getElementById("test-report-file");
    if (input) input.value = "";
  }

  function newConversation() {
    clearFile();
    setMessages([]);
    setError("");
    setQuestion("");
  }

  function openConversation(conversation) {
    setFile(null);
    setResult(conversation.reportResult || null);
    setMessages(conversation.reportResult ? (conversation.messages || []).slice(2) : (conversation.messages || []));
    setConversationId(conversation.id);
    setQuestion("");
    setConsent(false);
    setError("");
    const input = document.getElementById("test-report-file");
    if (input) input.value = "";
  }

  async function removeConversation(conversation) {
    if (!window.confirm(`Delete the saved conversation “${conversation.title}”?`)) return;
    try {
      await deleteReportConversation(profileId, conversation.id);
      setConversations((items) => items.filter((item) => item.id !== conversation.id));
      if (conversationId === conversation.id) newConversation();
    } catch {
      setError("Could not delete this saved conversation. Please try again.");
    }
  }

  return (
    <PageLayout
      title="Health assistant"
      header={<ProfileHeader showPicture={false} />}
    >
      <PageTitle lead="Ask health questions, or attach a written test report and ask about its findings.">
        Health assistant
      </PageTitle>

      <section className="assistant-chat" aria-label="Health assistant conversation">
        <aside className="assistant-chat__sidebar" aria-label="Chat history">
          <Button type="button" onClick={newConversation} disabled={busy}>+ New chat</Button>
          <h2>Recent chats</h2>
          {historyError && conversations.length === 0 && <p className="text-muted" role="status">{historyError}</p>}
          {conversations.length > 0 ? <ul>{conversations.map((conversation) => (
            <li key={conversation.id}>
              <button type="button" className={`assistant-chat__history-link${conversationId === conversation.id ? " is-current" : ""}`} onClick={() => openConversation(conversation)} aria-label={conversation.title} aria-current={conversationId === conversation.id ? "page" : undefined} disabled={busy}>
                <span>{conversation.title}</span>
                <small>{new Date(conversation.updatedAt).toLocaleDateString("en-GB")}</small>
              </button>
              <button type="button" className="assistant-chat__delete" onClick={() => removeConversation(conversation)} aria-label={`Delete ${conversation.title}`} disabled={busy}>x</button>
            </li>
          ))}</ul> : <p className="text-muted">Your saved chats will appear here.</p>}
        </aside>
        <div className="assistant-chat__main">
        <header className="assistant-chat__header">
          <div>
            <span className="assistant-chat__status">Health assistant</span>
            {activeProfile?.fullName && <p>Conversation for <strong>{activeProfile.fullName}</strong></p>}
          </div>
          {(messages.length > 0 || result) && <Button type="button" variant="secondary" size="small" onClick={newConversation} disabled={busy}>New chat</Button>}
        </header>
        {messages.length > 0 && historyError && <Alert tone="danger" role="alert">{historyError}</Alert>}
        {messages.length > 0 ? (
          <section className="assistant-chat__history" aria-label="Conversation" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`report-chat__message report-chat__message--${message.role}`} key={`${message.role}-${index}`}>
                <h3>{message.role === "user" ? "You" : "Nabad assistant"}</h3>
                <p>{message.content}</p>
                {message.evidence?.length > 0 && <p className="report-chat__evidence"><strong>From the report:</strong> {message.evidence.join(" / ")}</p>}
                {message.citations?.length > 0 && <div className="report-chat__sources">
                  <strong>Reviewed sources:</strong>
                  <ul>{message.citations.map((source) => <li key={`${source.id}-${source.version || "legacy"}`}><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.title}</a> — {source.publisher}{source.version && ` · version ${source.version}`}{source.reviewedAt && ` · reviewed ${new Date(source.reviewedAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}`}</li>)}</ul>
                </div>}
                {message.disclaimer && <p className="report-chat__disclaimer">{message.disclaimer}</p>}
              </article>
            ))}
            {busy && <div className="assistant-chat__typing" role="status"><span /><span /><span /><span className="sr-only">The assistant is preparing a response</span></div>}
          </section>
        ) : !result ? (
          <section className="assistant-chat__welcome" aria-labelledby="assistant-welcome-title">
            <div className="assistant-chat__welcome-icon"><ResultsIcon /></div>
            <h2 id="assistant-welcome-title">What can I help you understand?</h2>
            <p>Ask a health question or get help understanding an English written test report.</p>
            <div className="assistant-chat__suggestions" aria-label="Suggested questions">
              {["What does a high cholesterol result mean?", "How can I prepare for a blood test?", "What should I ask my doctor about a new medicine?"].map((suggestion) => (
                <button className="assistant-chat__suggestion" key={suggestion} type="button" onClick={() => setQuestion(suggestion)}>{suggestion}</button>
              ))}
            </div>
            {busy && <div className="assistant-chat__typing" role="status"><span /><span /><span /><span className="sr-only">The assistant is preparing a response</span></div>}
          </section>
        ) : null}

      <form className="assistant-composer" onSubmit={sendMessage}>
        {file && <div className="assistant-composer__attachment" role="status"><span aria-hidden="true">File</span><span>Report attached ({file.name.split(".").pop()?.toLowerCase() || "file"})</span><Button type="button" variant="secondary" size="small" onClick={clearFile} disabled={busy}>Remove</Button></div>}
        {error && <Alert tone="danger" role="alert">{error}</Alert>}
        <label className="sr-only" htmlFor="report-question">Your message</label>
        <textarea
          id="report-question"
          className="assistant-composer__input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
          maxLength={1200}
          rows={2}
          placeholder="Ask anything about your health..."
          required
          disabled={busy}
        />
        <div className="assistant-composer__toolbar">
          <div className="assistant-composer__tools">
            <label className="assistant-composer__attach" htmlFor="test-report-file" title="Attach a test report"><span aria-hidden="true">+</span><span>Attach report</span></label>
            <input id="test-report-file" className="sr-only" type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,image/jpeg,image/png,image/webp,.pdf,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp" onChange={selectFile} aria-describedby="report-file-help" disabled={busy} />
            <span className="assistant-composer__file-help" id="report-file-help">PDF, DOCX, TXT, CSV, JPG, PNG or WebP, max 3 MB</span>
          </div>
          <Button type="submit" disabled={!question.trim() || !consent || busy} aria-label={busy ? "Sending message" : "Send message"}>{busy ? "Sending..." : "Send"}</Button>
        </div>
        <label className="check assistant-composer__consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy} />
          I agree to send my question and any attached report to Google's Gemini AI service over an encrypted connection. It may contain sensitive health information.
        </label>
        <p className="report-privacy-note">The assistant currently supports English only. Chat messages, assistant replies, and report findings are saved to this profile for later review. Uploaded files are not stored; attach the report again when you need the assistant to read it. You can delete saved conversations from the list above.</p>
      </form>

      {result && (
        <section className={`report-result report-result--${result.urgency}`} aria-labelledby="report-result-heading" aria-live="polite">
          <p className="report-result__eyebrow">AI explanation · not reviewed by a clinician</p>
          <p className="report-result__meta">Prepared for {activeProfile?.fullName || "the selected profile"}</p>
          {result.reportCoverage === "partial_text" && (
            <Alert tone="warning" role="status">
              The complete report could not be verified as readable. Pages or findings may be missing.
              {result.extractionCoverage && (
                <> Processed coverage: {result.extractionCoverage.readablePages} readable of {result.extractionCoverage.pageCount} PDF pages
                  {result.extractionCoverage.unreadablePages?.length > 0 && `; unreadable pages: ${result.extractionCoverage.unreadablePages.join(", ")}`}
                  {result.extractionCoverage.sparsePages?.length > 0 && `; low-text pages: ${result.extractionCoverage.sparsePages.join(", ")}`}.</>
              )}
            </Alert>
          )}
          {result.reportCoverage === "complete_text" && <p className="report-result__coverage">The readable text of the uploaded report was processed.</p>}
          <h2 id="report-result-heading">{URGENCY_LABELS[result.urgency] || URGENCY_LABELS.unclear}</h2>
          <p>{result.summary}</p>

          {result.findings.length > 0 ? (
            <div className="report-findings">
              <h3>Report findings</h3>
              {["urgent", "abnormal", "borderline", "normal", "unclear"].map((category) => {
                const categoryFindings = result.findings.filter((finding) => (finding.category || "unclear") === category);
                if (!categoryFindings.length) return null;
                const labels = { urgent: "Urgent findings", abnormal: "Abnormal findings", borderline: "Borderline findings", normal: "Results marked normal", unclear: "Findings needing clarification" };
                return (
                  <section className={`report-finding-group report-finding-group--${category}`} key={category} aria-labelledby={`finding-group-${category}`}>
                    <h4 id={`finding-group-${category}`}>{labels[category]}</h4>
                    {categoryFindings.map((finding, index) => (
                      <article className="report-finding" key={`${finding.name}-${index}`}>
                        <h5>{finding.name}</h5>
                        <p><strong>In the report:</strong> {finding.sourceQuote}</p>
                        <p><strong>Reported result:</strong> {finding.result}</p>
                        <p><strong>In simpler words:</strong> {finding.explanation}</p>
                        {finding.reference && <p><strong>Reference:</strong> {finding.reference}</p>}
                        <p><strong>Next step:</strong> {finding.followUp}</p>
                      </article>
                    ))}
                  </section>
                );
              })}
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
          <p className="report-result__print"><Button variant="secondary" onClick={() => window.print()}>Print or save as PDF</Button></p>
        </section>
      )}
        </div>
      </section>

      <p className="results-safety-note">
        If symptoms feel severe or this may be an emergency, contact local emergency services or seek urgent medical care now. Do not wait for an online result review.
      </p>
    </PageLayout>
  );
}

TestResultsPage.requireSignIn = true;

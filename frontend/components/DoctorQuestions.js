import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Input from "./ui/Input";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import { addDoctorQuestion, editDoctorQuestion, removeDoctorQuestion } from "../lib/visitPrepApi";

// SCRUM-333: "Questions for my doctor". A question can be saved at any time, from Visit preparation, My history or
// My appointments, and it then appears in the visit sheet, the shared doctor link and the printout
// (questionsSectionText below). They are kept per profile with the visit sheet (backend: routes/visitPrep.js).
export const QUESTION_MAX_LENGTH = 300;
export const QUESTIONS_TITLE = "Questions for my doctor";

// The text of the visit-sheet section, numbered, as it goes into the shared link, the export and the PDF.
export function questionsSectionText(questions = []) {
  return questions.map((question, index) => `${index + 1}. ${question.text}`).join("\n");
}

// One field and a Save button. Used inside the full list and on its own elsewhere.
export function QuestionForm({ id, profileId, onSaved, label = "Add a question", hint, disabled = false }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const profileRef = useRef(profileId);
  profileRef.current = profileId;
  useEffect(() => { setText(""); setError(""); }, [profileId]);

  async function save(event) {
    event.preventDefault();
    const value = text.replace(/\s+/g, " ").trim();
    if (!value) return setError("Write your question first.");
    if (value.length > QUESTION_MAX_LENGTH) return setError(`Keep the question under ${QUESTION_MAX_LENGTH} characters.`);
    const savedFor = profileId;
    setSaving(true); setError("");
    try {
      const result = await addDoctorQuestion(savedFor, value);
      if (profileRef.current !== savedFor) return;
      setText("");
      onSaved?.(result);
    } catch (failure) {
      if (profileRef.current === savedFor) setError(failure.message || "We couldn't save the question. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <form className="form doctor-questions__form" onSubmit={save} noValidate>
      <Input id={id} label={label} hint={hint} value={text} maxLength={QUESTION_MAX_LENGTH} autoComplete="off"
        onChange={(event) => setText(event.target.value)} error={error || undefined} disabled={disabled || saving || !profileId} />
      <div className="form-actions">
        <Button type="submit" disabled={disabled || saving || !profileId}>{saving ? "Saving..." : "Save question"}</Button>
      </div>
    </form>
  );
}

// The full list on Visit preparation: add, edit and remove.
export default function DoctorQuestions({ profileId, questions = [], onChange, disabled = false }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { setEditingId(null); setError(""); setNotice(""); }, [profileId]);

  function startEdit(question) {
    setEditingId(question.id); setDraft(question.text); setError(""); setNotice("");
  }

  async function saveEdit(event, question) {
    event.preventDefault();
    const value = draft.replace(/\s+/g, " ").trim();
    if (!value) return setError("Write your question first.");
    setBusy(true); setError("");
    try {
      const result = await editDoctorQuestion(profileId, question.id, value);
      onChange?.(result.questions);
      setEditingId(null); setNotice("Question updated.");
    } catch (failure) { setError(failure.message || "We couldn't save the question. Please try again."); }
    finally { setBusy(false); }
  }

  async function remove(question) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await removeDoctorQuestion(profileId, question.id);
      onChange?.(result.questions);
      setNotice("Question removed.");
    } catch (failure) { setError(failure.message || "We couldn't remove the question. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <Card className="section doctor-questions" aria-labelledby="doctor-questions-heading">
      <h2 id="doctor-questions-heading">{QUESTIONS_TITLE}</h2>
      <p className="text-muted">Write questions down whenever you think of them. They are on this sheet, the link you share with a doctor and the printout.</p>
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {notice && <p className="text-sm text-muted" role="status">{notice}</p>}
      {questions.length > 0 ? (
        <ol className="doctor-questions__list" aria-label={QUESTIONS_TITLE}>
          {questions.map((question) => (
            <li key={question.id} className="doctor-questions__item">
              {editingId === question.id ? (
                <form className="doctor-questions__edit" onSubmit={(event) => saveEdit(event, question)} noValidate>
                  <Input id={`doctor-question-edit-${question.id}`} label="Edit question" value={draft} maxLength={QUESTION_MAX_LENGTH}
                    onChange={(event) => setDraft(event.target.value)} disabled={busy} autoComplete="off" />
                  <div className="button-row">
                    <Button type="submit" size="small" disabled={busy}>Save</Button>
                    <Button type="button" size="small" variant="secondary" disabled={busy} onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <span className="doctor-questions__text">{question.text}</span>
                  <span className="button-row doctor-questions__actions">
                    <Button type="button" size="small" variant="secondary" disabled={busy || disabled} onClick={() => startEdit(question)} aria-label={`Edit: ${question.text}`}>Edit</Button>
                    <Button type="button" size="small" variant="secondary" disabled={busy || disabled} onClick={() => remove(question)} aria-label={`Remove: ${question.text}`}>Remove</Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="text-muted">No questions yet.</p>}
      <QuestionForm id="doctor-question-new" profileId={profileId} disabled={disabled || busy}
        onSaved={(result) => { onChange?.(result.questions); setNotice("Question saved."); }} />
    </Card>
  );
}

// A small card for other pages: save a question now, find it in Visit preparation later.
export function QuickDoctorQuestion({ profileId, name, forSelf = true, id = "quick-doctor-question" }) {
  const [saved, setSaved] = useState(null);
  useEffect(() => { setSaved(null); }, [profileId]);
  return (
    <Card className="section doctor-questions doctor-questions--quick" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{QUESTIONS_TITLE}</h2>
      <p className="text-muted">{forSelf
        ? "Thought of something to ask at your next visit? Save it here so you don't forget."
        : `Thought of something to ask at ${name ? `${name}'s` : "their"} next visit? Save it here so you don't forget.`}</p>
      <QuestionForm id={id} profileId={profileId} label="Question for the doctor" onSaved={(result) => setSaved(result)} />
      {saved && (
        <p className="text-sm" role="status">
          Saved. You have {saved.questions.length} {saved.questions.length === 1 ? "question" : "questions"} for the doctor. <a href="/visit-prep#doctor-questions-heading">See them in Visit preparation</a>
        </p>
      )}
    </Card>
  );
}

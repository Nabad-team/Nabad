import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { askHistory } from "../lib/historyApi";
import { formatDate } from "../lib/dates";

// SCRUM-156: "As a user, I want to ask natural-language questions about my own history so that I can recall
// past symptoms or visits." Questions are answered from the active profile's own symptom checks,
// appointments, medications and documents. The records found are always listed under the answer, so
// the person can check it. AI writes the answer only when the person ticks the box.

export const EXAMPLES = [
  "When did I last have a headache?",
  "How many times did I see a doctor this year?",
  "What did I check last month?",
  "What medicines was I taking in March?",
];
const TYPE_LABELS = { "symptom-check": "Symptom check", visit: "Visit", medication: "Medication", document: "Document" };
const OPEN_LABELS = { "symptom-check": "Open symptom checks", visit: "Open in Appointments", medication: "Open in Medications", document: "Open in Medical documents" };
const MAX_LENGTH = 300;

export default function MyHistoryPage() {
  const { activeProfile, error: profilesError } = useActiveProfile();
  const profileId = activeProfile?.id;
  const forSelf = !activeProfile || activeProfile.isSelf;
  const name = activeProfile?.fullName;
  const [question, setQuestion] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [state, setState] = useState({});
  const controller = useRef(null);

  // A different profile: start again, so one person's history is never shown under another's name.
  useEffect(() => {
    controller.current?.abort();
    setState({});
  }, [profileId]);
  useEffect(() => () => controller.current?.abort(), []);

  async function ask(event, text = question) {
    event?.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length < 3) return setState({ error: "Write a question of at least 3 characters." });
    controller.current?.abort();
    controller.current = new AbortController();
    setState({ loading: true });
    try {
      const result = await askHistory(profileId, trimmed, useAi, controller.current.signal);
      setState({ result, asked: trimmed });
    } catch (error) {
      if (error.name === "AbortError") return;
      setState({ error: error.message || "We couldn't search the history. Please try again." });
    }
  }

  function askExample(example) {
    setQuestion(example);
    ask(null, example);
  }

  const { result, error, loading, asked } = state;
  const cited = new Set(result?.sources || []);
  return (
    <PageLayout title="Ask about my history" header={<ProfileHeader showPicture={false} />}>
      <PageTitle lead={forSelf
        ? "Ask about your past symptom checks, visits, medicines and documents saved in Nabad."
        : `Ask about ${name}'s past symptom checks, visits, medicines and documents saved in Nabad.`}>
        {forSelf ? "Ask about my history" : `Ask about ${name}'s history`}
      </PageTitle>

      {profilesError && <Alert tone="danger" as="p" role="alert">{profilesError}</Alert>}

      <form onSubmit={ask} noValidate className="form history-form" aria-label="Ask a question">
        <Input id="history-question" label="Your question" hint="For example: When did I last have a headache?" value={question}
          onChange={(event) => setQuestion(event.target.value)} maxLength={MAX_LENGTH} autoComplete="off" />
        <label className="check">
          <input type="checkbox" checked={useAi} onChange={(event) => setUseAi(event.target.checked)} />
          <span>Let AI write the answer. Your question and the matching records are sent to Nabad's AI provider. Without this, Nabad answers by searching the records.</span>
        </label>
        <div className="form-actions">
          <Button type="submit" disabled={loading || !profileId}>{loading ? "Searching..." : "Ask"}</Button>
        </div>
        <div className="history-examples" role="group" aria-label="Example questions">
          {EXAMPLES.map((example) => (
            <Button key={example} variant="secondary" size="small" onClick={() => askExample(example)} disabled={loading || !profileId}>{example}</Button>
          ))}
        </div>
      </form>

      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {loading && <HeartbeatLoader label="Searching the history..." />}

      {result && (
        <section className="history-answer" aria-labelledby="history-answer-title" aria-live="polite">
          {result.safety && (
            <Alert tone="danger" role="alert" title="Is this happening now?">
              {result.safety.message} <a href={`tel:${result.safety.phone}`}>Call {result.safety.phone}</a>
            </Alert>
          )}
          <h2 id="history-answer-title" className="history-answer__question">{asked}</h2>
          <p className="history-answer__text">{result.answer}</p>
          <p className="text-sm text-muted">
            {result.answeredBy === "ai"
              ? "Written by AI from the records below. Check them: AI can make mistakes."
              : "Found by searching the saved records."}
            {result.period ? ` Period: ${result.period.label}.` : ""}
          </p>

          {result.records.length > 0 && (
            <>
              <h3>{result.total > result.records.length ? `The ${result.records.length} most relevant of ${result.total} records` : `${result.records.length} ${result.records.length === 1 ? "record" : "records"}`}</h3>
              <ul className="history-records" aria-label="Records found">
                {result.records.map((record) => (
                  <li key={`${record.type}-${record.id}`} className="history-record">
                    <div className="history-record__heading">
                      <Badge tone="neutral">{TYPE_LABELS[record.type] || "Record"}</Badge>
                      <span className="history-record__date">{formatDate(record.day)}{record.time ? `, ${record.time}` : ""}</span>
                      {record.result && <Badge tone={record.result === "Upcoming" ? "info" : "neutral"}>{record.result}</Badge>}
                      {cited.has(record.id) && <Badge>Used in the answer</Badge>}
                    </div>
                    <p className="history-record__title">{record.title}</p>
                    {record.detail && <p>{record.type === "symptom-check" ? `You described: “${record.detail}”` : record.detail}</p>}
                    {record.notes && <p className="text-sm text-muted">Notes: {record.notes}</p>}
                    <a href={record.href}>{OPEN_LABELS[record.type] || "Open"}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-sm text-muted">This recalls what was saved in Nabad. It is not medical advice. If you feel unwell now, use the Safety check, or call 140 in an emergency.</p>
        </section>
      )}
    </PageLayout>
  );
}
MyHistoryPage.requireSignIn = true;

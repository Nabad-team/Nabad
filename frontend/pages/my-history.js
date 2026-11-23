import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import HealthStory from "../components/HealthStory";
import { QuickDoctorQuestion } from "../components/DoctorQuestions";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { askHistory } from "../lib/historyApi";
import { AiUsageLine, DailyLimitNotice } from "../components/AiUsage";
import { getAiUsage, dailyLimitOf } from "../lib/aiUsageApi";
import { formatDate } from "../lib/dates";

// SCRUM-156: "As a user, I want to ask natural-language questions about my own history so that I can recall
// past symptoms or visits." Questions are answered from the active profile's own symptom checks,
// appointments, medications and documents. The records found are always listed under the answer, so
// the person can check it. AI writes the answer only when the person ticks the box.
//
// SCRUM-332: the page also shows "My health story", the same records month by month (components/HealthStory.js), and
// SCRUM-333: a place to save a question for the doctor (components/DoctorQuestions.js).

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
  // Today's AI questions about history for the account (backend dailyAiLimits.js). Only AI answers count.
  const [aiUsage, setAiUsage] = useState(null);
  const controller = useRef(null);

  useEffect(() => {
    const usageRequest = new AbortController();
    Promise.resolve().then(() => getAiUsage(usageRequest.signal)).then((data) => { if (data?.historyQuestions) setAiUsage(data.historyQuestions); }).catch(() => {});
    return () => usageRequest.abort();
  }, []);

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
      if (result?.aiUsage) setAiUsage(result.aiUsage);
    } catch (error) {
      if (error.name === "AbortError") return;
      const limit = dailyLimitOf(error);
      if (limit) {
        setAiUsage(limit);
        return setState({ limit, limitMessage: error.message });
      }
      setState({ error: error.message || "We couldn't search the history. Please try again." });
    }
  }

  function askExample(example) {
    setQuestion(example);
    ask(null, example);
  }

  const { result, error, loading, asked, limit, limitMessage } = state;
  const cited = new Set(result?.sources || []);
  return (
    <PageLayout title="My history" header={<ProfileHeader />}>
      <PageTitle lead={forSelf
        ? "Your symptom checks, visits, medicines, documents and vitals saved in Nabad, month by month. You can also ask a question about them."
        : `${name}'s symptom checks, visits, medicines, documents and vitals saved in Nabad, month by month. You can also ask a question about them.`}>
        {forSelf ? "My history" : `${name}'s history`}
      </PageTitle>

      {profilesError && <Alert tone="danger" as="p" role="alert">{profilesError}</Alert>}

      <div className="stack">
        {profileId && <HealthStory profileId={profileId} forSelf={forSelf} name={name} />}

        <Card className="section" aria-labelledby="history-ask-heading">
          <h2 id="history-ask-heading">{forSelf ? "Ask about my history" : `Ask about ${name}'s history`}</h2>
          <form onSubmit={ask} noValidate className="form history-form" aria-label="Ask a question">
            <Input id="history-question" label="Your question" hint="For example: When did I last have a headache?" value={question}
              onChange={(event) => setQuestion(event.target.value)} maxLength={MAX_LENGTH} autoComplete="off" />
            <label className="check">
              <input type="checkbox" checked={useAi} onChange={(event) => setUseAi(event.target.checked)} />
              <span>Let AI write the answer. Your question and the matching records are sent to Nabad's AI provider. Without this, Nabad answers by searching the records.</span>
            </label>
            {useAi && <AiUsageLine usage={aiUsage} noun="AI questions" />}
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
          <DailyLimitNotice limit={limit} message={limitMessage}>
            <p>You can still ask now without AI: untick &quot;Let AI write the answer&quot; and Nabad answers by searching the records.</p>
          </DailyLimitNotice>
          {loading && <p className="text-muted progress-note" role="status">Searching the history...</p>}

          {result && (
            <section className="history-answer" aria-labelledby="history-answer-title" aria-live="polite">
              {result.safety && (
                <Alert tone="danger" role="alert" title="Is this happening now?">
                  {result.safety.message} <a href={`tel:${result.safety.phone}`}>Call {result.safety.phone}</a>
                </Alert>
              )}
              <h3 id="history-answer-title" className="history-answer__question">{asked}</h3>
              <p className="history-answer__text">{result.answer}</p>
              <p className="text-sm text-muted">
                {result.answeredBy === "ai"
                  ? "Written by AI from the records below. Check them: AI can make mistakes."
                  : "Found by searching the saved records."}
                {result.period ? ` Period: ${result.period.label}.` : ""}
              </p>

              {result.records.length > 0 && (
                <>
                  <h4>{result.total > result.records.length ? `The ${result.records.length} most relevant of ${result.total} records` : `${result.records.length} ${result.records.length === 1 ? "record" : "records"}`}</h4>
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
              <p className="text-sm text-muted">This recalls what was saved in Nabad. It is not medical advice. If you feel unwell now, use the Symptom check, or call 140 in an emergency.</p>
            </section>
          )}
        </Card>

        {profileId && <QuickDoctorQuestion profileId={profileId} forSelf={forSelf} name={name} id="history-doctor-question" />}
      </div>
    </PageLayout>
  );
}
MyHistoryPage.requireSignIn = true;

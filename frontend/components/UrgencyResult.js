import Button from "./ui/Button";
import { triageProviderUrl } from "../lib/providerFilters";
import ReadAloudButton from "./ReadAloudButton";
import UrgencyExplanation from "./UrgencyExplanation";
import { useAccessibility } from "../context/AccessibilityContext";

// SCRUM-128: shows the urgency classification returned by POST /api/triage/classify.
// Answers the two questions in the story: "do I need care?" (label + action)
// and "how soon?" (timeframe). Colour is never the only signal: the label is always written out.
// Colors per level: .urgency--<level> in styles/components.css (red is kept for emergencies).
const LEVELS = ["emergency", "urgent", "soon", "routine"];

// SCRUM-126: "preliminary" = follow-up questions are still open, so the level may still change.
export default function UrgencyResult({ result, preliminary = false }) {
  const { preferences } = useAccessibility();
  if (!result) return null;
  const simplified = preferences.simplifiedMode;
  const level = LEVELS.includes(result.level) ? result.level : "routine";
  const isEmergency = result.level === "emergency";
  // SCRUM-130: the plain-language explanation, when the API sends one (older responses only have reasons).
  const explanation = result.explanation?.summary ? result.explanation : null;
  const spokenWhy = explanation
    ? [explanation.summary, ...(explanation.watchFor || [])].join(" ")
    : result.reasons?.length ? `Why: ${result.reasons.join(". ")}.` : "";
  const spokenResult = [
    `${preliminary ? "Urgency so far" : "Urgency"}: ${result.label}.`,
    `How soon: ${result.timeframe}.`,
    `What to do: ${result.action}.`,
    spokenWhy,
    result.disclaimer,
  ].filter(Boolean).join(" ");
  const shortAction = isEmergency
    ? "Call now"
    : level === "urgent"
      ? "Get help today"
      : level === "soon"
        ? "See a doctor soon"
        : "You can monitor this";

  return (
    <section
      aria-labelledby="urgency-heading"
      // An emergency is announced immediately by screen readers; the others politely.
      role={isEmergency ? "alert" : "status"}
      className={`urgency urgency--${level}`}
    >
      <h2 id="urgency-heading">
        {preliminary ? "Urgency so far" : "Urgency"}: {result.label}
      </h2>
      {simplified && <p className="urgency__summary"><strong>{shortAction}</strong></p>}
      {preliminary && <p>Answer the questions below to make this more accurate.</p>}
      {!preliminary && result.confidence === "refined" && <p>Updated using your answers.</p>}
      <p>
        <strong>How soon:</strong> {result.timeframe}
      </p>
      <p>
        <strong>What to do:</strong> {result.action}
      </p>
      <p>
        <ReadAloudButton text={spokenResult} />
      </p>

      {isEmergency && (
        <p>
          <Button variant="danger" href="tel:140">Call 140 now</Button>
        </p>
      )}

      {explanation ? (
        <>
          <UrgencyExplanation explanation={explanation} isEmergency={isEmergency} simplified={simplified} />
          {/* With an AI check, its own explanation is not in the rule-based one above. */}
          {!simplified && result.ai?.used && result.reasons?.length > 0 && (
            <>
              <p className="urgency__label"><strong>What the AI check noted:</strong></p>
              <ul>
                {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </>
          )}
        </>
      ) : result.reasons?.length > 0 && (
        <>
          <p className="urgency__why">
            <strong>Why:</strong>
          </p>
          <ul>
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      )}

      <p className="text-sm">{result.disclaimer}</p>
      <p>
        <Button variant="secondary" href={triageProviderUrl(result)}>
          {isEmergency ? "Browse published 24/7 ER facilities in Lebanon" : "Browse hospitals and clinics in Lebanon"}
        </Button>
      </p>
    </section>
  );
}

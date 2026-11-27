import Button from "./ui/Button";
import HeldMark from "./ui/HeldMark";
import HeldIcon from "./ui/HeldIcon";

import {
  triageProviderLabel,
  triageProviderUrl,
} from "../lib/providerFilters";

import ReadAloudButton from "./ReadAloudButton";
import UrgencyExplanation, { WatchFor } from "./UrgencyExplanation";

import {
  useAccessibility,
} from "../context/AccessibilityContext";


const LEVELS = [
  "emergency",
  "urgent",
  "soon",
  "routine",
];

// The four triage levels from lowest to highest, with the exact labels the triage API uses
// (backend/src/triage/urgency.js). Display only: which level applies is always decided by the server.
export const URGENCY_SCALE = [
  ["routine", "Routine / self-care"],
  ["soon", "See a doctor soon"],
  ["urgent", "Urgent"],
  ["emergency", "Emergency"],
];

// The 4-step scale under the header: visually just a bar of four segments, the current one in full colour and the
// others faded. The level is said once, in the header ("Urgency: <label>", with how soon). For screen readers the
// list keeps every step, "This result" and aria-current, and "Level 2 of 4: See a doctor soon" is written out, so
// it never relies on colour alone.
export function UrgencyScale({ level }) {
  const index = URGENCY_SCALE.findIndex(([key]) => key === level);
  return (
    <div className="urgency-scale urgency-scale--bar">
      <p id="urgency-scale-label" className="urgency-scale__label">Urgency scale, from lowest to highest</p>
      <ol aria-labelledby="urgency-scale-label" className="urgency-scale__steps">
        {URGENCY_SCALE.map(([key, label]) => {
          const current = key === level;
          return (
            <li key={key} className={`urgency-scale__step urgency-scale__step--${key}${current ? " urgency-scale__step--current" : ""}`}
              aria-current={current ? "step" : undefined}>
              <span className="urgency-scale__name">{label}</span>
              {current && <span className="urgency-scale__you">This result</span>}
            </li>
          );
        })}
      </ol>
      {index >= 0 && <p className="urgency-scale__level">Level {index + 1} of 4: {URGENCY_SCALE[index][1]}</p>}
    </div>
  );
}

// "What the AI check noted" can repeat a sentence that is already shown above it (for example the meaning
// under "What you told us"). Show each sentence once: keep the earlier copy, drop it from the AI list.
const sameText = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
export function unrepeatedReasons(reasons = [], explanation = null) {
  const shown = new Set([
    explanation?.summary,
    ...(explanation?.triggers || []).map((trigger) => trigger.meaning),
    ...(explanation?.fromMyHealth || []),
    ...(explanation?.watchFor || []),
  ].filter(Boolean).map(sameText));
  return reasons.filter((reason) => !shown.has(sameText(reason)));
}

// One disclosure row of the details card. Secondary detail only: the red flags are never in one of these.
function DetailRow({ title, open = false, children }) {
  return (
    <details className="urgency__row" open={open}>
      <summary>
        <h3 className="urgency__row-title">{title}</h3>
        <HeldIcon name="chevronDown" size="1.25rem" className="urgency__row-chevron" />
      </summary>
      <div className="urgency__row-body">{children}</div>
    </details>
  );
}


// The symptom check result (docs/design-system.md#result-anatomy). It is the last step of the guided check: the
// page asks its follow-up questions first (components/FollowUpQuestions.js) and shows this only when they are done
// or skipped, or at once for an emergency. Top to bottom:
//   1. The header, in the level's soft colour: ONE mark (the Held ring in the level colour; for an emergency the
//      still urgent mark), the level once ("Urgency: <label>") with how soon, and the engine's action as the main line.
//      Under it the scale bar (visual only; its words are for screen readers), and "Updated using your answers."
//      after a refined result.
//   2. "Get help sooner if things change" (an emergency: "don't wait"), always visible in its soft danger outline.
//      The only place on the result that lists the call-140 conditions. Never collapsed, never shortened.
//   3. One white card of disclosure rows: "Why we suggest this" (open), "Your answers" (the follow-up questions and
//      what the person chose), "What the AI check noted" and "Self-care guidance" (closed).
//   4. Find care, the one primary button; Read aloud and Print or PDF as quiet text buttons; then, from the page,
//      "Check something else".
// answers: [{ question, answer }] from the page, the follow-up answers given in this check (empty when none).
// Every word of triage text comes from the server, rendered as text.
export default function UrgencyResult({
  result,
  onCheckAgain,
  answers = [],
}) {
  const {
    preferences,
  } = useAccessibility();

  if (!result) {
    return null;
  }

  const simplified = preferences.simplifiedMode;
  const level = LEVELS.includes(result.level) ? result.level : "routine";
  const isEmergency = result.level === "emergency";
  const isSelfHarm = result.matchedRuleIds?.includes("self-harm");
  const explanation = result.explanation?.summary ? result.explanation : null;

  const spokenWhy = explanation
    ? [explanation.summary, ...(explanation.watchFor || [])].join(" ")
    : result.reasons?.length
      ? `Why: ${result.reasons.join(". ")}.`
      : "";
  const spokenSelfCare = result.selfCareGuidance?.length
    ? `Self-care guidance: ${result.selfCareGuidance.join(". ")}.`
    : "";
  const spokenResult = [
    `Urgency: ${result.label}.`,
    `How soon: ${result.timeframe}.`,
    `What to do: ${result.action}.`,
    spokenWhy,
    spokenSelfCare,
    result.disclaimer,
  ].filter(Boolean).join(" ");

  const aiReasons = unrepeatedReasons(result.reasons, explanation);
  const showAi = Boolean(explanation && !simplified && result.ai?.used && aiReasons.length > 0);
  const olderReasons = !explanation && result.reasons?.length > 0;
  const hasAnswers = answers.length > 0;
  const hasDetails = Boolean(explanation || olderReasons || hasAnswers || showAi || result.selfCareGuidance?.length);

  // Emergencies keep role="alert". Other results are announced by the page's own live region
  // (pages/symptoms.js), which then moves focus to the heading.
  // Motion rule 1: an emergency never waits. It renders with no entrance animation and no delay, and nothing on it
  // moves; the other levels fade in once (urgency--enter, 200ms ease-out, styles/components.css).
  return (
    <section
      id="symptom-result"
      tabIndex={-1}
      aria-labelledby="urgency-heading"
      role={isEmergency ? "alert" : undefined}
      className={`urgency urgency--${level}${isEmergency ? "" : " urgency--accent urgency--enter"}`}
    >
      {/* Urgency colour is an accent, not a flood (docs/design-system.md#symptom-check-result): routine, soon and
          urgent sit on a white card with a 4px top edge in the level colour, the level as a chip and a small ring.
          Only an emergency fills its card with its colour, with the still urgent mark. */}
      <div className="urgency__indicator">
        <HeldMark state={isEmergency ? "urgent" : "done"} size={isEmergency ? "3.25rem" : "2rem"} className="urgency__mark" />
        <div className="urgency__heading-block">
          <div className="urgency__level-row">
            <h2 id="urgency-heading" tabIndex={-1}>
              {isEmergency ? <>Urgency: {result.label}</> : <>
                <span className="visually-hidden">Urgency: </span>
                <span className={`level-chip level-chip--${level}`}>{result.label}</span>
              </>}
            </h2>
            <p className="urgency__timeframe">
              <span className="urgency__timeframe-label">How soon:</span>{" "}{result.timeframe}
            </p>
          </div>
          <p className="urgency__action">
            <span className="visually-hidden">What to do: </span>{result.action}
          </p>
        </div>
        <UrgencyScale level={level} />
        {result.confidence === "refined" && <p className="urgency__refined">Updated using your answers.</p>}
      </div>

      {isEmergency && (
        <p className="urgency__call">
          <Button variant="danger" href="tel:140" block>
            Call 140 now
          </Button>
        </p>
      )}

      {/* Always visible, right under the header: never inside a disclosure. */}
      {explanation && <WatchFor watchFor={explanation.watchFor} isEmergency={isEmergency} />}

      {isSelfHarm && (
        <p>
          <Button variant="secondary" href="/dashboard#wellbeing-corner-heading">
            View mental health support
          </Button>
        </p>
      )}

      {hasDetails && (
        <div className="urgency__details">
          {explanation && (
            <DetailRow title="Why we suggest this" open>
              <UrgencyExplanation explanation={explanation} simplified={simplified} />
            </DetailRow>
          )}
          {olderReasons && (
            <DetailRow title="Why:" open>
              <ul>
                {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </DetailRow>
          )}
          {hasAnswers && (
            <DetailRow title="Your answers">
              <dl className="urgency__answers">
                {answers.map(({ question, answer }) => (
                  <div key={question} className="urgency__answer">
                    <dt>{question}</dt>
                    <dd>{answer}</dd>
                  </div>
                ))}
              </dl>
            </DetailRow>
          )}
          {showAi && (
            <DetailRow title="What the AI check noted">
              <ul>
                {aiReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </DetailRow>
          )}
          {result.selfCareGuidance?.length > 0 && (
            <DetailRow title="Self-care guidance">
              <ul>
                {result.selfCareGuidance.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </DetailRow>
          )}
        </div>
      )}

      <p className="text-sm urgency__disclaimer">{result.disclaimer}</p>

      <div className="urgency__actions">
        {/* Open the care directory with the server-selected capability filters. */}
        <a className="button button--primary button--block urgency__find-care" href={triageProviderUrl(result)}>
          {triageProviderLabel(result)}
        </a>
        <div className="urgency__quiet-actions">
          <ReadAloudButton text={spokenResult} quiet />
          <button type="button" className="quiet-button urgency__print" onClick={() => window.print()}>
            <HeldIcon name="print" size="1.25rem" />
            Print or save as PDF
          </button>
        </div>
        {onCheckAgain && (
          <Button variant="secondary" block onClick={onCheckAgain} className="urgency__again">
            Check something else
          </Button>
        )}
      </div>
    </section>
  );
}

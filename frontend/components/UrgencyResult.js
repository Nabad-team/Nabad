import Button from "./ui/Button";
import HeldMark from "./ui/HeldMark";

import {
  triageProviderLabel,
  triageProviderUrl,
} from "../lib/providerFilters";

import ReadAloudButton from "./ReadAloudButton";
import UrgencyExplanation from "./UrgencyExplanation";

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

// One line icon per level, so the level never depends on colour alone (the label is always written too).
export function UrgencyIcon({ level, className = "urgency__icon" }) {
  const paths = {
    routine: <><path d="M4 11.5 12 5l8 6.5V20H4Z" /><path d="M10 20v-5h4v5" /></>,
    soon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    urgent: <><path d="M12 3.5 21.5 20h-19Z" /><path d="M12 10v4.5M12 17.4h.01" /></>,
    emergency: <><circle cx="12" cy="12" r="9" /><path d="M12 6.8v6.4M12 16.8h.01" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[level]}
    </svg>
  );
}

// The 4-step scale under the heading: a compact bar of four segments, the current one in full colour and the
// others faded. The written line "Level 2 of 4: See a doctor soon", the current step's icon, "This result" and
// aria-current mean it never relies on colour alone.
function UrgencyScale({ level }) {
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
              {current && <UrgencyIcon level={key} className="urgency-scale__icon" />}
              <span className="urgency-scale__name">{label}</span>
              {current && <span className="urgency-scale__you">This result</span>}
            </li>
          );
        })}
      </ol>
      {index >= 0 && <p className="urgency-scale__level">Level <span className="num">{index + 1}</span> of 4: {URGENCY_SCALE[index][1]}</p>}
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


export default function UrgencyResult({
  result,
  preliminary = false,
}) {
  const {
    preferences,
  } = useAccessibility();

  if (!result) {
    return null;
  }


  const simplified =
    preferences.simplifiedMode;


  const level =
    LEVELS.includes(
      result.level
    )
      ? result.level
      : "routine";


  const isEmergency =
    result.level ===
    "emergency";


  const isSelfHarm =
    result.matchedRuleIds?.includes(
      "self-harm"
    );


  const explanation =
    result.explanation?.summary
      ? result.explanation
      : null;


  const spokenWhy =
    explanation
      ? [
          explanation.summary,
          ...(
            explanation.watchFor ||
            []
          ),
        ].join(" ")
      : result.reasons?.length
        ? `Why: ${result.reasons.join(
            ". "
          )}.`
        : "";


  const spokenSelfCare =
    result.selfCareGuidance?.length
      ? `Self-care guidance: ${result.selfCareGuidance.join(
          ". "
        )}.`
      : "";


  const spokenResult = [
    `${
      preliminary
        ? "Urgency so far"
        : "Urgency"
    }: ${result.label}.`,

    `How soon: ${result.timeframe}.`,

    `What to do: ${result.action}.`,

    spokenWhy,

    spokenSelfCare,

    result.disclaimer,
  ]
    .filter(Boolean)
    .join(" ");


  const shortAction =
    isEmergency
      ? "Call now"
      : level === "urgent"
        ? "Get help today"
        : level === "soon"
          ? "See a doctor soon"
          : "You can monitor this";


  const aiReasons = unrepeatedReasons(result.reasons, explanation);

  // Emergencies keep role="alert". Other results are announced by the page's own live region
  // (pages/symptoms.js), which then moves focus here (tabIndex -1).
  // Motion rule 1: an emergency never waits. It renders with no entrance animation and no delay; the other levels
  // fade in once (urgency--enter, 200ms ease-out, styles/components.css).
  return (
    <section
      id="symptom-result"
      tabIndex={-1}
      aria-labelledby="urgency-heading"
      role={
        isEmergency
          ? "alert"
          : undefined
      }
      className={`urgency urgency--${level}${isEmergency ? "" : " urgency--enter"}`}
    >
      {/* The header block, in the level's soft colour: the Held mark (the done ring in the level colour; for an
          emergency the still, danger-coloured urgent mark), the level, how soon, and the engine's action. */}
      <div className="urgency__indicator">
        <HeldMark state={isEmergency ? "urgent" : "done"} size="3.25rem" className="urgency__mark" />
        <div className="urgency__heading-block">
          <h2 id="urgency-heading">
            <UrgencyIcon level={level} />
            <span>
              {preliminary
                ? "Urgency so far"
                : "Urgency"}
              : {result.label}
            </span>
          </h2>
          <p className="urgency__summary">
            <strong>
              {shortAction}
            </strong>
          </p>
          <p className="urgency__timeframe">
            <strong>
              How soon:
            </strong>{" "}
            {result.timeframe}
          </p>
          <p className="urgency__action">
            <strong className="urgency__action-label">
              What to do:
            </strong>{" "}
            {result.action}
          </p>
        </div>
      </div>

      <UrgencyScale level={level} />


      {preliminary && (
        <p>
          Answer the questions below
          to make this more accurate.
        </p>
      )}


      {!preliminary &&
        result.confidence ===
          "refined" && (
          <p>
            Updated using your
            answers.
          </p>
        )}


      <p>
        <ReadAloudButton
          text={spokenResult}
        />
      </p>


      {isEmergency && (
        <p>
          <Button
            variant="danger"
            href="tel:140"
          >
            Call 140 now
          </Button>
        </p>
      )}


      {isSelfHarm && (
        <p>
          <Button
            variant="secondary"
            href="/dashboard#wellbeing-corner-heading"
          >
            View mental health support
          </Button>
        </p>
      )}


      {explanation ? (
        <>
          <UrgencyExplanation
            explanation={
              explanation
            }
            isEmergency={
              isEmergency
            }
            simplified={
              simplified
            }
          />


          {!simplified &&
            result.ai?.used &&
            aiReasons.length >
              0 && (
              <>
                <p className="urgency__label">
                  <strong>
                    What the AI check
                    noted:
                  </strong>
                </p>

                <ul>
                  {aiReasons.map(
                    (reason) => (
                      <li
                        key={
                          reason
                        }
                      >
                        {reason}
                      </li>
                    )
                  )}
                </ul>
              </>
            )}
        </>
      ) : (
        result.reasons?.length >
          0 && (
          <>
            <p className="urgency__why">
              <strong>
                Why:
              </strong>
            </p>

            <ul>
              {result.reasons.map(
                (reason) => (
                  <li
                    key={
                      reason
                    }
                  >
                    {reason}
                  </li>
                )
              )}
            </ul>
          </>
        )
      )}


      {result.selfCareGuidance
        ?.length > 0 && (
        <div className="urgency__card">
          <h3>
            Self-care guidance
          </h3>

          <ul>
            {result.selfCareGuidance.map(
              (item) => (
                <li key={item}>
                  {item}
                </li>
              )
            )}
          </ul>
        </div>
      )}


      <p className="text-sm">
        {result.disclaimer}
      </p>

      <p className="urgency__print">
        <Button variant="secondary" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </p>


      {/* Open the care directory with the server-selected capability filters. */}
      <p>
        <a
          className="button button--primary button--block urgency__find-care"
          href={
            triageProviderUrl(
              result
            )
          }
        >
          {triageProviderLabel(
            result
          )}
        </a>
      </p>
    </section>
  );
}

import Button from "./ui/Button";

import {
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


  return (
    <section
      aria-labelledby="urgency-heading"
      role={
        isEmergency
          ? "alert"
          : "status"
      }
      className={`urgency urgency--${level}`}
    >
      <h2 id="urgency-heading">
        {preliminary
          ? "Urgency so far"
          : "Urgency"}
        : {result.label}
      </h2>


      {simplified && (
        <p className="urgency__summary">
          <strong>
            {shortAction}
          </strong>
        </p>
      )}


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
        <strong>
          How soon:
        </strong>{" "}
        {result.timeframe}
      </p>


      <p>
        <strong>
          What to do:
        </strong>{" "}
        {result.action}
      </p>


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
            result.reasons?.length >
              0 && (
              <>
                <p className="urgency__label">
                  <strong>
                    What the AI check
                    noted:
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
        <div>
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


      <p>
        <Button
          variant="secondary"
          href={
            triageProviderUrl(
              result
            )
          }
        >
          {isEmergency
            ? "Browse published 24/7 ER facilities in Lebanon"
            : "Browse hospitals and clinics in Lebanon"}
        </Button>
      </p>
    </section>
  );
}
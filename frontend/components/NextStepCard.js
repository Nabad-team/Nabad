import Card from "./ui/Card";
import Button from "./ui/Button";
import { basicsFilled } from "../lib/healthProfile";
import { pickNextStep } from "../lib/nextStep";
import { NextStepSkeleton } from "./ui/Skeleton";

// The dashboard's "Next step": one short line and one button for the active profile (lib/nextStep.js picks it).
// It waits until every source has answered, so it never swaps one line for another, and it is hidden when
// nothing applies. While it waits, its place holds grey shapes (aria-hidden: Your progress announces the loading). It sits under the email bar and the page title, above Symptom check, and never above or
// instead of an emergency message.
//   data: useDashboardData()   forName: the linked profile's first name, "" for the user's own profile
export default function NextStepCard({ data, forName = "", now }) {
  if (!data) return null;
  if (!data.loaded) return <div className="skeleton" aria-hidden="true"><NextStepSkeleton /></div>;
  const step = pickNextStep({
    medications: data.medications,
    appointments: data.appointments,
    basicsFilled: data.health ? basicsFilled(data.health) : null,
    wellbeing: data.wellbeing,
    forName,
    now,
  });
  if (!step) return null;
  // "Take Aspirin 81 mg at 08:00": the time sits in a mono chip; "at" stays in the sentence for screen readers.
  const timed = TIMED.exec(step.text);
  return (
    <Card className="next-step" aria-labelledby="next-step-heading">
      <div className="next-step__copy">
        <h2 id="next-step-heading" className="next-step__label">Next step</h2>
        <p className="next-step__text">
          {timed ? <>{timed[1]}<span className="visually-hidden"> at</span> <span className="next-step__time num">{timed[2]}</span></> : step.text}
        </p>
      </div>
      <Button href={step.href}>{step.action}</Button>
    </Card>
  );
}

const TIMED = /^(.*) at (\d{1,2}:\d{2})$/;

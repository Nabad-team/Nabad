import Card from "./ui/Card";
import Button from "./ui/Button";
import { basicsFilled } from "../lib/healthProfile";
import { pickNextStep } from "../lib/nextStep";

// The dashboard's "Next step": one short line and one button for the active profile (lib/nextStep.js picks it).
// It waits until every source has answered, so it never swaps one line for another, and it is hidden when
// nothing applies. It sits under the email bar and the page title, above Symptom check, and never above or
// instead of an emergency message.
//   data: useDashboardData()   forName: the linked profile's first name, "" for the user's own profile
export default function NextStepCard({ data, forName = "", now }) {
  if (!data?.loaded) return null;
  const step = pickNextStep({
    medications: data.medications,
    appointments: data.appointments,
    basicsFilled: data.health ? basicsFilled(data.health) : null,
    wellbeing: data.wellbeing,
    forName,
    now,
  });
  if (!step) return null;
  return (
    <Card className="next-step" aria-labelledby="next-step-heading">
      <div className="next-step__copy">
        <h2 id="next-step-heading" className="next-step__label">Next step</h2>
        <p className="next-step__text">{step.text}</p>
      </div>
      <Button variant="secondary" href={step.href}>{step.action}</Button>
    </Card>
  );
}

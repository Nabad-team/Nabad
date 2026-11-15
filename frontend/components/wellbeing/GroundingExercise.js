import { useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import { GROUNDING_STEPS } from "../../lib/wellbeingExercises";

// "5, 4, 3, 2, 1": one step at a time with Back and Next. Nothing is typed or saved. Moving between steps puts
// focus on the step's text, so a screen reader reads the new step.
//   onComplete: called on the last step's Finish (the 5-minute reset moves on); without it, the end offers Start again.
export default function GroundingExercise({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const stepRef = useRef(null);
  const moved = useRef(false);

  useEffect(() => {
    if (moved.current) stepRef.current?.focus();
  }, [index, done]);

  function go(next) {
    moved.current = true;
    setIndex(next);
  }
  function finish() {
    moved.current = true;
    if (onComplete) onComplete();
    else setDone(true);
  }

  if (done) {
    return (
      <div className="grounding">
        <p ref={stepRef} tabIndex={-1} className="exercise__done">You&apos;ve finished the grounding exercise. Notice how you feel now.</p>
        <Button variant="secondary" onClick={() => { setDone(false); go(0); }}>Start again</Button>
      </div>
    );
  }

  const step = GROUNDING_STEPS[index];
  const last = index === GROUNDING_STEPS.length - 1;
  return (
    <div className="grounding">
      <p className="text-muted grounding__progress">Step {index + 1} of {GROUNDING_STEPS.length}</p>
      <p ref={stepRef} tabIndex={-1} className="grounding__step">
        <span className="grounding__count" aria-hidden="true">{step.count}</span>
        <span>{step.text}</span>
      </p>
      <p className="text-muted">Take your time. Say them in your head or out loud.</p>
      <div className="button-row">
        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>Back</Button>
        <Button onClick={last ? finish : () => go(index + 1)}>{last ? "Finish" : "Next"}</Button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import BreathingExercise from "./BreathingExercise";
import GroundingExercise from "./GroundingExercise";
import { RESET_STEPS, nextResetStep, reflectionQuestionFor } from "../../lib/wellbeingExercises";

// The 5-minute reset: breathing, then grounding, then the reflection question, in that order, with a simple
// progress list (the current step has aria-current="step") and "Stop the reset" at every step.
//   onStop: closes the reset (the page closes its panel).
export default function ResetExercise({ onStop }) {
  const [step, setStep] = useState(RESET_STEPS[0].key);
  const [done, setDone] = useState(false);
  const focusRef = useRef(null);
  const moved = useRef(false);

  useEffect(() => {
    if (moved.current) focusRef.current?.focus();
  }, [step, done]);

  function advance() {
    moved.current = true;
    const next = nextResetStep(step);
    if (next) setStep(next);
    else setDone(true);
  }

  const index = RESET_STEPS.findIndex((item) => item.key === step);
  return (
    <div className="reset">
      <ol className="reset__progress" aria-label="5-minute reset progress">
        {RESET_STEPS.map((item, position) => {
          const finished = done || position < index;
          const current = !done && position === index;
          return (
            <li key={item.key} aria-current={current ? "step" : undefined}
              className={`reset__step${finished ? " reset__step--done" : ""}${current ? " reset__step--current" : ""}`}>
              {finished && <span className="visually-hidden">Done: </span>}{item.label}
            </li>
          );
        })}
      </ol>
      {done ? (
        <p ref={focusRef} tabIndex={-1} className="exercise__done">You&apos;ve finished the 5-minute reset. Take a moment before you carry on.</p>
      ) : (
        <>
          <h3 ref={focusRef} tabIndex={-1} className="reset__title">Step {index + 1} of {RESET_STEPS.length}: {RESET_STEPS[index].label}</h3>
          {step === "breathing" && <BreathingExercise onComplete={advance} />}
          {step === "grounding" && <GroundingExercise onComplete={advance} />}
          {step === "reflection" && (
            <div className="reflection">
              <p className="reflection__question">{reflectionQuestionFor()}</p>
              <p className="text-muted">Just think about it. Nothing is saved.</p>
              <Button onClick={advance}>Finish</Button>
            </div>
          )}
        </>
      )}
      <div className="button-row reset__stop">
        <Button variant="secondary" onClick={onStop}>{done ? "Close" : "Stop the reset"}</Button>
      </div>
    </div>
  );
}

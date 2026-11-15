import { useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import usePrefersReducedMotion from "./usePrefersReducedMotion";
import { BREATHING_ROUNDS, BREATHING_TOTAL_SECONDS, breathingStateAt } from "../../lib/wellbeingExercises";

// Guided breathing: a circle grows (breathe in, 4 s), stays (hold, 4 s) and shrinks (breathe out, 6 s), nine rounds,
// about 2 minutes, with Start, Pause and Stop.
//   - With "reduce motion" there is no circle: the same steps as text with their countdown.
//   - Screen readers hear each step once: the step line is a polite live region that only changes between steps,
//     and the second-by-second countdown is hidden from them.
//   - Start, Pause and Resume are one button, so focus stays on it; Stop puts the exercise back to the start.
//   onComplete: called once when all rounds are done (the 5-minute reset moves on to grounding).
export default function BreathingExercise({ onComplete }) {
  const reduced = usePrefersReducedMotion();
  const [status, setStatus] = useState("idle"); // idle | running | paused | done
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(null);

  useEffect(() => {
    if (status !== "running") return undefined;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === "running" && elapsed >= BREATHING_TOTAL_SECONDS) {
      setStatus("done");
      onComplete?.();
    }
  }, [elapsed, status]);

  useEffect(() => {
    if (status === "done") doneRef.current?.focus();
  }, [status]);

  const state = breathingStateAt(elapsed);
  const active = status === "running" || status === "paused";

  function toggle() {
    if (status === "running") setStatus("paused");
    else if (status === "paused") setStatus("running");
    else { setElapsed(0); setStatus("running"); }
  }
  function stop() {
    setStatus("idle");
    setElapsed(0);
  }

  // state.done: the time is up; the effect above turns that into "done" right after this render.
  if (status === "done" || state.done) {
    return (
      <div className="breathing">
        <p ref={doneRef} tabIndex={-1} className="exercise__done">You&apos;ve finished the breathing exercise. Take a moment before you carry on.</p>
        {!onComplete && <Button variant="secondary" onClick={() => { setElapsed(0); setStatus("idle"); }}>Start again</Button>}
      </div>
    );
  }

  return (
    <div className={`breathing${reduced ? " breathing--still" : ""}`}>
      {status === "idle" && (
        <p>{reduced
          ? "Follow the steps: breathe in for 4 seconds, hold for 4, and breathe out for 6. About 2 minutes."
          : "Follow the circle: breathe in as it grows, hold, and breathe out as it gets smaller. About 2 minutes."}</p>
      )}
      {/* The circle is there (small) before Start, so the first "Breathe in" visibly grows it. */}
      {!reduced && (
        <div className="breathing__stage" aria-hidden="true">
          <div className={`breathing__circle${active ? ` breathing__circle--${state.phase.key}` : ""}${status === "paused" ? " breathing__circle--paused" : ""}`} />
        </div>
      )}
      {/* Changes only when the step changes, so a screen reader hears "Breathe in", "Hold", "Breathe out" once each. */}
      <p className="breathing__step" aria-live="polite">{active ? (status === "paused" ? "Paused" : state.phase.label) : ""}</p>
      {active && (
        <p className="breathing__count" aria-hidden="true">
          <span className="breathing__seconds">{state.secondsLeft}</span>
          <span className="text-muted"> · Round {state.round} of {BREATHING_ROUNDS}</span>
        </p>
      )}
      <div className="button-row">
        <Button onClick={toggle}>{status === "running" ? "Pause" : status === "paused" ? "Resume" : "Start"}</Button>
        {active && <Button variant="secondary" onClick={stop}>Stop</Button>}
      </div>
    </div>
  );
}

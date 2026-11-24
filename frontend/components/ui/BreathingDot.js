// Breathing, shown by the Held mark's dot alone (no arcs): a pulse-green dot that grows to twice its size and shrinks
// back, on the breathing exercise's real timing: in for 4 seconds, hold for 4, out for 6 (lib/wellbeingExercises.js).
// Only transform animates. With reduced motion the dot stays still (styles/components.css).
//
//   phase:  "in", "hold" or "out" follows the exercise step by step (BreathingExercise). Without it the dot runs the
//           same 14-second cycle on its own (the dashboard and Wellbeing cards).
//   paused: freezes it where it is (the exercise's Pause).
// Decorative (aria-hidden): whatever it means is always written next to it ("In for 4, hold for 4, out for 6").
export const DOT_PHASES = ["in", "hold", "out"];

export default function BreathingDot({ phase, paused = false, size = "3rem", className = "" }) {
  const following = DOT_PHASES.includes(phase);
  const classes = [
    "breathing-dot",
    following ? `breathing-dot--phase breathing-dot--${phase}` : "breathing-dot--cycle",
    paused && "breathing-dot--paused",
    className,
  ].filter(Boolean).join(" ");
  return (
    <svg className={classes} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false"
      data-phase={following ? phase : "cycle"}>
      <circle className="breathing-dot__dot" cx="50" cy="50" r="23" />
    </svg>
  );
}

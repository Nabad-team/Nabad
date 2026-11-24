// Breathing, shown by the Held mark's dot alone (no arcs): a pulse-green dot that grows to twice its size and shrinks
// back, on the breathing exercise's real timing: in for 4 seconds, hold for 4, out for 6 (lib/wellbeingExercises.js).
// Only transform animates. With reduced motion the dot stays still (styles/components.css).
//
//   phase:  "in", "hold" or "out" follows the exercise step by step (BreathingExercise). Without it the dot runs the
//           same 14-second cycle on its own (the dashboard and Wellbeing cards).
//   paused: freezes it where it is (the exercise's Pause).
// Decorative (aria-hidden): whatever it means is always written next to it ("In for 4, hold for 4, out for 6").
export const DOT_PHASES = ["in", "hold", "out"];

// size: the whole drawing; the dot is 46% of it, so 2.5rem gives the 18px resting dot (about 37px at its largest).
export default function BreathingDot({ phase, paused = false, size = "2.5rem", className = "" }) {
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

// The breathing dot inside three soft, still rings (primary-soft tints): the dashboard's "Two minutes to breathe"
// and the Wellbeing page. The dot rests at about 18px and grows to about twice that inside the first ring; the rings
// never move. Decorative, like the dot.
export function BreathingRings({ phase, paused = false, size = "6rem", className = "" }) {
  return (
    <span className={["breathing-rings", className].filter(Boolean).join(" ")} style={{ width: size, height: size }} aria-hidden="true">
      <svg className="breathing-rings__rings" viewBox="0 0 100 100" focusable="false">
        <circle className="breathing-rings__ring breathing-rings__ring--3" cx="50" cy="50" r="49" />
        <circle className="breathing-rings__ring breathing-rings__ring--2" cx="50" cy="50" r="38" />
        <circle className="breathing-rings__ring breathing-rings__ring--1" cx="50" cy="50" r="27" />
      </svg>
      <BreathingDot phase={phase} paused={paused} size="2.5rem" className="breathing-rings__dot" />
    </span>
  );
}

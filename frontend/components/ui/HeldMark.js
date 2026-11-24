// The Held mark: two open arcs around a dot, drawn on a 160x160 grid. The only element in Nabad that moves on its
// own (docs/design-system.md#motion). Only transform and opacity animate, except the "done" ring, which draws closed
// with stroke-dashoffset. With reduced motion every state is still. The keyframes live in styles/components.css.
//
// state:
//   "resting"  the dot beats slowly (2.4s)
//   "thinking" the arcs turn around the dot (1.4s a turn): the loader, always next to a status text (HeldLoader)
//   "done"     a full ring draws closed (600ms)
//   "breathe"  the arcs open and close (10s: open over 4s, close over 6s), in the wellbeing colour. Pass `phase`
//              ("in", "hold" or "out") to follow a breathing exercise step by step instead of the free 10s cycle.
//   "urgent"   arcs in the danger colour and a fast beat (0.6s). Only ever on an emergency result.
// The mark is decorative (aria-hidden): whatever it means must also be written next to it.

export const HELD_STATES = ["resting", "thinking", "done", "breathe", "urgent"];
const LEFT_ARC = "M64 24 A56 56 0 0 0 64 136";
const RIGHT_ARC = "M96 24 A56 56 0 0 1 96 136";

export default function HeldMark({ state = "resting", phase, paused = false, size = "3rem", className = "" }) {
  const current = HELD_STATES.includes(state) ? state : "resting";
  const classes = [
    "held",
    `held--${current}`,
    current === "breathe" && phase && `held--phase held--phase-${phase}`,
    paused && "held--paused",
    className,
  ].filter(Boolean).join(" ");
  return (
    <svg className={classes} width={size} height={size} viewBox="0 0 160 160" fill="none" strokeLinecap="round"
      aria-hidden="true" focusable="false" data-state={current}>
      <g className="held__arcs" strokeWidth="15">
        <path className="held__arc held__arc--left" d={LEFT_ARC} />
        <path className="held__arc held__arc--right" d={RIGHT_ARC} />
      </g>
      {current === "done" && <circle className="held__ring" cx="80" cy="80" r="56" strokeWidth="15" pathLength="100" />}
      <circle className="held__dot" cx="80" cy="80" r="18" />
    </svg>
  );
}

// The loading state: the thinking mark with a visible status text, announced to screen readers (role="status").
export function HeldLoader({ label }) {
  return (
    <div className="loader held-loader" role="status">
      <HeldMark state="thinking" size="2.75rem" />
      <span>{label}</span>
    </div>
  );
}

// The Nabad assistant: a small friendly face drawn from the logo's pulse line ("Pulse peek": the big beat of the
// heartbeat becomes a rounded head peeking up). Same style as the illustrations: teal line, round ends, no fills;
// the eyes and smile use the darker heading teal.
//
// Calm places ONLY: onboarding, empty states, the health assistant greeting and the symptom-check loader.
// Never on urgent or emergency results, the emergency card, or any "Call 140" screen. (docs/design-system.md)
//
// crop="full": the whole pulse line with the head (about 4rem and up).
// crop="head": cropped to the head with bigger eyes and a thicker line, so the face stays readable at 2-3rem.
const LINE = "M6 88H24L28 82L32 88H38C38 42 98 42 98 88H114";
const SMILE = "M60 78C64 83 72 83 76 78";
const CROPS = {
  full: { viewBox: "0 0 120 120", line: 2.5, eyes: 7.5, smile: 2.5 },
  head: { viewBox: "33 38 70 62", line: 4.5, eyes: 10, smile: 4.5 },
};

export default function NabadAssistant({ size = "4.5rem", crop = "full", title, tracing = false, className = "" }) {
  const { viewBox, line, eyes, smile } = CROPS[crop] || CROPS.full;
  return (
    <svg
      className={["nabad-assistant", tracing && "nabad-assistant--tracing", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path className="nabad-assistant__line" d={LINE} strokeWidth={line} pathLength="100" />
      <path className="nabad-assistant__face" d="M58 69h0M78 69h0" strokeWidth={eyes} />
      <path className="nabad-assistant__face" d={SMILE} strokeWidth={smile} />
    </svg>
  );
}

// The symptom-check loading state: the assistant's pulse line draws itself, in the brand teal. With reduced motion
// the drawing stays still. role="status" with visible text, so screen readers announce the label.
export function AssistantLoader({ label }) {
  return (
    <div className="loader assistant-loader" role="status">
      <NabadAssistant size="3rem" crop="head" tracing />
      <span>{label}</span>
    </div>
  );
}

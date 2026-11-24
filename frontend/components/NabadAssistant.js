import HeldMark from "./ui/HeldMark";

// The Nabad assistant. Since the "Held" refresh (Phase 2) the illustrated mascot is retired: the assistant is the
// Held mark at rest (docs/design-system.md#the-held-mark). The props stay the same, so callers keep working.
//
// Calm places ONLY: onboarding, empty states and the health assistant greeting.
// Never on urgent or emergency results, the emergency card, or any "Call 140" screen. (docs/design-system.md)
//
//   size:    the mark's width and height (4.5rem by default)
//   title:   its accessible name ("Nabad assistant") where it carries meaning; without one it is decorative
//   tracing: true shows the thinking state (the arcs turn) instead of resting
//   crop:    kept for compatibility ("full" or "head"); the Held mark reads the same at every size
export default function NabadAssistant({ size = "4.5rem", crop = "full", title, tracing = false, className = "" }) {
  return (
    <HeldMark
      state={tracing ? "thinking" : "resting"}
      size={size}
      title={title}
      className={["nabad-assistant", crop === "head" && "nabad-assistant--head", className].filter(Boolean).join(" ")}
    />
  );
}

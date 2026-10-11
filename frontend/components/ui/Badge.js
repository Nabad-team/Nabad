// A small, calm label, e.g. "Coming soon" next to a heading or "Active" on a medication. Never red:
// it gives information, it is not a warning.
//   tone: "info" (teal on light teal, the default) or "neutral" (gray, for things that are no longer current).
export default function Badge({ tone = "info", className = "", children, ...props }) {
  return (
    <span className={["badge", tone !== "info" && `badge--${tone}`, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}

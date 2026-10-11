// A small, calm label next to a heading, e.g. "Coming soon". Teal on light teal, never red:
// it gives information, it is not a warning.
export default function Badge({ className = "", children, ...props }) {
  return (
    <span className={["badge", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}

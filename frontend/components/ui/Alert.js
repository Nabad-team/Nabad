// A banner with a colored left edge. tone: "info" (teal), "success", "warning", "danger"
// (errors and emergencies only) or "note" (terracotta, for an important reminder).
// Pass role="alert" for errors that need attention now, role="status" for calm updates.
// The text always says what happened, so color is never the only signal.
export default function Alert({ tone = "info", title, as: Tag = "div", className = "", children, ...props }) {
  return (
    <Tag className={["alert", `alert--${tone}`, className].filter(Boolean).join(" ")} {...props}>
      {title && <strong className="alert__title">{title}</strong>}
      {children}
    </Tag>
  );
}

// A quiet box that groups related things. Use it only when grouping helps; most content
// should sit directly on the page. tone="danger" outlines it in red for destructive settings.
export default function Card({ as: Tag = "section", tone, className = "", ...props }) {
  return <Tag className={["card", tone && `card--${tone}`, className].filter(Boolean).join(" ")} {...props} />;
}

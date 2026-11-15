// The white surface the dashboard uses. Signed-in page content sits in cards (see "Card" in
// docs/design-system.md). tone="danger" outlines it in red for destructive settings.
export default function Card({ as: Tag = "section", tone, className = "", ...props }) {
  return <Tag className={["card", tone && `card--${tone}`, className].filter(Boolean).join(" ")} {...props} />;
}

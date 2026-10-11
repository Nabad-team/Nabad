// Shown where a list or area has nothing in it yet: a small drawing, a short sentence,
// and (when there is one) the next step.
export default function EmptyState({ illustration, title, children, action }) {
  return (
    <div className="empty-state">
      {illustration}
      <div>
        <p className="empty-state__title">{title}</p>
        {children && <p className="empty-state__text">{children}</p>}
        {action}
      </div>
    </div>
  );
}

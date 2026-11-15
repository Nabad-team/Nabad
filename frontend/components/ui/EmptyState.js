import { Clipboard } from "../illustrations";

// The one empty state for a list or area with nothing in it yet: a small drawing, one line, and (when there
// is one) one button for the next step. Write the line as one sentence that says what's missing and what to do.
//   title:        the one line, e.g. "No appointments yet: add your next visit so Nabad can remind you."
//   illustration: a drawing from components/illustrations.js at 4rem (the clipboard by default); null for none.
//   action:       one <Button>.
export default function EmptyState({ illustration, title, action }) {
  const drawing = illustration === undefined ? <Clipboard size="4rem" /> : illustration;
  return (
    <div className="empty-state">
      {drawing}
      <div className="empty-state__body">
        <p className="empty-state__title">{title}</p>
        {action}
      </div>
    </div>
  );
}

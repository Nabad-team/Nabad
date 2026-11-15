import { useEffect, useRef } from "react";
import Card from "./Card";

// A form that opens in place, under the page header, when its page's primary button is pressed
// ("Log reading", "Add documents"). The page shows its data first; this panel only exists while open.
//   id:            the panel's id, for the opening button's aria-controls
//   title:         the panel's h2
//   onClose:       called on Escape (the page also closes it on Cancel and after saving)
//   returnFocusTo: a ref to the button that opened it; focus goes back there when the panel closes
// Opening moves focus to the first field, so keyboard and screen reader users land in the form.
export default function InlinePanel({ id, title, onClose, returnFocusTo, children }) {
  const panelRef = useRef(null);
  const headingId = `${id}-heading`;

  useEffect(() => {
    const panel = panelRef.current;
    const first = panel?.querySelector("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)");
    (first || panel?.querySelector("h2"))?.focus();
    const target = returnFocusTo;
    return () => {
      // After the panel is gone, put focus back where the person started (if it was inside the panel).
      const button = target?.current;
      if (button && (!document.activeElement || document.activeElement === document.body)) button.focus();
    };
  }, [returnFocusTo]);

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <Card id={id} ref={panelRef} className="inline-panel" aria-labelledby={headingId} onKeyDown={onKeyDown}>
      <h2 id={headingId} tabIndex={-1}>{title}</h2>
      {children}
    </Card>
  );
}

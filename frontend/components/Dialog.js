import { useEffect, useId, useRef } from "react";

// A simple in-page pop-up: a dimmed overlay covering the page with a box in the middle.
// role="dialog" and aria-modal tell screen readers (and our tests) that this is a dialog.
// Styles: .dialog-overlay and .dialog in styles/components.css.
export default function Dialog({ title, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])");
    if (dialog && !dialog.contains(document.activeElement)) (focusable || dialog).focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  function containFocus(event) {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")];
    if (!controls.length) { event.preventDefault(); event.currentTarget.focus(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="dialog-overlay">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="dialog" tabIndex="-1" onKeyDown={containFocus}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

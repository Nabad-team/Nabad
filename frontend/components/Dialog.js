import { useEffect, useId, useRef } from "react";

// The native top layer makes the background inert to pointer, keyboard and AT.
// Controlled dismissal keeps component state and the browser's open state in sync.
export default function Dialog({ title, children, onDismiss }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const focusable = dialog?.querySelector("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])");
    if (dialog && !dialog.contains(document.activeElement)) (focusable || dialog).focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
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
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="dialog app-dialog" tabIndex="-1" onKeyDown={containFocus}
      onCancel={event => { event.preventDefault(); onDismiss?.(); }}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

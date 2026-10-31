import { useEffect, useId, useRef } from "react";
import Button from "./ui/Button";

// Native modal dialogs keep keyboard focus inside and make the background inert.
// This is an in-app alert: it needs no browser notification permission.
export default function EmergencyAlert({ result, onDismiss }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const id = useId();
  const localNumberUnknown = result.emergency?.contactNumber === null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    headingRef.current.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className="dialog emergency-popup" role="alertdialog"
    aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-instructions`}
    onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <h2 id={`${id}-title`} tabIndex={-1} ref={headingRef}>Emergency detected</h2>
    <p id={`${id}-instructions`}>
      {localNumberUnknown
        ? "Call your local emergency number now. Do not wait for symptoms to improve."
        : "Call 140 (Lebanese Red Cross) now. Do not wait for symptoms to improve."}
    </p>
    <p>The emergency guidance will stay on this page after you close this alert.</p>
    <div className="dialog__actions">
      {!localNumberUnknown && <Button variant="danger" href="tel:140">Call 140 (Lebanese Red Cross)</Button>}
      <Button variant="secondary" onClick={onDismiss}>Close alert</Button>
    </div>
  </dialog>;
}

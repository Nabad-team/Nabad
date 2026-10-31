import { useEffect, useId, useRef } from "react";
import EmergencyLocationShare from "./EmergencyLocationShare";
import { contactNumber } from "../lib/emergencyLocation";
import Button from "./ui/Button";

// Native modal dialogs keep keyboard focus inside and make the background inert.
// This is an in-app alert: it needs no browser notification permission.
export default function EmergencyAlert({ result, onDismiss, profileId, contact, contactLoading, contactError, onRetryContact }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const id = useId();
  const localNumberUnknown = result.emergency?.contactNumber === null;
  const savedNumber = contactNumber(contact?.phone);

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
    {profileId && <section className="emergency-saved-contact" aria-labelledby={`${id}-contact`}>
      <h3 id={`${id}-contact`}>Saved emergency contact</h3>
      {contactLoading ? <p role="status">Loading emergency contact...</p>
        : contactError ? <><p role="alert">Your emergency contact couldn't be loaded. You can still call emergency services.</p><Button variant="secondary" onClick={onRetryContact}>Retry emergency contact</Button></>
          : contact && savedNumber ? <>
            <p><strong>{contact.name}</strong><br />{savedNumber}</p>
            <Button variant="secondary" href={`tel:${savedNumber}`}>Call {contact.name} (emergency contact)</Button>
            <EmergencyLocationShare profileId={profileId} contact={contact} onRetry={onRetryContact} />
          </> : <>
            <p>No emergency contact with a valid phone number is saved for this profile.</p>
            {profileId === "self" && <Button variant="secondary" href="/profile">Add an emergency contact</Button>}
          </>}
    </section>}
  </dialog>;
}

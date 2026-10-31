import { useEffect, useId, useRef, useState } from "react";
import Button from "./ui/Button";
import { contactNumber, locationSnapshot, locationSmsUrl, LOCATION_LIFETIME_MS } from "../lib/emergencyLocation";

export default function EmergencyLocationShare({ profileId, contact, loading, error, onRetry }) {
  const [fix, setFix] = useState(null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const requestRef = useRef(0);
  const inputRef = useRef(null);
  const id = useId();
  const number = contactNumber(contact?.phone);
  useEffect(() => {
    requestRef.current += 1;
    setFix(null); setLocating(false); setProblem(""); setCopyStatus("");
    return () => { requestRef.current += 1; };
  }, [profileId, contact?.phone]);

  useEffect(() => {
    if (!fix) return;
    const remaining = Math.min(LOCATION_LIFETIME_MS, Date.parse(fix.capturedAt) + LOCATION_LIFETIME_MS - Date.now());
    const timer = setTimeout(() => {
      requestRef.current += 1;
      setFix(null); setCopyStatus("");
      setProblem("This location has expired. Get a fresh location before sharing.");
    }, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [fix]);

  function locate() {
    const request = ++requestRef.current;
    setFix(null); setProblem(""); setCopyStatus(""); setLocating(true);
    const fail = message => { if (request === requestRef.current) { setLocating(false); setProblem(message); } };
    if (!navigator.geolocation) return fail("This browser cannot get your location. You can still call emergency services.");
    try { navigator.geolocation.getCurrentPosition(position => {
      if (request !== requestRef.current) return;
      try { setFix(locationSnapshot(position)); setLocating(false); }
      catch { fail("A fresh location could not be determined. Please try again."); }
    }, error => fail(error.code === 1
      ? "Location access was denied. Enable it in your browser settings and try again, or call emergency services."
      : error.code === 3 ? "Finding your location took too long. Try again or call emergency services."
        : "Your location is unavailable. Try again or call emergency services."),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    } catch { fail("Location access is unavailable in this browser. You can still call emergency services."); }
  }

  async function copy() {
    const request = requestRef.current;
    try {
      await navigator.clipboard.writeText(fix.url);
      if (request === requestRef.current) setCopyStatus("Location link copied. Paste it into a message to your emergency contact.");
    } catch {
      if (request !== requestRef.current) return;
      inputRef.current?.focus(); inputRef.current?.select();
      setCopyStatus("Copying is unavailable. Select and copy the location link below.");
    }
  }
  const appleMobile = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  return <section className="emergency-location" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Share your location</h3>
    {loading ? <p role="status">Loading emergency contact...</p>
      : error ? <><p role="alert">Your emergency contact couldn't be loaded.</p><Button variant="secondary" onClick={onRetry}>Retry emergency contact</Button></>
        : !contact || !number ? <><p>No emergency contact with a valid phone number is saved for this profile.</p>
          {profileId === "self" && <Button variant="secondary" href="/profile">Add an emergency contact</Button>}</>
          : <>
            <p>Share this device's current location with <strong>{contact.name}</strong> ({number}). This is a one-time location, not live tracking.</p>
            <Button variant="secondary" disabled={locating} onClick={locate}>{locating ? "Finding your location..." : fix ? "Get updated location" : `Share my location with ${contact.name}`}</Button>
            {problem && <p role="alert">{problem}</p>}
            {fix && <div>
              <p>Captured {new Date(fix.capturedAt).toLocaleTimeString()}{fix.accuracy === null ? "" : ` · Accuracy about ${fix.accuracy} m`}</p>
              <p>Open a text-message draft, then review and send it in your messaging app. Nabad does not send a message or confirm delivery.</p>
              <div className="dialog__actions">
                <Button variant="secondary" href={locationSmsUrl(number, fix, appleMobile)}>Text location to {contact.name}</Button>
                <Button variant="secondary" onClick={copy}>Copy location link</Button>
              </div>
              <label className="field__label" htmlFor={`${id}-link`}>Location link</label>
              <input className="input" id={`${id}-link`} ref={inputRef} readOnly value={fix.url} />
              {copyStatus && <p role="status">{copyStatus}</p>}
            </div>}
          </>}
  </section>;
}

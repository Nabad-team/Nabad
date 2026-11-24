import { useRef, useState } from "react";
import HeldIcon from "./ui/HeldIcon";
import { HealthTilesSkeleton, SkeletonRegion } from "./ui/Skeleton";
import { basicsFilled, BASICS } from "../lib/healthProfile";
import { formatDate, todayString } from "../lib/dates";
import { setMedicationTaken } from "../lib/medicationApi";
import { doneCount, emergencyCardHasContent } from "../lib/gettingStarted";

// The dashboard's "Your health" section (docs/design-system.md#tiles): six regular tiles in an even grid (2 columns
// on phones, 3 from 40rem, so rows are always full), each an icon in a small primary-soft square, a title and ONE
// status line (it may wrap to two lines), the whole tile a link. Then the Emergency card as one full-width special
// tile. Say each thing once: today's water and sleep are in Your day above.
//
// Getting started lives here too: while it applies, the first steps that aren't done carry a small "To do" tag on
// their tile, and the heading row shows a small setup ring, "Setup 2/4" and a quiet "Hide". When all are done the
// tags, the ring and the text go.
//
//   data:       useDashboardData()
//   firstSteps: useFirstSteps(), the first steps hook the dashboard shares with Next step
//   forName:    the linked profile's first name, "" for your own
export function healthTiles(data, steps) {
  const { health, medications, symptoms, appointments } = data;
  const todo = Object.fromEntries((steps || []).filter((step) => !step.done).map((step) => [step.key, step.text]));
  const filled = health ? basicsFilled(health) : null;
  const nextAppointment = appointments?.map((appointment) => ({
    ...appointment,
    dateTime: new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`),
  })).filter((appointment) => appointment.dateTime >= new Date()).sort((a, b) => a.dateTime - b.dateTime)[0];
  const unavailable = "Couldn't load";
  const taken = medications?.filter((medication) => medication.taken).length || 0;
  return [
    {
      key: "health", icon: "health", title: "My health", href: "/my-health", todo: todo.health,
      status: data.healthFailed ? unavailable : filled === null ? "" : filled === BASICS.length ? `All ${BASICS.length} basics` : `${filled} of ${BASICS.length} basics`,
    },
    {
      key: "medication", icon: "medicine", title: "Medicines", href: "/medications", todo: todo.medication,
      status: data.medicationsFailed ? unavailable : !medications ? "" : !medications.length ? "No active medicines"
        : taken === medications.length ? "All taken today" : `${taken} of ${medications.length} taken today`,
    },
    {
      key: "appointments", icon: "calendar", title: "Appointments", href: "/appointments",
      status: data.appointmentsFailed ? unavailable : !appointments ? "" : nextAppointment
        ? `${nextAppointment.title} · ${formatDate(nextAppointment.appointmentDate)} at ${nextAppointment.appointmentTime}${nextAppointment.hospital ? `, ${nextAppointment.hospital}` : ""}`
        : "None coming up",
    },
    { key: "vitals", icon: "vitals", title: "Vitals", href: "/vitals", status: "Log a reading" },
    { key: "documents", icon: "document", title: "Documents", href: "/medical-documents", status: "Upload or view" },
    {
      key: "symptoms", icon: "history", title: "Symptom checks", href: symptoms?.length ? "/my-history" : "/symptoms", todo: todo.symptoms,
      status: data.symptomsFailed ? unavailable : !symptoms ? "" : !symptoms.length ? "No checks yet" : `${symptoms.length} saved`,
    },
  ];
}

// The Emergency card tile: full width after the six, a soft danger outline, one line saying what it is for.
export function emergencyTile(data, steps) {
  const step = (steps || []).find((item) => item.key === "emergency-card" && !item.done);
  return {
    key: "emergency-card", icon: "emergencyCard", title: "Emergency card", href: "/emergency-card", todo: step?.text,
    status: "Your key info for a doctor, even offline",
    // Said to screen readers: whether it is ready (the eye gets the To do tag while the first steps apply).
    state: data.emergencyCardFailed || !data.emergencyCard ? "" : emergencyCardHasContent(data.emergencyCard) ? "Ready to show" : "Not set up",
  };
}

// One tile: the whole tile is the link.
function Tile({ tile, forName, wide = false }) {
  return (
    <li className={`tile-grid__item${wide ? " tile-grid__item--wide" : ""}`}>
      <a href={tile.href} className={`tile${wide ? " tile--emergency" : ""}${tile.todo ? " tile--todo" : ""}`} data-tile={tile.key}>
        <span className="tile__icon"><HeldIcon name={tile.icon} size="1.25rem" /></span>
        <span className="tile__text">
          <span className="tile__title">{tile.title}{forName && tile.key === "health" ? <span className="visually-hidden"> for {forName}</span> : null}</span>
          <span className="tile__status">{tile.status || <span className="visually-hidden">Loading</span>}{tile.state ? <span className="visually-hidden">. {tile.state}</span> : null}</span>
        </span>
        {tile.todo && <span className="tile__tag">To do<span className="visually-hidden">: {tile.todo}</span></span>}
      </a>
    </li>
  );
}

// The setup ring: pulse green on a stone track, decorative (the text next to it says the same).
function SetupRing({ done, total }) {
  const circumference = 2 * Math.PI * 9;
  return (
    <svg className="setup-ring" width="1.5rem" height="1.5rem" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle className="setup-ring__track" cx="12" cy="12" r="9" />
      <circle className="setup-ring__value" cx="12" cy="12" r="9" strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - done / total)} transform="rotate(-90 12 12)" />
    </svg>
  );
}

export default function YourHealth({ data, firstSteps, forName = "" }) {
  const { profileId, profileRef, medications, setMedications } = data;
  const [saving, setSaving] = useState(null);
  const [medicationError, setMedicationError] = useState("");
  const pending = useRef(null);
  // A profile switch drops a pending check-in and its message.
  const shownProfile = useRef(profileId);
  if (shownProfile.current !== profileId) {
    shownProfile.current = profileId;
    pending.current = null;
    if (saving !== null) setSaving(null);
    if (medicationError) setMedicationError("");
  }

  // Today's check-in for the next medicine, straight from the dashboard (saved at once, rolled back if it fails).
  async function toggleMedication(medication) {
    if (pending.current || !medication) return;
    const requested = profileId;
    const operation = {};
    pending.current = operation;
    const taken = !medication.taken;
    setSaving(medication.id);
    setMedicationError("");
    setMedications((current) => current?.map((item) => item.id === medication.id ? { ...item, taken } : item) || current);
    try {
      await setMedicationTaken(requested, medication.id, todayString(), taken);
    } catch {
      if (profileRef.current !== requested || pending.current !== operation) return;
      setMedications((current) => current?.map((item) => item.id === medication.id ? { ...item, taken: medication.taken } : item) || current);
      setMedicationError("We couldn't update today's medication check-in. Please try again.");
    } finally {
      if (pending.current === operation) { pending.current = null; setSaving(null); }
    }
  }

  if (!data.loaded || !data.startLoaded) return <SkeletonRegion label="Loading your health..."><HealthTilesSkeleton /></SkeletonRegion>;

  const steps = firstSteps.showStart ? firstSteps.steps : null;
  const tiles = healthTiles(data, steps);
  const emergency = emergencyTile(data, steps);
  const nextMedication = medications?.find((medication) => !medication.taken) || medications?.[0];
  const done = steps ? doneCount(steps) : 0;

  return (
    <section className="section your-health" aria-labelledby="your-health-heading">
      <div className="your-health__header">
        <h2 id="your-health-heading">Your health</h2>
        {steps && (
          <p className="your-health__setup">
            <SetupRing done={done} total={steps.length} />
            <span>Setup <span aria-hidden="true">{done}/{steps.length}</span><span className="visually-hidden">{forName ? ` for ${forName}` : ""}: {done} of {steps.length} first steps done</span></span>
            <button type="button" className="link-button your-health__hide" onClick={firstSteps.hide} disabled={firstSteps.hiding} aria-describedby="getting-started-hide-hint">Hide</button>
            <span id="getting-started-hide-hint" className="visually-hidden">Hides the first steps for good. Every page stays in the menu.</span>
          </p>
        )}
      </div>
      {firstSteps.error && <p className="text-muted" role="alert">{firstSteps.error}</p>}
      <ul className="tile-grid">
        {tiles.map((tile) => <Tile key={tile.key} tile={tile} forName={forName} />)}
        <Tile tile={emergency} forName={forName} wide />
      </ul>
      {nextMedication && (
        <p className="your-health__action">
          <button type="button" className="link-button" onClick={() => toggleMedication(nextMedication)} disabled={!!saving}>
            {`${nextMedication.taken ? "Undo taken" : "Mark taken"}: ${nextMedication.name}`}
          </button>
        </p>
      )}
      {medicationError && <p className="text-muted" role="alert">{medicationError}</p>}
    </section>
  );
}

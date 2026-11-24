import { useRef, useState } from "react";
import HeldIcon from "./ui/HeldIcon";
import { HealthTilesSkeleton, SkeletonRegion } from "./ui/Skeleton";
import { basicsFilled, BASICS } from "../lib/healthProfile";
import { formatDate, todayString } from "../lib/dates";
import { setMedicationTaken } from "../lib/medicationApi";
import { emergencyCardHasContent, progressText } from "../lib/gettingStarted";

// The dashboard's "Your health" section (docs/design-system.md#tiles): one grid of small tiles, each an icon, a
// title and ONE status line, the whole tile a link. Say each thing once: water, sleep and today's medicines count
// are in Your day above, so the tiles don't repeat them.
//
// Getting started lives here too: while it applies, the first steps that aren't done carry a small "To do" tag on
// their tile, and the header says how many are done with a small "Hide". When all four are done the tags go.
//
//   data:       useDashboardData()
//   firstSteps: useFirstSteps(), the first steps hook the dashboard shares with Next step
//   forName:    the linked profile's first name, "" for your own
export function healthTiles(data, steps) {
  const { health, medications, symptoms, appointments, emergencyCard } = data;
  const todo = Object.fromEntries((steps || []).filter((step) => !step.done).map((step) => [step.key, step.text]));
  const filled = health ? basicsFilled(health) : null;
  const nextAppointment = appointments?.map((appointment) => ({
    ...appointment,
    dateTime: new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`),
  })).filter((appointment) => appointment.dateTime >= new Date()).sort((a, b) => a.dateTime - b.dateTime)[0];
  const unavailable = "Couldn't load";
  const untaken = medications?.find((medication) => !medication.taken);
  return [
    {
      key: "health", icon: "health", title: "My health", href: "/my-health", todo: todo.health,
      status: data.healthFailed ? unavailable : filled === null ? "" : filled === BASICS.length ? `All ${BASICS.length} basics` : `${filled} of ${BASICS.length} basics`,
    },
    {
      key: "medication", icon: "medicine", title: "Medicines", href: "/medications", todo: todo.medication,
      // "1 of 2 taken today" is in Your day; the tile says what's next.
      status: data.medicationsFailed ? unavailable : !medications ? "" : !medications.length ? "No active medicines"
        : untaken ? `Next: ${untaken.name}` : "All taken today",
    },
    {
      key: "symptoms", icon: "history", title: "Symptom checks", href: symptoms?.length ? "/my-history" : "/symptoms", todo: todo.symptoms,
      status: data.symptomsFailed ? unavailable : !symptoms ? "" : !symptoms.length ? "No checks yet" : `${symptoms.length} saved`,
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
      key: "emergency-card", icon: "emergencyCard", title: "Emergency card", href: "/emergency-card", todo: todo["emergency-card"],
      status: data.emergencyCardFailed ? unavailable : !emergencyCard ? "" : emergencyCardHasContent(emergencyCard) ? "Ready to show" : "Not set up",
    },
  ];
}

// One tile: the whole tile is the link. The status line is one line (truncated); its full text stays in the link's
// accessible name.
function Tile({ tile, forName }) {
  return (
    <li className="tile-grid__item">
      <a href={tile.href} className={`tile${tile.todo ? " tile--todo" : ""}`} data-tile={tile.key}>
        <span className="tile__icon"><HeldIcon name={tile.icon} size="1.375rem" /></span>
        <span className="tile__title">{tile.title}{forName && tile.key === "health" ? <span className="visually-hidden"> for {forName}</span> : null}</span>
        <span className="tile__status">{tile.status || <span className="visually-hidden">Loading</span>}</span>
        {tile.todo && <span className="tile__tag">To do<span className="visually-hidden">: {tile.todo}</span></span>}
      </a>
    </li>
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
  const nextMedication = medications?.find((medication) => !medication.taken) || medications?.[0];

  return (
    <section className="section your-health" aria-labelledby="your-health-heading">
      <div className="your-health__header">
        <h2 id="your-health-heading">Your health</h2>
        {steps && (
          <p className="your-health__start">
            <span>First steps{forName ? ` for ${forName}` : ""}: {progressText(steps)}</span>
            <button type="button" className="link-button" onClick={firstSteps.hide} disabled={firstSteps.hiding} aria-describedby="getting-started-hide-hint">Hide</button>
          </p>
        )}
      </div>
      {steps && (
        <>
          <p className="text-muted text-sm your-health__why">Health basics, a medication, a symptom check and {forName ? `${forName}'s` : "your"} emergency card help Nabad give safer guidance, ready for a doctor or an emergency.</p>
          <p id="getting-started-hide-hint" className="visually-hidden">Hides the first steps for good. Every page stays in the menu.</p>
        </>
      )}
      {firstSteps.error && <p className="text-muted" role="alert">{firstSteps.error}</p>}
      <ul className="tile-grid">
        {tiles.map((tile) => <Tile key={tile.key} tile={tile} forName={forName} />)}
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

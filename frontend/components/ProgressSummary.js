import { useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { basicsFilled } from "../lib/healthProfile";
import { formatDate, todayString } from "../lib/dates";
import { setMedicationTaken } from "../lib/medicationApi";
import useDashboardData from "./useDashboardData";
import { SkeletonRegion, ProgressSkeleton, LinesSkeleton } from "./ui/Skeleton";
import { hoursText, litresText, sleptText } from "../lib/wellbeing";

function ProgressItem({ label, summary, status, detail, href, linkLabel, onAction, actionLabel, actionDisabled = false }) {
  return (
    <li className="progress-summary__item">
      <div className="progress-summary__copy">
        <h3>{label}</h3>
        <p>{summary}</p>
        <p className="progress-summary__status">{status}</p>
        <p className="text-muted">{detail}</p>
        {onAction && <Button type="button" variant="secondary" onClick={onAction} disabled={actionDisabled}>{actionLabel}</Button>}
        <Button variant="secondary" href={href}>{linkLabel}</Button>
      </div>
    </li>
  );
}

// data: the dashboard's shared data (useDashboardData). Without it, the summary loads its own.
export default function ProgressSummary({ data }) {
  const { activeProfile } = useActiveProfile();
  const own = useDashboardData(data ? null : activeProfile?.id);
  const { profileId, profileRef, health, wellbeing, medications, setMedications, appointments, healthFailed, wellbeingFailed, medicationsFailed, appointmentsFailed, loaded } = data || own;
  const who = activeProfile && !activeProfile.isSelf ? activeProfile.fullName : null;
  const [savingMedication, setSavingMedication] = useState(null);
  const [medicationError, setMedicationError] = useState("");
  const pendingMedication = useRef(null);
  // A profile switch drops a pending check-in and its message.
  const shownProfile = useRef(profileId);
  if (shownProfile.current !== profileId) {
    shownProfile.current = profileId;
    pendingMedication.current = null;
    if (savingMedication !== null) setSavingMedication(null);
    if (medicationError) setMedicationError("");
  }

  async function toggleMedication(medication) {
    if (pendingMedication.current || !medication) return;
    const requested = profileId;
    const operation = {};
    pendingMedication.current = operation;
    const taken = !medication.taken;
    setSavingMedication(medication.id);
    setMedicationError("");
    setMedications((current) => current?.map((item) => item.id === medication.id ? { ...item, taken } : item) || current);
    try {
      await setMedicationTaken(requested, medication.id, todayString(), taken);
    } catch {
      if (profileRef.current !== requested || pendingMedication.current !== operation) return;
      setMedications((current) => current?.map((item) => item.id === medication.id ? { ...item, taken: medication.taken } : item) || current);
      setMedicationError("We couldn't update today's medication check-in. Please try again.");
    } finally {
      if (pendingMedication.current === operation) { pendingMedication.current = null; setSavingMedication(null); }
    }
  }

  const filled = health ? basicsFilled(health) : null;
  const water = wellbeing?.water;
  const sleep = wellbeing?.sleep;
  const takenCount = medications?.filter((medication) => medication.taken).length || 0;
  const nextMedicationAction = medications?.find((medication) => !medication.taken) || medications?.[0];
  const nextAppointment = appointments?.map((appointment) => ({
    ...appointment,
    dateTime: new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`),
  })).filter((appointment) => appointment.dateTime >= new Date()).sort((a, b) => a.dateTime - b.dateTime)[0];
  const goal = water?.goal;
  const waterStatus = !water ? (wellbeingFailed ? "Unavailable" : "Loading")
    : !goal ? "No daily goal set"
      : goal.type === "atMost"
        ? water.totalMl > goal.ml ? "Over your limit" : water.totalMl === goal.ml ? "Limit reached" : "Within your limit"
        : water.totalMl >= goal.ml ? "Goal reached" : "In progress";
  const waterDetail = !water ? (wellbeingFailed ? "Today's water progress is unavailable." : "Loading today's water progress.")
    : !goal ? `${litresText(water.totalMl)} logged today. Set a daily goal to track progress.`
      : goal.type === "atMost"
        ? `${litresText(water.totalMl)} of your ${litresText(goal.ml)} daily limit.`
        : `${litresText(water.totalMl)} of your ${litresText(goal.ml)} daily goal.`;

  // Until every source has answered: the same card as grey shapes, so the rings don't jump in one by one.
  if (!loaded) return <SkeletonRegion label="Loading your progress..."><ProgressSkeleton /></SkeletonRegion>;

  return (
    <Card aria-labelledby="progress-summary-heading" className="section progress-summary">
      <h2 id="progress-summary-heading">Your progress</h2>
      <ul className="progress-summary__list">
        <ProgressItem
          label="My health"
          summary={healthFailed ? "Your health basics could not be loaded." : filled === 5 ? "Your five health basics are complete." : `${filled ?? 0} of 5 health basics are filled in${who ? ` for ${who}` : ""}.`}
          status={healthFailed ? "Unavailable" : filled === null ? "Loading" : filled === 5 ? "Complete" : "In progress"}
          detail={healthFailed ? "Health profile progress is unavailable." : filled === null ? "Loading health profile." : `${filled} of 5 health basics filled in${who ? ` for ${who}` : ""}.`}
          href="/my-health"
          linkLabel="Open my health"
        />
        <ProgressItem
          label="Water today"
          summary={!water ? "Today's water log could not be loaded." : water.totalMl > 0 ? `${litresText(water.totalMl)} logged today.` : "Water is not logged yet today."}
          status={waterStatus}
          detail={waterDetail}
          href="/water-and-sleep"
          linkLabel="Track water"
        />
        <ProgressItem
          label="Last night’s sleep"
          summary={!wellbeing ? "Last night's sleep could not be loaded." : sleep ? `${hoursText(sleep.hours)} logged for last night.` : "Sleep is not logged yet for last night."}
          status={!wellbeing ? (wellbeingFailed ? "Unavailable" : "Loading") : sleep ? "Logged" : "Not logged yet"}
          detail={!wellbeing ? (wellbeingFailed ? "Sleep progress is unavailable." : "Loading sleep progress.") : sleep ? sleptText(sleep.quality) : "Log last night's sleep to complete this check-in."}
          href="/water-and-sleep"
          linkLabel="Log sleep"
        />
        <ProgressItem
          label="Medications today"
          summary={medicationsFailed ? "Today's medication check-in could not be loaded." : !medications?.length ? "There are no active medications to check." : `${takenCount} of ${medications.length} active medications checked off today.`}
          status={medicationsFailed ? "Unavailable" : !medications ? "Loading" : !medications.length ? "No active medications" : takenCount === medications.length ? "All checked off" : `${medications.length - takenCount} left to check`}
          detail={medicationsFailed ? "Today's medication check-in is unavailable." : !medications ? "Loading today's medication check-in." : !medications.length ? "No active medications on your list." : `${takenCount} of ${medications.length} active medications checked off today.`}
          href="/medications"
          linkLabel="Open medications"
          onAction={medications?.length ? () => toggleMedication(nextMedicationAction) : undefined}
          actionLabel={nextMedicationAction ? `${nextMedicationAction.taken ? "Undo taken" : "Mark taken"}: ${nextMedicationAction.name}` : undefined}
          actionDisabled={!medications?.length || !!savingMedication}
        />
      </ul>
      {medicationError && <p className="text-muted" role="alert">{medicationError}</p>}
      <section className="progress-summary__appointments" aria-labelledby="upcoming-appointment-heading">
        <div>
          <h3 id="upcoming-appointment-heading">Upcoming doctor’s appointment</h3>
          {appointmentsFailed ? <p className="text-muted">We couldn't load upcoming appointments.</p>
            : !appointments ? <LinesSkeleton label="Loading appointments…" lines={2} />
              : nextAppointment ? <p><strong>{nextAppointment.title}</strong> at {nextAppointment.hospital} · {formatDate(nextAppointment.appointmentDate)} at {nextAppointment.appointmentTime}</p>
                : <p className="text-muted">No upcoming appointments on your calendar.</p>}
        </div>
        <Button variant="secondary" href="/appointments">{nextAppointment ? "View appointments" : "Add an appointment"}</Button>
      </section>
    </Card>
  );
}

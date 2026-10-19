import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getHealthProfile } from "../lib/healthProfileApi";
import { basicsFilled } from "../lib/healthProfile";
import { getToday } from "../lib/wellbeingApi";
import { formatDate, todayString } from "../lib/dates";
import { getMedicationAdherence, setMedicationTaken } from "../lib/medicationApi";
import { getAppointments } from "../lib/appointmentApi";
import { hoursText, litresText, sleptText } from "../lib/wellbeing";

function ProgressRing({ label, value, progress, status, detail, href, linkLabel, complete = false }) {
  const circumference = 2 * Math.PI * 34;
  const boundedProgress = Math.max(0, Math.min(100, progress ?? 0));
  const dashOffset = circumference * (1 - boundedProgress / 100);

  return (
    <li className={`progress-summary__item${complete ? " progress-summary__item--complete" : ""}`}>
      <div className="progress-summary__visual" role="img" aria-label={`${label}: ${status}. ${detail}`}>
        <svg className="progress-summary__ring" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
          <circle className="progress-summary__ring-track" cx="40" cy="40" r="34" />
          {progress !== null && (
            <circle
              className="progress-summary__ring-value"
              cx="40" cy="40" r="34"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          )}
        </svg>
        <span className="progress-summary__ring-label" aria-hidden="true">{value}</span>
      </div>
      <div className="progress-summary__copy">
        <h3>{label}</h3>
        <p className="progress-summary__status">{status}</p>
        <p className="text-muted">{detail}</p>
        <Button variant="secondary" href={href}>{linkLabel}</Button>
      </div>
    </li>
  );
}

export default function ProgressSummary() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const who = activeProfile && !activeProfile.isSelf ? activeProfile.fullName : null;
  const [health, setHealth] = useState(null);
  const [wellbeing, setWellbeing] = useState(null);
  const [medications, setMedications] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [wellbeingFailed, setWellbeingFailed] = useState(false);
  const [medicationsFailed, setMedicationsFailed] = useState(false);
  const [appointmentsFailed, setAppointmentsFailed] = useState(false);
  const [savingMedication, setSavingMedication] = useState(null);
  const [medicationError, setMedicationError] = useState("");
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  useEffect(() => {
    if (!profileId) return;
    const requested = profileId;
    setHealth(null); setWellbeing(null); setMedications(null); setAppointments(null);
    setHealthFailed(false); setWellbeingFailed(false); setMedicationsFailed(false); setAppointmentsFailed(false);
    getHealthProfile(requested)
      .then((data) => { if (profileRef.current === requested) setHealth(data); })
      .catch(() => { if (profileRef.current === requested) setHealthFailed(true); });
    getToday(requested, todayString())
      .then((data) => { if (profileRef.current === requested) setWellbeing(data); })
      .catch(() => { if (profileRef.current === requested) setWellbeingFailed(true); });
    getMedicationAdherence(requested, todayString())
      .then((data) => { if (profileRef.current === requested) setMedications(data); })
      .catch(() => { if (profileRef.current === requested) setMedicationsFailed(true); });
    getAppointments(requested)
      .then((data) => { if (profileRef.current === requested) setAppointments(data); })
      .catch(() => { if (profileRef.current === requested) setAppointmentsFailed(true); });
  }, [profileId]);

  async function toggleMedication(medication) {
    const taken = !medication.taken;
    setSavingMedication(medication.id);
    setMedicationError("");
    try {
      await setMedicationTaken(profileId, medication.id, todayString(), taken);
      setMedications((current) => current?.map((item) => item.id === medication.id ? { ...item, taken } : item) || current);
    } catch {
      setMedicationError("We couldn't update today's medication check-in. Please try again.");
    } finally {
      setSavingMedication(null);
    }
  }

  const filled = health ? basicsFilled(health) : null;
  const water = wellbeing?.water;
  const sleep = wellbeing?.sleep;
  const takenCount = medications?.filter((medication) => medication.taken).length || 0;
  const nextAppointment = appointments?.map((appointment) => ({
    ...appointment,
    dateTime: new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`),
  })).filter((appointment) => appointment.dateTime >= new Date()).sort((a, b) => a.dateTime - b.dateTime)[0];
  const goal = water?.goal;
  const waterProgress = goal ? Math.min(100, Math.round((water.totalMl / goal.ml) * 100)) : null;
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

  return (
    <Card aria-labelledby="progress-summary-heading" className="section progress-summary">
      <h2 id="progress-summary-heading">Your progress</h2>
      <ul className="progress-summary__list">
        <ProgressRing
          label="My health"
          value={filled === null ? "—" : `${filled}/5`}
          progress={filled === null ? null : (filled / 5) * 100}
          status={healthFailed ? "Unavailable" : filled === null ? "Loading" : filled === 5 ? "Complete" : "In progress"}
          detail={healthFailed ? "Health profile progress is unavailable." : filled === null ? "Loading health profile." : `${filled} of 5 health basics filled in${who ? ` for ${who}` : ""}.`}
          href="/my-health"
          linkLabel="Open my health"
          complete={filled === 5}
        />
        <ProgressRing
          label="Water today"
          value={waterProgress === null ? "—" : `${waterProgress}%`}
          progress={waterProgress}
          status={waterStatus}
          detail={waterDetail}
          href="/water-and-sleep"
          linkLabel="Track water"
          complete={!!goal && goal.type === "atLeast" && water?.totalMl >= goal.ml}
        />
        <ProgressRing
          label="Last night’s sleep"
          value={sleep ? hoursText(sleep.hours).replace(" hours", "h").replace(" hour", "h") : "—"}
          progress={sleep ? 100 : wellbeing ? 0 : null}
          status={!wellbeing ? (wellbeingFailed ? "Unavailable" : "Loading") : sleep ? "Logged" : "Not logged yet"}
          detail={!wellbeing ? (wellbeingFailed ? "Sleep progress is unavailable." : "Loading sleep progress.") : sleep ? sleptText(sleep.quality) : "Log last night's sleep to complete this check-in."}
          href="/water-and-sleep"
          linkLabel="Log sleep"
          complete={!!sleep}
        />
        <ProgressRing
          label="Medications today"
          value={medications?.length ? `${takenCount}/${medications.length}` : "—"}
          progress={medications?.length ? (takenCount / medications.length) * 100 : medications ? 0 : null}
          status={medicationsFailed ? "Unavailable" : !medications ? "Loading" : !medications.length ? "No active medications" : takenCount === medications.length ? "All checked off" : `${medications.length - takenCount} left to check`}
          detail={medicationsFailed ? "Today's medication check-in is unavailable." : !medications ? "Loading today's medication check-in." : !medications.length ? "No active medications on your list." : `${takenCount} of ${medications.length} active medications checked off today.`}
          href="/medications"
          linkLabel="Open medications"
          complete={!!medications?.length && takenCount === medications.length}
        />
      </ul>
      <section className="progress-summary__medications" aria-labelledby="medication-checkin-heading">
        <h3 id="medication-checkin-heading">Medication check-in</h3>
        <p className="text-muted">{medications?.length
          ? "Check off each medicine after taking it as prescribed. This is one daily check-in, not a dose-by-dose record."
          : medicationsFailed ? "Medication reminders are unavailable right now."
            : medications ? "No active medications on your list. Add one to get a daily check-in here."
              : "Loading your active medication list."}</p>
        {medicationError && <p className="text-muted" role="alert">{medicationError}</p>}
        {medications?.length > 0 && <ul className="progress-summary__medication-list">
          {medications.map((medication) => (
            <li key={medication.id}>
              <label>
                <input type="checkbox" checked={medication.taken} disabled={savingMedication === medication.id} onChange={() => toggleMedication(medication)} />
                <span><strong>{medication.name}</strong>{medication.dose && ` · ${medication.dose}${medication.unit ? ` ${medication.unit}` : ""}`}{medication.frequency && <span className="text-muted"> · {medication.frequency}</span>}</span>
              </label>
            </li>
          ))}
        </ul>}
        {medicationsFailed && <p className="text-muted">We couldn't load your medications. <a href="/medications">Open medications</a></p>}
      </section>
      <section className="progress-summary__appointments" aria-labelledby="upcoming-appointment-heading">
        <div>
          <h3 id="upcoming-appointment-heading">Upcoming doctor’s appointment</h3>
          {appointmentsFailed ? <p className="text-muted">We couldn't load upcoming appointments.</p>
            : !appointments ? <p className="text-muted">Loading appointments…</p>
              : nextAppointment ? <p><strong>{nextAppointment.title}</strong> at {nextAppointment.hospital} · {formatDate(nextAppointment.appointmentDate)} at {nextAppointment.appointmentTime}</p>
                : <p className="text-muted">No upcoming appointments on your calendar.</p>}
        </div>
        <Button variant="secondary" href="/appointments">{nextAppointment ? "View appointments" : "Add an appointment"}</Button>
      </section>
    </Card>
  );
}

import { useEffect, useRef, useState } from "react";
import { getHealthProfile } from "../lib/healthProfileApi";
import { getToday } from "../lib/wellbeingApi";
import { todayString } from "../lib/dates";
import { getMedicationAdherence } from "../lib/medicationApi";
import { getAppointments } from "../lib/appointmentApi";

// What the dashboard shows for the active profile, loaded once and shared by the Next step card and
// Your progress: the health profile, today's water and sleep, today's medication check-in and the
// appointments. Each value is null while loading; its *Failed flag says it couldn't load.
// A profile switch clears everything, and answers for the previous profile are ignored.
export default function useDashboardData(profileId) {
  const [health, setHealth] = useState(null);
  const [wellbeing, setWellbeing] = useState(null);
  const [medications, setMedications] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [wellbeingFailed, setWellbeingFailed] = useState(false);
  const [medicationsFailed, setMedicationsFailed] = useState(false);
  const [appointmentsFailed, setAppointmentsFailed] = useState(false);
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

  const settled = (value, failed) => value !== null || failed;
  return {
    profileId, profileRef,
    health, wellbeing, medications, setMedications, appointments,
    healthFailed, wellbeingFailed, medicationsFailed, appointmentsFailed,
    // Every source has answered (or failed): the Next step card waits for this so it never jumps from one line to another.
    loaded: settled(health, healthFailed) && settled(wellbeing, wellbeingFailed) && settled(medications, medicationsFailed) && settled(appointments, appointmentsFailed),
  };
}

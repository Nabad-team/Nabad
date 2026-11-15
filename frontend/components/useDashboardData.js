import { useEffect, useRef, useState } from "react";
import { getHealthProfile } from "../lib/healthProfileApi";
import { getToday } from "../lib/wellbeingApi";
import { todayString } from "../lib/dates";
import { getMedicationAdherence } from "../lib/medicationApi";
import { getAppointments } from "../lib/appointmentApi";
import { getSymptomsForProfile } from "../lib/symptomApi";
import { getEmergencyCard } from "../lib/emergencyCardApi";

// What the dashboard shows for the active profile, loaded once and shared by the Next step card and
// Your progress: the health profile, today's water and sleep, today's medication check-in and the
// appointments, plus the symptom checks and the emergency card for the Getting started card. Each value is null
// while loading; its *Failed flag says it couldn't load.
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
  const [symptoms, setSymptoms] = useState(null);
  const [emergencyCard, setEmergencyCard] = useState(null);
  const [symptomsFailed, setSymptomsFailed] = useState(false);
  const [emergencyCardFailed, setEmergencyCardFailed] = useState(false);
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  useEffect(() => {
    if (!profileId) return;
    const requested = profileId;
    setHealth(null); setWellbeing(null); setMedications(null); setAppointments(null);
    setHealthFailed(false); setWellbeingFailed(false); setMedicationsFailed(false); setAppointmentsFailed(false);
    setSymptoms(null); setEmergencyCard(null); setSymptomsFailed(false); setEmergencyCardFailed(false);
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
    getSymptomsForProfile(requested)
      .then((data) => { if (profileRef.current === requested) setSymptoms(data); })
      .catch(() => { if (profileRef.current === requested) setSymptomsFailed(true); });
    getEmergencyCard(requested)
      .then((data) => { if (profileRef.current === requested) setEmergencyCard(data); })
      .catch(() => { if (profileRef.current === requested) setEmergencyCardFailed(true); });
  }, [profileId]);

  const settled = (value, failed) => value !== null || failed;
  return {
    profileId, profileRef,
    health, wellbeing, medications, setMedications, appointments,
    healthFailed, wellbeingFailed, medicationsFailed, appointmentsFailed,
    symptoms, emergencyCard, symptomsFailed, emergencyCardFailed,
    // The Getting started card's sources (health and medications are shared with Next step) have all answered.
    startLoaded: settled(health, healthFailed) && settled(medications, medicationsFailed) && settled(symptoms, symptomsFailed) && settled(emergencyCard, emergencyCardFailed),
    // Every source has answered (or failed): the Next step card waits for this so it never jumps from one line to another.
    loaded: settled(health, healthFailed) && settled(wellbeing, wellbeingFailed) && settled(medications, medicationsFailed) && settled(appointments, appointmentsFailed),
  };
}

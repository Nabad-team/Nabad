import { useEffect, useRef, useState } from "react";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import { HeartbeatLoader } from "./ui/Heartbeat";
import { getHistory } from "../lib/wellbeingApi";
import { formatDate } from "../lib/dates";
import { QUALITY_WORDS, averages, goalText, hoursText, litresText, shortDate, sleepTimesText } from "../lib/wellbeing";

export const SUMMARY_DAYS = 14;

// "Summary for your doctor": the last 14 days of fluids and sleep for one profile, as plain facts in one table.
// When it is open, printing the page prints only this (see "Printing the doctor summary" in styles/components.css),
// so "Print or save as PDF" gives a clean page to take to an appointment.
//   name:  whose summary it is (the active profile's name). today: "YYYY-MM-DD", the last day in the table.
export default function DoctorSummary({ profileId, name, today, onClose }) {
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef(null);

  useEffect(() => {
    let current = true;
    getHistory(profileId, today, SUMMARY_DAYS)
      .then((data) => { if (current) setHistory(data); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [profileId, today]);
  // Once it has loaded, take keyboard and screen reader users to it.
  useEffect(() => { if (history) headingRef.current?.focus(); }, [history]);

  if (failed) {
    return (
      <div className="stack">
        <Alert tone="danger" as="p" role="alert">We couldn't load the summary. Please check your connection and try again.</Alert>
        <div><Button variant="secondary" onClick={onClose}>Close</Button></div>
      </div>
    );
  }
  if (!history) return <HeartbeatLoader label="Loading the summary..." />;

  const { days, goal } = history;
  const { waterDays, sleepDays, waterMl, sleepHours } = averages(days);
  // Newest first, as a doctor reads back from today.
  const rows = days.slice().reverse();

  return (
    <div className="doctor-summary">
      <h3 ref={headingRef} tabIndex={-1} className="doctor-summary__title">Water and sleep: {name}</h3>
      <dl className="doctor-summary__facts">
        <div><dt>Period</dt><dd>{formatDate(days[0].date)} to {formatDate(days[days.length - 1].date)}</dd></div>
        <div><dt>Daily fluid goal</dt><dd>{goal ? goalText(goal) : "None set"}</dd></div>
        <div>
          <dt>Average fluids</dt>
          <dd>{waterDays ? `${litresText(waterMl)} a day (${waterDays} of ${SUMMARY_DAYS} days logged)` : "Nothing logged"}</dd>
        </div>
        <div>
          <dt>Average sleep</dt>
          <dd>{sleepDays ? `${hoursText(sleepHours)} a night (${sleepDays} of ${SUMMARY_DAYS} nights logged)` : "Nothing logged"}</dd>
        </div>
      </dl>

      <div className="doctor-summary__scroll" role="region" aria-labelledby="doctor-table-caption" tabIndex={0}>
        <table className="doctor-summary__table">
          <caption id="doctor-table-caption">Fluids and sleep, day by day (newest first)</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Fluids</th>
              <th scope="col">Sleep</th>
              <th scope="col">Bedtime to wake-up</th>
              <th scope="col">Sleep quality</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((day) => (
              <tr key={day.date}>
                <th scope="row">{shortDate(day.date)}</th>
                <td>{day.totalMl === null ? <span className="text-muted">Not logged</span> : litresText(day.totalMl)}</td>
                <td>{day.sleep ? hoursText(day.sleep.hours) : <span className="text-muted">Not logged</span>}</td>
                <td>{sleepTimesText(day.sleep)}</td>
                <td>{day.sleep ? QUALITY_WORDS[day.sleep.quality - 1] : ""}</td>
                <td>{day.sleep?.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="doctor-summary__source text-muted">
        Self-reported in Nabad, not measured by a clinician. Made on {formatDate(today)}.
      </p>
      <div className="button-row doctor-summary__actions">
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
        <Button variant="secondary" onClick={onClose}>Close summary</Button>
      </div>
    </div>
  );
}

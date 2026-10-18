import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useAccessibility } from "../context/AccessibilityContext";
import { formatDate, todayString } from "../lib/dates";
import {
  REMINDER_OPTIONS,
  getAppointments,
  addAppointment,
  updateAppointment,
  deleteAppointment,
} from "../lib/appointmentApi";

const emptyFields = () => ({
  title: "", hospital: "", location: "", appointmentDate: todayString(),
  appointmentTime: "", reminderMinutes: 60, notes: "",
});

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function appointmentDateTime(appointment) {
  return new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`);
}

function reminderText(minutes) {
  return REMINDER_OPTIONS.find(([value]) => value === Number(minutes))?.[1] || "1 hour before";
}

function reminderDue(appointment, now) {
  const time = appointmentDateTime(appointment);
  const start = time.getTime() - Number(appointment.reminderMinutes) * 60000;
  return time.getTime() >= now.getTime() && start <= now.getTime();
}

function reminderSignature(appointment) {
  return `${appointment.appointmentDate}|${appointment.appointmentTime}|${appointment.reminderMinutes}`;
}

function AppointmentForm({ idPrefix, initial, title, submitLabel, onSave, onCancel }) {
  const [fields, setFields] = useState(initial);
  const [problems, setProblems] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setFields({ ...fields, [field]: event.target.value });
  const id = (field) => `${idPrefix}-${field}`;

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!fields.title.trim()) found.title = "Enter the appointment title.";
    if (!fields.hospital.trim()) found.hospital = "Enter the hospital.";
    if (!fields.appointmentDate) found.appointmentDate = "Enter the appointment date.";
    if (!fields.appointmentTime) found.appointmentTime = "Enter the appointment time.";
    setProblems(found);
    setError("");
    if (Object.keys(found).length) {
      document.getElementById(id(Object.keys(found)[0]))?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...fields, title: fields.title.trim(), hospital: fields.hospital.trim(), location: fields.location.trim() });
    } catch (err) {
      setError(err.message || "Could not save the appointment. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="form appointment-form" aria-labelledby={id("heading")}>
      <h3 id={id("heading")}>{title}</h3>
      <Input id={id("title")} label="Appointment title" hint="For example: Cardiology check-up" value={fields.title} onChange={update("title")} error={problems.title} maxLength="120" autoComplete="off" autoFocus required />
      <Input id={id("hospital")} label="Hospital or clinic" value={fields.hospital} onChange={update("hospital")} error={problems.hospital} maxLength="120" autoComplete="organization" required />
      <Input id={id("location")} label="Location (optional)" hint="For example: Building B, floor 2" value={fields.location} onChange={update("location")} maxLength="200" autoComplete="street-address" />
      <div className="field-pair">
        <Input id={id("appointmentDate")} label="Date" type="date" value={fields.appointmentDate} onChange={update("appointmentDate")} error={problems.appointmentDate} required />
        <Input id={id("appointmentTime")} label="Time" type="time" value={fields.appointmentTime} onChange={update("appointmentTime")} error={problems.appointmentTime} required />
      </div>
      <Input as="select" id={id("reminderMinutes")} label="Remind me" value={fields.reminderMinutes} onChange={update("reminderMinutes")}>
        {REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Input>
      <Input as="textarea" id={id("notes")} label="Notes (optional)" rows="3" value={fields.notes} onChange={update("notes")} maxLength="1000" />
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      <div className="form-actions">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : submitLabel}</Button>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

function Calendar({ month, appointments, onMonthChange, onDateDoubleClick }) {
  const days = monthDays(month);
  const appointmentsByDate = appointments.reduce((groups, appointment) => {
    groups[appointment.appointmentDate] = (groups[appointment.appointmentDate] || []).concat(appointment);
    return groups;
  }, {});
  const today = todayString();

  return (
    <section className="calendar" aria-label="Appointment calendar">
      <div className="calendar__header">
        <Button variant="secondary" size="small" onClick={() => onMonthChange(-1)} aria-label="Previous month">Previous</Button>
        <h2>{monthLabel(month)}</h2>
        <Button variant="secondary" size="small" onClick={() => onMonthChange(1)} aria-label="Next month">Next</Button>
      </div>
      <p className="calendar__hint">Double-click a date to add a doctor's appointment.</p>
      <div className="calendar__grid calendar__weekdays" aria-hidden="true">
        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <span key={day}>{day.slice(0, 3)}</span>)}
      </div>
      <div className="calendar__grid calendar__days">
        {days.map((date) => {
          const key = dateKey(date);
          const events = appointmentsByDate[key] || [];
          const inMonth = date.getMonth() === month.getMonth();
          return (
            <button
              type="button"
              key={key}
              className={`calendar__day${inMonth ? "" : " calendar__day--outside"}${key === today ? " calendar__day--today" : ""}`}
              onDoubleClick={() => onDateDoubleClick(key)}
              aria-label={`${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}${events.length ? `, ${events.length} appointment${events.length === 1 ? "" : "s"}` : ""}`}
            >
              <span className="calendar__number">{date.getDate()}</span>
              {events.map((appointment) => <span className="calendar__event" key={appointment.id}>{appointment.appointmentTime} {appointment.title}</span>)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function AppointmentsPage() {
  const { activeProfile, error: profilesError } = useActiveProfile();
  const { preferences } = useAccessibility();
  const simplified = preferences.simplifiedMode;
  const [appointments, setAppointments] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [newAppointmentFields, setNewAppointmentFields] = useState(emptyFields);
  const profileId = activeProfile?.id;
  const profileRef = useRef(profileId);
  const notifiedRef = useRef(new Map());
  const scheduleRef = useRef(new Map());
  profileRef.current = profileId;
  const forSelf = !activeProfile || activeProfile.isSelf;
  const name = activeProfile?.fullName;

  async function load() {
    const requested = profileRef.current;
    setLoadError("");
    try {
      const list = await getAppointments(requested);
      if (profileRef.current === requested) setAppointments(list);
    } catch {
      if (profileRef.current === requested) setLoadError(`We couldn't load ${forSelf ? "your" : `${name}'s`} appointments. Please check your connection and try again.`);
    }
  }

  useEffect(() => {
    if (!profileId) return;
    setAppointments(null); setEditing(null); setNotice(""); setError("");
    load();
  }, [profileId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!appointments || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    appointments.forEach((appointment) => {
      const key = `${profileId}:${appointment.id}`;
      const signature = reminderSignature(appointment);
      const previousSignature = scheduleRef.current.get(key);
      if (previousSignature !== undefined && previousSignature !== signature) notifiedRef.current.delete(key);
      scheduleRef.current.set(key, signature);
      if (!reminderDue(appointment, now)) return;
      if (notifiedRef.current.get(key) === signature) return;
      notifiedRef.current.set(key, signature);
      new Notification(`Reminder: ${appointment.title}`, {
        body: `${formatDate(appointment.appointmentDate)} at ${appointment.appointmentTime} · ${appointment.hospital}`,
      });
    });
  }, [appointments, now, profileId]);

  async function save(fields) {
    if (editing === "add") await addAppointment(profileId, fields);
    else await updateAppointment(profileId, editing, fields);
    setEditing(null);
    setNotice(editing === "add" ? "Appointment added to your calendar." : "Appointment updated.");
    await load();
  }

  async function enableReminders() {
    setError("");
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") setNotice("Browser reminders are enabled while this page is open.");
      else if (permission === "denied") setError("Notifications are blocked in your browser settings. You can change that there.");
    } catch {
      setError("We couldn't enable browser notifications. Please check your browser settings.");
    }
  }

  function openNewAppointment(date = todayString()) {
    setNotice("");
    setNewAppointmentFields({ ...emptyFields(), appointmentDate: date });
    setEditing("add");
  }

  async function remove(appointment) {
    if (!window.confirm(`Delete ${appointment.title}?`)) return;
    setError("");
    try {
      await deleteAppointment(profileId, appointment.id);
      setNotice("Appointment deleted.");
      await load();
    } catch (err) {
      setError(err.message || "Could not delete the appointment.");
    }
  }

  const listName = forSelf ? "Your appointments" : `Appointments for ${name}`;
  return (
    <PageLayout title="Appointments" header={<ProfileHeader showPicture={false} />}>
      <PageTitle>{simplified ? "Calendar" : listName}</PageTitle>
      <p className="page-intro">Keep your doctor's appointments together and get browser reminders before visits while this page is open.</p>
      {notificationPermission === "default" && <Button variant="secondary" onClick={enableReminders}>Enable reminders</Button>}
      {notificationPermission === "denied" && <p className="text-muted text-sm">Notifications are blocked in browser settings. Change that setting, then reload this page to try again.</p>}
      {notificationPermission === "unsupported" && <p className="text-muted text-sm">Browser notifications are not available here. Reminders only work while this page is open.</p>}
      {profilesError && <Alert tone="danger" as="p" role="alert">{profilesError}</Alert>}
      {notice && <Alert tone="success" as="p" role="status">{notice}</Alert>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {loadError && <div className="stack"><Alert tone="danger" as="p" role="alert">{loadError}</Alert><Button variant="secondary" onClick={load}>Try again</Button></div>}
      {!loadError && !profilesError && appointments === null && <HeartbeatLoader label="Loading appointments..." />}
      {appointments !== null && (
        <>
          <Calendar
            month={month}
            appointments={appointments}
            onMonthChange={(offset) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))}
            onDateDoubleClick={openNewAppointment}
          />
          {editing === "add" ? (
            <AppointmentForm idPrefix="new" initial={newAppointmentFields} title="Add an appointment" submitLabel="Save appointment" onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div className="appointments-actions"><Button onClick={() => openNewAppointment()}>Add appointment</Button></div>
          )}
          {appointments.length === 0 && editing !== "add" && <EmptyState title="No appointments yet.">Add your next doctor's visit so Nabad can remind you.</EmptyState>}
          {appointments.length > 0 && (
            <ul className="appointment-list" aria-label={listName}>
              {appointments.map((appointment) => (
                <li key={appointment.id} className={`appointment${reminderDue(appointment, now) ? " appointment--reminder" : ""}`}>
                  {editing === appointment.id ? (
                    <AppointmentForm idPrefix={`edit-${appointment.id}`} initial={appointment} title={`Edit ${appointment.title}`} submitLabel="Save changes" onSave={save} onCancel={() => setEditing(null)} />
                  ) : (
                    <>
                      <div className="appointment__heading"><h3>{appointment.title}</h3>{reminderDue(appointment, now) && <span className="badge">Reminder due</span>}</div>
                      <p className="appointment__when">{formatDate(appointment.appointmentDate)} at {appointment.appointmentTime}</p>
                      <p className="appointment__place"><strong>{appointment.hospital}</strong>{appointment.location && ` · ${appointment.location}`}</p>
                      <p className="text-muted text-sm">Reminder: {reminderText(appointment.reminderMinutes)}</p>
                      {appointment.notes && <p className="appointment__notes"><span className="text-muted">Notes:</span> {appointment.notes}</p>}
                      <div className="button-row"><Button variant="secondary" size="small" onClick={() => setEditing(appointment.id)} aria-label={`Edit ${appointment.title}`}>Edit</Button><Button variant="secondary" size="small" onClick={() => remove(appointment)} aria-label={`Delete ${appointment.title}`}>Delete</Button></div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="section"><a href="/medications">Back to medications</a></p>
    </PageLayout>
  );
}

AppointmentsPage.requireSignIn = true;

import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import Dialog from "../components/Dialog";
import { MedicineBox } from "../components/illustrations";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useAccessibility } from "../context/AccessibilityContext";
import {
  MEDICATION_FORMS,
  getMedications,
  addMedication,
  updateMedication,
  setMedicationStatus,
  deleteMedication,
} from "../lib/medicationApi";
import { formatDate, todayString } from "../lib/dates";
import useSearchTarget from "../lib/useSearchTarget";

// Same limits as the backend (models/Medication.js), so the browser stops overlong text before sending it.
const LIMITS = { name: 100, dose: 40, unit: 20, frequency: 100, notes: 1000 };
const FORM_LABELS = { tablet: "Tablet", syrup: "Syrup", injection: "Injection", inhaler: "Inhaler", drops: "Drops", other: "Other" };
const emptyFields = () => ({ name: "", dose: "", unit: "", form: "tablet", frequency: "", timesText: "", startDate: todayString(), endDate: "", notes: "",
  reminderTimes: [], reminderTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Beirut" });

// Checks what the browser can check, in the same words as the server. Returns { field: message }.
function findProblems(fields) {
  const problems = {};
  if (!fields.name.trim()) problems.name = "Enter the medication name.";
  if (!fields.startDate) problems.startDate = "Enter a valid start date.";
  if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) problems.endDate = "The end date can't be before the start date.";
  if (fields.reminderTimes.some(time => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) problems.reminderTimes = "Enter a time for every reminder, or remove the empty reminder.";
  else if (new Set(fields.reminderTimes).size !== fields.reminderTimes.length) problems.reminderTimes = "Each reminder time must be different.";
  try { new Intl.DateTimeFormat("en-US", { timeZone: fields.reminderTimeZone }); }
  catch { problems.reminderTimeZone = "Choose a valid reminder time zone, such as Asia/Beirut."; }
  if (!fields.reminderTimeZone) problems.reminderTimeZone = "Choose a valid reminder time zone, such as Asia/Beirut.";
  return problems;
}

// "500 mg tablet · twice a day"
function summary(medication) {
  const amount = [medication.dose, medication.unit].filter(Boolean).join(" ");
  const what = [amount, medication.form === "other" ? "" : medication.form].filter(Boolean).join(" ");
  return [what, medication.frequency].filter(Boolean).join(" · ");
}

// "Since 1 September 2026" or "1 September 2026 to 10 September 2026"
function dates(medication) {
  return medication.endDate
    ? `${formatDate(medication.startDate)} to ${formatDate(medication.endDate)}`
    : `Since ${formatDate(medication.startDate)}`;
}

const statusAction = (medication) => (medication.status === "active" ? "Mark as discontinued" : "Mark as active again");

// The add and edit form. idPrefix keeps the field ids unique when it is shown inside a list item.
function MedicationForm({ idPrefix, initial, title, submitLabel, onSave, onCancel }) {
  const [fields, setFields] = useState({ ...initial, timesText: initial.times ? initial.times.join(", ") : initial.timesText || "" });
  const [problems, setProblems] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setFields({ ...fields, [field]: e.target.value });
  const id = (field) => `${idPrefix}-${field}`;

  async function handleSubmit(e) {
    e.preventDefault();
    const found = findProblems(fields);
    setProblems(found);
    setError("");
    if (Object.keys(found).length) {
      const field = Object.keys(found)[0];
      document.getElementById(id(field === "reminderTimes" ? "reminder-0" : field))?.focus();
      return;
    }
    setSaving(true);
    try {
      const times = fields.timesText.split(",").map(value => value.trim()).filter(Boolean);
      if (times.some(value => !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || new Set(times).size !== times.length || times.length > 12) {
        setProblems({ timesText: "Enter unique times as HH:MM, separated by commas." }); setSaving(false); return;
      }
      const { timesText, ...medicationFields } = fields;
      await onSave({ ...medicationFields, times, name: fields.name.trim() });
    } catch (err) {
      setError(err.message || "Could not save the medication. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form medication-form" aria-labelledby={id("heading")}>
      <h3 id={id("heading")}>{title}</h3>
      <Input id={id("name")} label="Medication name" value={fields.name} onChange={update("name")} error={problems.name} maxLength={LIMITS.name} autoComplete="off" autoFocus required />
      <div className="field-pair">
        <Input id={id("dose")} label="Dose" hint="For example 500" value={fields.dose} onChange={update("dose")} maxLength={LIMITS.dose} inputMode="decimal" autoComplete="off" />
        <Input id={id("unit")} label="Unit" hint="For example mg or ml" value={fields.unit} onChange={update("unit")} maxLength={LIMITS.unit} autoComplete="off" />
      </div>
      <Input as="select" id={id("form")} label="Form" value={fields.form} onChange={update("form")}>
        {MEDICATION_FORMS.map((form) => <option key={form} value={form}>{FORM_LABELS[form]}</option>)}
      </Input>
      <Input id={id("frequency")} label="How often" hint="For example twice a day, or every 8 hours" value={fields.frequency} onChange={update("frequency")} maxLength={LIMITS.frequency} autoComplete="off" />
      <Input id={id("timesText")} label="Medication times (optional)" hint="For example 08:00, 20:00. These appear on the calendar." value={fields.timesText} onChange={update("timesText")} error={problems.timesText} autoComplete="off" />
      <div className="field-pair">
        <Input id={id("startDate")} label="Start date" type="date" value={fields.startDate} onChange={update("startDate")} error={problems.startDate} required />
        <Input id={id("endDate")} label="End date (optional)" type="date" min={fields.startDate || undefined} value={fields.endDate} onChange={update("endDate")} error={problems.endDate} />
      </div>
      <Input as="textarea" id={id("notes")} label="Notes (optional)" hint="For example: take with food" rows="3" value={fields.notes} onChange={update("notes")} maxLength={LIMITS.notes} />
      <fieldset className="stack">
        <legend>Daily reminder times (optional)</legend>
        <p>Choose times that match your prescribed schedule. Reminders appear in Nabad's notification bell; they do not send an SMS or phone alarm.</p>
        {fields.reminderTimes.map((time, index) => <div key={index} className="field-pair">
          <Input id={id(`reminder-${index}`)} label={`Reminder time ${index + 1}`} type="time" value={time}
            error={index === 0 ? problems.reminderTimes : undefined}
            onChange={e => setFields(old => ({ ...old, reminderTimes: old.reminderTimes.map((value, i) => i === index ? e.target.value : value) }))} />
          <Button variant="secondary" onClick={() => setFields(old => ({ ...old, reminderTimes: old.reminderTimes.filter((_, i) => i !== index) }))}>Remove reminder {index + 1}</Button>
        </div>)}
        <div><Button variant="secondary" disabled={fields.reminderTimes.length >= 12}
          onClick={() => setFields(old => ({ ...old, reminderTimes: [...old.reminderTimes, ""] }))}>Add reminder time</Button></div>
        <Input id={id("reminderTimeZone")} label="Reminder time zone" value={fields.reminderTimeZone}
          onChange={update("reminderTimeZone")} error={problems.reminderTimeZone} hint="For example Asia/Beirut. Times stay in this zone when you travel." maxLength={64} />
        <p>Remove all times to turn reminders off for this medication. Discontinued medications do not send reminders. You can also turn medication notifications off in your profile.</p>
      </fieldset>
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      <div className="form-actions">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : submitLabel}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}

export default function MedicationsPage() {
  const { activeProfile, error: profilesError } = useActiveProfile();
  const { preferences } = useAccessibility();
  const simplified = preferences.simplifiedMode;
  const [medications, setMedications] = useState(null);
  useSearchTarget(medications, "medication");
  const [loadError, setLoadError] = useState("");
  // null, "add", or the id of the medication being edited. Only one form is open at a time.
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [undoStatus, setUndoStatus] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // Whose list this is: the profile chosen in the header ("self" or a dependent's id).
  const profileId = activeProfile?.id;
  const forSelf = !activeProfile || activeProfile.isSelf;
  const name = activeProfile?.fullName;
  // The profile the latest load was for, so a slow answer for a previous profile is never shown.
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  async function load() {
    const requested = profileRef.current;
    setLoadError("");
    try {
      const list = await getMedications(requested);
      if (profileRef.current === requested) setMedications(list);
    } catch {
      if (profileRef.current === requested) {
        setLoadError(`We couldn't load ${forSelf ? "your" : name + "'s"} medications. Please check your connection and try again.`);
      }
    }
  }
  // Loads again whenever the header switches profile, starting from a clean page.
  useEffect(() => {
    if (!profileId) return;
    setMedications(null); setEditing(null); setToDelete(null); setNotice(""); setError("");
    load();
  }, [profileId]);

  function open(target) {
    setNotice(""); setError(""); setEditing(target);
  }

  const listName = forSelf ? "your list" : `${name}'s list`;

  async function handleAdd(fields) {
    await addMedication(profileId, fields);
    setEditing(null);
    setNotice(`${fields.name} was added to ${listName}.`);
    await load();
  }

  async function handleEdit(id, fields) {
    try {
      await updateMedication(profileId, id, fields);
    } catch (err) {
      // Deleted somewhere else (another tab): close the form and refresh the list.
      if (err.status === 404) { setEditing(null); setError(`That medication is no longer on ${listName}.`); await load(); return; }
      throw err;
    }
    setEditing(null);
    setNotice(`Your changes to ${fields.name} were saved.`);
    await load();
  }

  async function handleStatus(medication) {
    const status = medication.status === "active" ? "discontinued" : "active";
    setBusyId(medication.id); setNotice(""); setError("");
    try {
      await setMedicationStatus(profileId, medication.id, status);
      setNotice(status === "active" ? `${medication.name} is marked as active again.` : `${medication.name} is marked as discontinued.`);
      setUndoStatus({ medication, status: medication.status });
      await load();
    } catch (err) {
      setError(err.message || "Could not change the status. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndoStatus() {
    const change = undoStatus;
    if (!change) return;
    setBusyId(change.medication.id); setError("");
    try {
      await setMedicationStatus(profileId, change.medication.id, change.status);
      setNotice(`Status change for ${change.medication.name} was undone.`);
      setUndoStatus(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not undo the status change. Please try again.");
    } finally { setBusyId(null); }
  }

  async function handleDelete() {
    const medication = toDelete;
    setBusyId(medication.id); setNotice(""); setError("");
    try {
      await deleteMedication(profileId, medication.id);
      setNotice(`${medication.name} was deleted.`);
      if (editing === medication.id) setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not delete the medication. Please try again.");
    } finally {
      setBusyId(null);
      setToDelete(null);
    }
  }

  const matching = (medications || []).filter((medication) =>
    [medication.name, medication.dose, medication.form, medication.notes].some((value) => String(value || "").toLowerCase().includes(query.trim().toLowerCase())));
  const activeMedications = matching.filter((medication) => medication.status === "active");
  const discontinuedMedications = matching.filter((medication) => medication.status !== "active");
  const medicationRow = (medication) => <li key={medication.id} id={`medication-${medication.id}`} tabIndex={-1} className="medication">
    {editing === medication.id ? <MedicationForm
      idPrefix={`edit-${medication.id}`}
      initial={{ ...emptyFields(), ...medication }}
      title={`Edit ${medication.name}`}
      submitLabel="Save changes"
      onSave={(fields) => handleEdit(medication.id, fields)}
      onCancel={() => setEditing(null)}
    /> : <>
      <div className="medication__heading"><h3>{medication.name}</h3>{medication.status === "active" ? <Badge>Active</Badge> : <Badge tone="neutral">Discontinued</Badge>}</div>
      {summary(medication) && <p className="medication__summary">{summary(medication)}</p>}
      <p className="text-muted text-sm">{dates(medication)}</p>
      {medication.reminderTimes?.length > 0 && <p>Daily reminders: {medication.reminderTimes.join(", ")} ({medication.reminderTimeZone}){medication.status === "discontinued" ? " — paused" : ""}</p>}
      {medication.notes && <p className="medication__notes"><span className="text-muted">Notes:</span> {medication.notes}</p>}
      <div className="button-row">
        <Button variant="secondary" size="small" onClick={() => open(medication.id)} aria-label={`Edit ${medication.name}`}>Edit</Button>
        <Button variant="secondary" size="small" onClick={() => handleStatus(medication)} disabled={busyId === medication.id} aria-label={`${statusAction(medication)}: ${medication.name}`}>{statusAction(medication)}</Button>
        <Button variant="danger" size="small" onClick={() => { setNotice(""); setError(""); setToDelete(medication); }} aria-label={`Delete ${medication.name}`}>Delete</Button>
      </div>
    </>}
  </li>;

  return (
    <PageLayout title="Medications" header={<ProfileHeader showPicture={false} />}>
      {/* For a dependent, the "Acting as" banner in the header also shows whose list this is. */}
      {forSelf ? (
        <PageTitle lead={simplified ? "Your medicines." : "Keep a list of the medicines you take, so it's ready when you see a doctor."}>
          {simplified ? "Medicines" : "My medications"}
        </PageTitle>
      ) : (
        <PageTitle lead={simplified ? `Medicines for ${name}.` : `Keep a list of the medicines ${name} takes, so it's ready when they see a doctor.`}>
          {simplified ? `Medicines for ${name}` : `Medications for ${name}`}
        </PageTitle>
      )}

      {profilesError && <Alert tone="danger" as="p" role="alert">{profilesError}</Alert>}
      {notice && <div className="action-toast" role="status"><span>{notice}</span>{undoStatus && <Button variant="secondary" size="small" onClick={handleUndoStatus} disabled={busyId === undoStatus.medication.id}>Undo</Button>}</div>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}

      {loadError && (
        <div className="stack">
          <Alert tone="danger" as="p" role="alert">{loadError}</Alert>
          <div><Button variant="secondary" onClick={load}>Try again</Button></div>
        </div>
      )}

      {!loadError && !profilesError && medications === null && <HeartbeatLoader label="Loading medications..." />}

      {medications !== null && (
        <>
          {editing === "add" ? (
            <MedicationForm idPrefix="new" initial={emptyFields()} title="Add a medication" submitLabel="Save medication" onSave={handleAdd} onCancel={() => setEditing(null)} />
          ) : (
            <div className="medications-actions">
              <Button onClick={() => open("add")}>{simplified ? `Add medicine${forSelf ? "" : ` for ${name}`}` : `Add medication${forSelf ? "" : ` for ${name}`}`}</Button>
              <Button variant="secondary" href="/appointments">View medication calendar</Button>
              <Button variant="secondary" href="/medication-overview">Medication overview</Button>
            </div>
          )}

          {medications.length === 0 && editing !== "add" && (
            <EmptyState illustration={<MedicineBox size="5rem" />} title="No medications yet.">
              {forSelf ? "Add the ones you take so they're ready for your doctor." : `Add the ones ${name} takes so they're ready for their doctor.`}
            </EmptyState>
          )}

          {medications.length > 0 && (
            <div className="medication-browser">
              <Input id="medication-search" type="search" label="Search medications" placeholder="Name, dose or notes" value={query} onChange={(event) => setQuery(event.target.value)} />
              {matching.length === 0 ? <EmptyState title="No medications match your search.">Try a different name, dose or note.</EmptyState> : <>
                {activeMedications.length > 0 && <ul className="medication-list" aria-label={forSelf ? "Active medications" : `Active medications for ${name}`}>{activeMedications.map(medicationRow)}</ul>}
                {discontinuedMedications.length > 0 && <details className="medication-archive">
                  <summary>Discontinued medications ({discontinuedMedications.length})</summary>
                  <ul className="medication-list" aria-label={forSelf ? "Discontinued medications" : `Discontinued medications for ${name}`}>{discontinuedMedications.map(medicationRow)}</ul>
                </details>}
              </>}
            </div>
          )}
        </>
      )}

      {toDelete && (
        <Dialog title={`Delete ${toDelete.name}?`}>
          <p>It will be removed from your list. This can't be undone.</p>
          <div className="button-row dialog__actions">
            <Button variant="danger" onClick={handleDelete} disabled={busyId === toDelete.id}>{busyId === toDelete.id ? "Deleting..." : "Yes, delete"}</Button>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={busyId === toDelete.id} autoFocus>Keep it</Button>
          </div>
        </Dialog>
      )}

    </PageLayout>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
MedicationsPage.requireSignIn = true;

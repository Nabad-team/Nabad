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

// Same limits as the backend (models/Medication.js), so the browser stops overlong text before sending it.
const LIMITS = { name: 100, dose: 40, unit: 20, frequency: 100, notes: 1000 };
const FORM_LABELS = { tablet: "Tablet", syrup: "Syrup", injection: "Injection", inhaler: "Inhaler", drops: "Drops", other: "Other" };
const emptyFields = () => ({ name: "", dose: "", unit: "", form: "tablet", frequency: "", startDate: todayString(), endDate: "", notes: "" });

// Checks what the browser can check, in the same words as the server. Returns { field: message }.
function findProblems(fields) {
  const problems = {};
  if (!fields.name.trim()) problems.name = "Enter the medication name.";
  if (!fields.startDate) problems.startDate = "Enter a valid start date.";
  if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) problems.endDate = "The end date can't be before the start date.";
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
  const [fields, setFields] = useState(initial);
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
      document.getElementById(id(Object.keys(found)[0]))?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...fields, name: fields.name.trim() });
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
      <div className="field-pair">
        <Input id={id("startDate")} label="Start date" type="date" value={fields.startDate} onChange={update("startDate")} error={problems.startDate} required />
        <Input id={id("endDate")} label="End date (optional)" type="date" min={fields.startDate || undefined} value={fields.endDate} onChange={update("endDate")} error={problems.endDate} />
      </div>
      <Input as="textarea" id={id("notes")} label="Notes (optional)" hint="For example: take with food" rows="3" value={fields.notes} onChange={update("notes")} maxLength={LIMITS.notes} />
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
  const [loadError, setLoadError] = useState("");
  // null, "add", or the id of the medication being edited. Only one form is open at a time.
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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
      await load();
    } catch (err) {
      setError(err.message || "Could not change the status. Please try again.");
    } finally {
      setBusyId(null);
    }
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
      {notice && <Alert tone="success" as="p" role="status">{notice}</Alert>}
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
              <Button onClick={() => open("add")}>{simplified ? "Add medicine" : "Add medication"}</Button>
              <Button variant="secondary" href="/appointments">View appointments</Button>
            </div>
          )}

          {medications.length === 0 && editing !== "add" && (
            <EmptyState illustration={<MedicineBox size="5rem" />} title="No medications yet.">
              {forSelf ? "Add the ones you take so they're ready for your doctor." : `Add the ones ${name} takes so they're ready for their doctor.`}
            </EmptyState>
          )}

          {medications.length > 0 && (
            <ul className="medication-list" aria-label={forSelf ? "Your medications" : `Medications for ${name}`}>
              {medications.map((medication) => (
                <li key={medication.id} className="medication">
                  {editing === medication.id ? (
                    <MedicationForm
                      idPrefix={`edit-${medication.id}`}
                      initial={{ ...emptyFields(), ...medication }}
                      title={`Edit ${medication.name}`}
                      submitLabel="Save changes"
                      onSave={(fields) => handleEdit(medication.id, fields)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <div className="medication__heading">
                        <h3>{medication.name}</h3>
                        {medication.status === "active" ? <Badge>Active</Badge> : <Badge tone="neutral">Discontinued</Badge>}
                      </div>
                      {summary(medication) && <p className="medication__summary">{summary(medication)}</p>}
                      <p className="text-muted text-sm">{dates(medication)}</p>
                      {medication.notes && <p className="medication__notes"><span className="text-muted">Notes:</span> {medication.notes}</p>}
                      <div className="button-row">
                        <Button variant="secondary" size="small" onClick={() => open(medication.id)} aria-label={`Edit ${medication.name}`}>Edit</Button>
                        {/* The spoken name starts with the visible words, so voice control users can say what they see. */}
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleStatus(medication)}
                          disabled={busyId === medication.id}
                          aria-label={`${statusAction(medication)}: ${medication.name}`}
                        >
                          {statusAction(medication)}
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => { setNotice(""); setError(""); setToDelete(medication); }} aria-label={`Delete ${medication.name}`}>Delete</Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
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

      <p className="section">
        <a href="/dashboard">Back to dashboard</a>
      </p>
    </PageLayout>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
MedicationsPage.requireSignIn = true;

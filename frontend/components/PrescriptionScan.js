import { useEffect, useRef, useState } from "react";
import Input from "./ui/Input";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import Badge from "./ui/Badge";
import { HeartbeatLoader } from "./ui/Heartbeat";
import { MEDICATION_FORMS } from "../lib/medicationApi";
import { PRESCRIPTION_TYPES, readPrescription, applyPrescription, endDateFor } from "../lib/prescriptionApi";
import { formatDate, todayString } from "../lib/dates";

// SCRUM-146: "As a user, I want to upload a photo of a prescription so that my medication list updates
// automatically."
//
// 1. Choose or take a photo (or a PDF) of the prescription, and agree to send it to the AI provider.
// 2. The medicines it lists come back already filled in and compared with the list: new ones are ticked,
//    a medicine whose dose or schedule changed replaces the old entry, and one already on the list is left out.
// 3. One button adds them. Anything the AI couldn't read clearly is not ticked until the person checks it,
//    because a misread dose would end up on the emergency card and in reminders.
//
// listName: "your list" or "Sami's list". onDone(message): the list was updated. onCancel: close.

const FORM_LABELS = { tablet: "Tablet", syrup: "Syrup", injection: "Injection", inhaler: "Inhaler", drops: "Drops", other: "Other" };
const amount = (m) => [m.dose, m.unit].filter(Boolean).join(" ");
const describe = (m) => [amount(m), m.form && m.form !== "other" ? FORM_LABELS[m.form]?.toLowerCase() : "", m.frequency].filter(Boolean).join(", ");

export default function PrescriptionScan({ profileId, listName, onDone, onCancel }) {
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState("choose"); // "choose" | "reading" | "review" | "saving"
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [unreadable, setUnreadable] = useState("");
  const [startDate, setStartDate] = useState(todayString());
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  function chooseFile(event) {
    const chosen = event.target.files?.[0] || null;
    setError("");
    if (chosen && !PRESCRIPTION_TYPES.includes(chosen.type)) {
      setFile(null);
      setError("Choose a JPG, PNG or WebP photo, or a PDF, of the prescription.");
      return;
    }
    setFile(chosen);
  }

  async function read(event) {
    event.preventDefault();
    if (!file) return setError("Choose a photo of the prescription first.");
    if (!consent) return setError("Tick the box to agree to send the photo to the AI provider.");
    setError("");
    setStep("reading");
    controller.current = new AbortController();
    try {
      const result = await readPrescription(profileId, file, controller.current.signal);
      setItems(result.medications.map((m, index) => ({
        ...m,
        key: index,
        // Ticked: new or changed and clearly read. Not ticked: already on the list, or needs checking.
        add: m.match.status !== "already-listed" && !m.needsCheck,
      })));
      setUnreadable(result.unreadable || "");
      setStep("review");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "The prescription couldn't be read. Please try again.");
      setStep("choose");
    }
  }

  const update = (key, field) => (event) => {
    const value = field === "add" ? event.target.checked : event.target.value;
    setItems((current) => current.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const chosen = items.filter((item) => item.add);

  async function save() {
    const missingName = chosen.find((item) => !item.name.trim());
    if (missingName) return setError("Enter a name for every medicine you are adding, or untick it.");
    setError("");
    setStep("saving");
    try {
      const result = await applyPrescription(profileId, chosen.map((item) => ({
        name: item.name.trim(), dose: item.dose, unit: item.unit, form: item.form, frequency: item.frequency,
        startDate, endDate: endDateFor(startDate, item.durationDays), notes: item.notes,
        ...(item.match.status === "changed" ? { replaceId: item.match.existingId } : {}),
      })));
      const added = result.added.length;
      const replaced = result.replaced.length;
      onDone(`${added} ${added === 1 ? "medicine was" : "medicines were"} added to ${listName} from the prescription${replaced ? `, replacing ${replaced} older ${replaced === 1 ? "entry" : "entries"} (kept under Discontinued)` : ""}.`);
    } catch (err) {
      setError(err.message || "The medicines couldn't be saved. Please try again.");
      setStep("review");
    }
  }

  return (
    <section className="prescription-scan" aria-labelledby="prescription-scan-title">
      <h2 id="prescription-scan-title">Add from a prescription</h2>

      {(step === "choose" || step === "reading") && (
        <form onSubmit={read} noValidate className="form">
          <p>Take a clear photo of the whole prescription, or choose a PDF. The medicines on it are filled in for you to check before anything is saved.</p>
          <div className="field">
            <label htmlFor="prescription-file" className="field__label">Prescription photo or PDF</label>
            <p id="prescription-file-hint" className="field__hint">JPG, PNG, WebP or PDF. Large phone photos are made smaller before sending.</p>
            <input id="prescription-file" className="input" type="file" accept={PRESCRIPTION_TYPES.join(",")} capture="environment"
              aria-describedby="prescription-file-hint" onChange={chooseFile} disabled={step === "reading"} />
          </div>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={step === "reading"} />
            <span>I agree to send this prescription to Nabad's AI provider to read it. Nabad doesn't keep the photo.</span>
          </label>
          {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
          {step === "reading" ? <HeartbeatLoader label="Reading the prescription..." /> : (
            <div className="form-actions">
              <Button type="submit">Read prescription</Button>
              <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            </div>
          )}
        </form>
      )}

      {(step === "review" || step === "saving") && (
        <div className="stack">
          <p>Check each medicine against the prescription. The AI can misread handwriting. Only the ticked ones are added.</p>
          {unreadable && <Alert tone="warning" as="p">Some parts couldn't be read: {unreadable}</Alert>}
          <Input id="prescription-start" label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required
            hint="Used for every medicine below. A medicine prescribed for a number of days ends on its last day." />
          <ul className="prescription-items" aria-label="Medicines found on the prescription">
            {items.map((item) => {
              const id = (field) => `rx-${item.key}-${field}`;
              const end = endDateFor(startDate, item.durationDays);
              return (
                <li key={item.key} className="prescription-item">
                  <fieldset>
                    <legend className="prescription-item__heading">
                      <span>{item.name || "Unnamed medicine"}</span>
                      {item.match.status === "new" && <Badge>New</Badge>}
                      {item.match.status === "changed" && <Badge tone="warning">Changed</Badge>}
                      {item.match.status === "already-listed" && <Badge tone="neutral">Already on {listName}</Badge>}
                      {item.needsCheck && <Badge tone="warning">Check this</Badge>}
                    </legend>
                    {item.match.status === "changed" && (
                      <p className="prescription-item__change">
                        On {listName} now: {describe(item.match.current) || "no dose or schedule"}. Adding this replaces it; the old entry is kept under Discontinued.
                      </p>
                    )}
                    {item.needsCheck && <p className="prescription-item__change">Part of this couldn't be read clearly. Check the dose and how often against the prescription before adding it.</p>}
                    <label className="check">
                      <input type="checkbox" checked={item.add} onChange={update(item.key, "add")} disabled={step === "saving"} />
                      <span>{item.match.status === "changed" ? "Replace with this prescription" : "Add this medicine"}</span>
                    </label>
                    <Input id={id("name")} label="Medication name" value={item.name} onChange={update(item.key, "name")} maxLength={100} disabled={step === "saving"} />
                    <div className="field-pair">
                      <Input id={id("dose")} label="Dose" value={item.dose} onChange={update(item.key, "dose")} maxLength={40} inputMode="decimal" disabled={step === "saving"} />
                      <Input id={id("unit")} label="Unit" value={item.unit} onChange={update(item.key, "unit")} maxLength={20} disabled={step === "saving"} />
                    </div>
                    <div className="field-pair">
                      <Input as="select" id={id("form")} label="Form" value={item.form} onChange={update(item.key, "form")} disabled={step === "saving"}>
                        {MEDICATION_FORMS.map((form) => <option key={form} value={form}>{FORM_LABELS[form]}</option>)}
                      </Input>
                      <Input id={id("frequency")} label="How often" value={item.frequency} onChange={update(item.key, "frequency")} maxLength={100} disabled={step === "saving"} />
                    </div>
                    {item.notes && <p className="text-sm"><span className="text-muted">Instructions:</span> {item.notes}</p>}
                    {end && <p className="text-sm text-muted">For {item.durationDays} {item.durationDays === 1 ? "day" : "days"}: until {formatDate(end)}.</p>}
                  </fieldset>
                </li>
              );
            })}
          </ul>
          {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
          <div className="form-actions">
            <Button onClick={save} disabled={!chosen.length || !startDate || step === "saving"}>
              {step === "saving" ? "Adding..." : chosen.length ? `Add ${chosen.length} ${chosen.length === 1 ? "medicine" : "medicines"} to ${listName}` : "Tick the medicines to add"}
            </Button>
            <Button variant="secondary" onClick={onCancel} disabled={step === "saving"}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}

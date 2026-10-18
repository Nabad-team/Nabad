import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import {
  getHealthProfile, addHealthFact, updateHealthFact, removeHealthFact, confirmSuggestion, dismissSuggestion,
} from "../lib/healthProfileApi";
import {
  SEX_OPTIONS, BLOOD_TYPE_OPTIONS, PREGNANCY_OPTIONS, SMOKING_OPTIONS, CONDITION_OPTIONS, ALLERGY_TYPE_OPTIONS, LIMITS, BASICS,
  factText, sourceText, basicsFilled, knowsYouText, pregnancyRelevant,
} from "../lib/healthProfile";
import { formatDate, todayString } from "../lib/dates";

const CATEGORY_LABELS = {
  sex: "Sex assigned at birth", height: "Height", weight: "Weight", bloodType: "Blood type", pregnancy: "Pregnancy",
  condition: "Long-term condition", allergy: "Allergy", smoking: "Smoking",
};
const ALLERGY_TYPE_WORDS = { medication: "Medication", food: "Food", other: "Something else" };

// One row of a list: what it is, its value, and where it came from ("You added this, 12 Oct").
function ItemText({ label, value, source, sourceId, empty }) {
  return (
    <div className="health-item__text">
      {label && <span className="health-item__label">{label}</span>}
      <span className={empty ? "health-item__value text-muted" : "health-item__value"}>{value}</span>
      {source && <span id={sourceId} className="health-item__source">{source}</span>}
    </div>
  );
}

// Checks a single value the way the server does. Returns an error message or "".
function problemWith(category, raw) {
  if (category === "height") {
    const [min, max] = LIMITS.height;
    const value = Number(raw);
    return raw.trim() !== "" && Number.isInteger(value) && value >= min && value <= max ? "" : `Enter a height in whole centimetres, from ${min} to ${max}.`;
  }
  if (category === "weight") {
    const [min, max] = LIMITS.weight;
    const value = Number(raw);
    const oneDecimal = Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
    return raw.trim() !== "" && oneDecimal && value >= min && value <= max ? "" : `Enter a weight in kilograms, from ${min} to ${max} (for example 72.5).`;
  }
  return raw ? "" : "Choose one of the options.";
}

// A fact there is at most one of (sex, height, blood type, smoking...): its value with Change / Remove,
// or "Not added" with Add. Editing opens a small form in place.
//   input: "radio" or "select" (with options), or "number" (with unit, step).
function SingleFact({ category, label, fact, input, options, unit, step, hint, busy, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const [problem, setProblem] = useState("");
  const fieldId = `${category}-value`;

  function start() {
    setRaw(fact ? String(fact.value) : ""); setProblem(""); setEditing(true);
  }
  async function submit(e) {
    e.preventDefault();
    const found = problemWith(category, raw);
    setProblem(found);
    if (found) {
      document.getElementById(input === "radio" ? `${category}-${options[0][0]}` : fieldId)?.focus();
      return;
    }
    try {
      await onSave(input === "number" ? Number(raw) : raw);
      setEditing(false);
    } catch (err) {
      setProblem(err.message);
    }
  }

  if (editing) {
    return (
      <li className="health-item health-item--editing">
        <form onSubmit={submit} noValidate className="form">
          {input === "radio" && (
            <fieldset className="choice-group" aria-describedby={problem ? `${fieldId}-error` : undefined}>
              <legend>{label}</legend>
              {options.map(([value, text]) => (
                <label key={value} className="check">
                  <input type="radio" id={`${category}-${value}`} name={fieldId} value={value} checked={raw === value} onChange={(e) => setRaw(e.target.value)} />
                  {text}
                </label>
              ))}
              {problem && <p id={`${fieldId}-error`} className="field__error">{problem}</p>}
            </fieldset>
          )}
          {input === "select" && (
            <Input as="select" id={fieldId} label={label} hint={hint} value={raw} onChange={(e) => setRaw(e.target.value)} error={problem}>
              <option value="">Choose...</option>
              {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </Input>
          )}
          {input === "number" && (
            <Input
              id={fieldId} label={`${label} (${unit})`} hint={hint} type="number" inputMode="decimal" step={step}
              value={raw} onChange={(e) => setRaw(e.target.value)} error={problem}
            />
          )}
          <div className="form-actions">
            <Button type="submit" disabled={busy}>Save</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li className="health-item">
      <ItemText label={label} value={fact ? factText(fact) : "Not added"} empty={!fact} source={fact && sourceText(fact)} />
      <div className="button-row">
        {fact ? (
          <>
            <Button variant="secondary" size="small" onClick={start} aria-label={`Change ${label.toLowerCase()}`}>Change</Button>
            <Button variant="secondary" size="small" onClick={onRemove} disabled={busy} aria-label={`Remove ${label.toLowerCase()}`}>Remove</Button>
          </>
        ) : (
          <Button variant="secondary" size="small" onClick={start} aria-label={`Add ${label.toLowerCase()}`}>Add</Button>
        )}
      </div>
    </li>
  );
}

// The gentle "Nabad knows you better" count of basics: a row of dots and a sentence. Never a warning.
function KnowsYou({ filled, who }) {
  return (
    <div className="knows-you">
      <span className="knows-you__dots" aria-hidden="true">
        {BASICS.map((basic, i) => <span key={basic} className={i < filled ? "knows-you__dot knows-you__dot--filled" : "knows-you__dot"} />)}
      </span>
      <p>{knowsYouText(filled, who)}</p>
    </div>
  );
}

// Suggestions (for example from a lab report, in a later phase) wait here until the user confirms or dismisses them.
function Suggestions({ suggestions, busy, onConfirm, onDismiss }) {
  return (
    <section className="section" aria-labelledby="suggestions-heading">
      <h2 id="suggestions-heading">Suggestions to review</h2>
      {suggestions.length === 0 ? (
        <p className="text-muted">Nothing to review. Later, when Nabad reads something like a lab report for you, what it finds will wait here for you to check. Nothing is used until you confirm it.</p>
      ) : (
        <ul className="health-list" aria-label="Suggestions to review">
          {suggestions.map((fact) => (
            <li key={fact.id} className="health-item">
              <ItemText label={CATEGORY_LABELS[fact.category]} value={factText(fact)} source={sourceText(fact)} />
              <div className="button-row">
                <Button size="small" onClick={() => onConfirm(fact)} disabled={busy} aria-label={`Confirm ${factText(fact)}`}>Confirm</Button>
                <Button variant="secondary" size="small" onClick={() => onDismiss(fact)} disabled={busy} aria-label={`Dismiss ${factText(fact)}`}>Dismiss</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// A one-field form for an "Other" condition's name: adding a new one, or editing one (initial).
function OtherConditionForm({ id, initial = "", busy, onSave, onCancel }) {
  const [text, setText] = useState(initial);
  const [problem, setProblem] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) { setProblem("Enter the condition's name."); document.getElementById(id)?.focus(); return; }
    try {
      await onSave(text.trim());
    } catch (err) {
      setProblem(err.message);
    }
  }
  return (
    <form onSubmit={submit} noValidate className="form">
      <Input id={id} label="Condition" hint="In your own words, for example migraine." maxLength={LIMITS.text}
        value={text} onChange={(e) => setText(e.target.value)} error={problem} autoFocus />
      <div className="form-actions">
        <Button type="submit" disabled={busy}>Save condition</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// The checklist of common conditions (ticking one saves it, unticking removes it) and any others, in the user's words.
function Conditions({ facts, who, busy, change, changeOrThrow, profileId }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const listed = (code) => facts.find((fact) => fact.value.code === code);
  const others = facts.filter((fact) => fact.value.code === "other");

  return (
    <section className="section" aria-labelledby="conditions-heading">
      <h2 id="conditions-heading">Long-term conditions</h2>
      <fieldset className="choice-group health-checklist">
        <legend>{who ? `Does ${who} have any of these?` : "Do you have any of these?"}</legend>
        {CONDITION_OPTIONS.map(([code, label]) => {
          const fact = listed(code);
          return (
            <div key={code} className="health-checklist__item">
              <label className="check">
                <input
                  type="checkbox" checked={Boolean(fact)} disabled={busy}
                  aria-describedby={fact ? `condition-${code}-source` : undefined}
                  onChange={() => change(() => (fact ? removeHealthFact(profileId, fact.id) : addHealthFact(profileId, "condition", { code })))}
                />
                {label}
              </label>
              {fact && <span id={`condition-${code}-source`} className="health-item__source">{sourceText(fact)}</span>}
            </div>
          );
        })}
      </fieldset>

      <h3 className="health-subheading">Other conditions</h3>
      {others.length > 0 && (
        <ul className="health-list" aria-label="Other conditions">
          {others.map((fact) => (editingId === fact.id ? (
            <li key={fact.id} className="health-item health-item--editing">
              <OtherConditionForm
                id={`condition-${fact.id}`} initial={fact.value.text} busy={busy}
                onSave={(text) => changeOrThrow(() => updateHealthFact(profileId, fact.id, { code: "other", text })).then(() => setEditingId(null))}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={fact.id} className="health-item">
              <ItemText value={fact.value.text} source={sourceText(fact)} />
              <div className="button-row">
                <Button variant="secondary" size="small" onClick={() => setEditingId(fact.id)} aria-label={`Change ${fact.value.text}`}>Change</Button>
                <Button variant="secondary" size="small" disabled={busy} onClick={() => change(() => removeHealthFact(profileId, fact.id))} aria-label={`Remove ${fact.value.text}`}>Remove</Button>
              </div>
            </li>
          )))}
        </ul>
      )}
      {adding ? (
        <OtherConditionForm
          id="condition-new" busy={busy}
          onSave={(text) => changeOrThrow(() => addHealthFact(profileId, "condition", { code: "other", text })).then(() => setAdding(false))}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="secondary" size="small" onClick={() => setAdding(true)}>Add another condition</Button>
      )}
    </section>
  );
}

// What the allergy is to, the kind (medication, food, something else), and an optional reaction note.
function AllergyForm({ initial, who, busy, onSave, onCancel }) {
  const [type, setType] = useState(initial?.type || "");
  const [name, setName] = useState(initial?.name || "");
  const [reaction, setReaction] = useState(initial?.reaction || "");
  const [problems, setProblems] = useState({});
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!type) found.type = "Choose what the allergy is to: a medication, a food or something else.";
    if (!name.trim()) found.name = who ? `Enter what ${who} is allergic to.` : "Enter what you are allergic to.";
    setProblems(found); setError("");
    if (found.type) { document.getElementById("allergy-type-medication")?.focus(); return; }
    if (found.name) { document.getElementById("allergy-name")?.focus(); return; }
    try {
      await onSave({ type, name: name.trim(), reaction: reaction.trim() });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="form">
      <fieldset className="choice-group" aria-describedby={problems.type ? "allergy-type-error" : undefined}>
        <legend>What kind of allergy?</legend>
        {ALLERGY_TYPE_OPTIONS.map(([value, text]) => (
          <label key={value} className="check">
            <input type="radio" id={`allergy-type-${value}`} name="allergy-type" value={value} checked={type === value} onChange={(e) => setType(e.target.value)} />
            {text}
          </label>
        ))}
        {problems.type && <p id="allergy-type-error" className="field__error">{problems.type}</p>}
      </fieldset>
      <Input id="allergy-name" label="Allergic to" hint="For example penicillin, peanuts or latex." maxLength={LIMITS.text}
        value={name} onChange={(e) => setName(e.target.value)} error={problems.name} />
      <Input as="textarea" id="allergy-reaction" label="Reaction (optional)" hint="What happens, for example a rash or swelling." rows="2"
        maxLength={LIMITS.reaction} value={reaction} onChange={(e) => setReaction(e.target.value)} />
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>Save allergy</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function Allergies({ facts, who, busy, change, changeOrThrow, profileId }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  return (
    <section className="section" aria-labelledby="allergies-heading">
      <h2 id="allergies-heading">Allergies</h2>
      {facts.length === 0 && !adding && <p className="text-muted">No allergies added.</p>}
      {facts.length > 0 && (
        <ul className="health-list" aria-label="Allergies">
          {facts.map((fact) => (editingId === fact.id ? (
            <li key={fact.id} className="health-item health-item--editing">
              <AllergyForm
                initial={fact.value} who={who} busy={busy}
                onSave={(value) => changeOrThrow(() => updateHealthFact(profileId, fact.id, value)).then(() => setEditingId(null))}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={fact.id} className="health-item">
              <ItemText
                label={ALLERGY_TYPE_WORDS[fact.value.type]}
                value={fact.value.reaction ? `${fact.value.name} · reaction: ${fact.value.reaction}` : fact.value.name}
                source={sourceText(fact)}
              />
              <div className="button-row">
                <Button variant="secondary" size="small" onClick={() => { setAdding(false); setEditingId(fact.id); }} aria-label={`Change ${fact.value.name}`}>Change</Button>
                <Button variant="secondary" size="small" disabled={busy} onClick={() => change(() => removeHealthFact(profileId, fact.id))} aria-label={`Remove ${fact.value.name}`}>Remove</Button>
              </div>
            </li>
          )))}
        </ul>
      )}
      {adding ? (
        <AllergyForm
          who={who} busy={busy}
          onSave={(value) => changeOrThrow(() => addHealthFact(profileId, "allergy", value)).then(() => setAdding(false))}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="secondary" size="small" onClick={() => { setEditingId(null); setAdding(true); }}>Add an allergy</Button>
      )}
    </section>
  );
}

// "500 mg · twice a day"
function medicationDetails(medication) {
  const amount = [medication.dose, medication.unit].filter(Boolean).join(" ");
  return [amount, medication.frequency].filter(Boolean).join(" · ");
}

export default function MyHealthPage() {
  const { activeProfile, error: profilesError } = useActiveProfile();
  const profileId = activeProfile?.id;
  const who = activeProfile && !activeProfile.isSelf ? activeProfile.fullName : null;
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The profile the latest load was for, so a slow answer for a previous profile is never shown.
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  async function load() {
    const requested = profileRef.current;
    setLoadError("");
    try {
      const data = await getHealthProfile(requested, todayString());
      if (profileRef.current === requested) setProfile(data);
    } catch {
      if (profileRef.current === requested) setLoadError("We couldn't load this health information. Please check your connection and try again.");
    }
  }
  useEffect(() => {
    if (!profileId) return;
    setProfile(null); setError("");
    load();
  }, [profileId]);

  // Runs a change, then reloads, so the page and the summary always agree with what is saved.
  async function change(action) {
    setBusy(true); setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message || "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  // For forms that show the error next to their own fields.
  async function changeOrThrow(action) {
    setBusy(true); setError("");
    try {
      await action();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const fact = (category) => profile?.facts.find((item) => item.category === category);
  const facts = (category) => (profile ? profile.facts.filter((item) => item.category === category) : []);
  // Adds the fact, or changes the one already there.
  const saveSingle = (category) => (value) => {
    const current = fact(category);
    return changeOrThrow(() => (current ? updateHealthFact(profileId, current.id, value) : addHealthFact(profileId, category, value)));
  };
  const single = (category, props) => (
    <SingleFact
      category={category} label={CATEGORY_LABELS[category]} fact={fact(category)} busy={busy}
      onSave={saveSingle(category)} onRemove={() => change(() => removeHealthFact(profileId, fact(category).id))}
      {...props}
    />
  );
  const sections = { busy, who, change, changeOrThrow, profileId };

  return (
    <PageLayout title="My health" header={<ProfileHeader showPicture={false} />}>
      {who ? (
        <PageTitle lead={`Nabad uses this to give safer guidance for ${who}. Everything here is optional, and you can change it anytime.`}>Health for {who}</PageTitle>
      ) : (
        <PageTitle lead="Nabad uses this to give you safer guidance. Everything here is optional, and you can change it anytime.">My health</PageTitle>
      )}

      {profilesError && <Alert tone="danger" as="p" role="alert">{profilesError}</Alert>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {loadError && (
        <div className="stack">
          <Alert tone="danger" as="p" role="alert">{loadError}</Alert>
          <div><Button variant="secondary" onClick={load}>Try again</Button></div>
        </div>
      )}
      {!loadError && !profilesError && !profile && <HeartbeatLoader label="Loading health information..." />}

      {profile && (
        // key: fresh forms for each profile, so nothing typed for one person shows up for another.
        <div key={profileId}>
          <KnowsYou filled={basicsFilled(profile)} who={who} />

          <Suggestions
            suggestions={profile.suggestions} busy={busy}
            onConfirm={(item) => change(() => confirmSuggestion(profileId, item.id))}
            onDismiss={(item) => change(() => dismissSuggestion(profileId, item.id))}
          />

          <section className="section" aria-labelledby="basics-heading">
            <h2 id="basics-heading">Basics</h2>
            <ul className="health-list" aria-label="Basics">
              <li className="health-item">
                {profile.age ? (
                  <ItemText label="Age" value={profile.age.text} source={`From the date of birth, ${formatDate(profile.dateOfBirth)}`} />
                ) : (
                  <ItemText label="Age" value="Not added" empty />
                )}
                {!profile.age && activeProfile.isSelf && <Button variant="secondary" size="small" href="/profile">Add your date of birth</Button>}
              </li>
              {single("sex", { input: "radio", options: SEX_OPTIONS })}
              {single("height", { input: "number", unit: "cm", step: "1" })}
              {single("weight", { input: "number", unit: "kg", step: "0.1" })}
              {single("bloodType", { input: "select", options: BLOOD_TYPE_OPTIONS, hint: "It's on a blood test or a donor card. \"I don't know\" is fine." })}
            </ul>
          </section>

          {pregnancyRelevant(profile) && (
            <section className="section" aria-labelledby="pregnancy-heading">
              <h2 id="pregnancy-heading">Pregnancy</h2>
              <p className="text-muted">Some guidance and medicines are different during pregnancy.</p>
              <ul className="health-list" aria-label="Pregnancy">
                {single("pregnancy", { input: "radio", options: PREGNANCY_OPTIONS })}
              </ul>
            </section>
          )}

          <Conditions facts={facts("condition")} {...sections} />
          <Allergies facts={facts("allergy")} {...sections} />

          <section className="section" aria-labelledby="medications-heading">
            <h2 id="medications-heading">Medications</h2>
            {profile.medications.length === 0 ? (
              <p className="text-muted">No current medications.</p>
            ) : (
              <ul className="health-list" aria-label="Current medications">
                {profile.medications.map((medication) => (
                  <li key={medication.id} className="health-item">
                    <ItemText value={medication.name} source={medicationDetails(medication)} />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted">These come from the medications list, where you can change them.</p>
            <Button variant="secondary" size="small" href="/medications">Manage medications</Button>
          </section>

          <section className="section" aria-labelledby="lifestyle-heading">
            <h2 id="lifestyle-heading">Lifestyle</h2>
            <ul className="health-list" aria-label="Lifestyle">
              {single("smoking", { input: "radio", options: SMOKING_OPTIONS })}
            </ul>
          </section>

          <section className="section" aria-labelledby="summary-heading">
            <h2 id="summary-heading">What Nabad's guidance takes into account</h2>
            <p className="text-muted">This is exactly what Nabad will use when it gives {who ? `${who} ` : "you "}guidance.</p>
            <pre className="health-summary">{profile.summary}</pre>
            <p className="text-muted">
              The last line, about water and sleep, appears only when something was logged in the last 7 days: today's fluids
              (with the daily goal, if one is set) and the average sleep. It lists facts only. You can update them
              in <a href="/water-and-sleep">Water and sleep</a>.
            </p>
          </section>
        </div>
      )}

      <p className="section">
        <a href="/dashboard">Back to dashboard</a>
      </p>
    </PageLayout>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
MyHealthPage.requireSignIn = true;

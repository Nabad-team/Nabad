import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import WeekChart from "../components/WeekChart";
import DoctorSummary from "../components/DoctorSummary";
import { TwoHearts } from "../components/illustrations";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { todayString } from "../lib/dates";
import {
  getToday, getHistory, addDrink, undoLastDrink, setWaterGoal, clearWaterGoal, saveSleep, deleteSleep,
} from "../lib/wellbeingApi";
import {
  QUALITY_WORDS, GLASS_ML, BOTTLE_ML, DRINK_ML, GOAL_ML, litresText, mlText, timeText, hoursText, sleptText, sleepTimesText,
  hoursBetween, waterCountText, waterGoalText, limitStatus, weekSummary, weekObservation,
} from "../lib/wellbeing";

// Today's fluids: the total in litres, quick-add buttons (a glass, a bottle or a custom amount), undo for the
// last drink, the day's log with times, and the optional goal. No "drink more" wording unless the user set a
// "Drink at least" goal; with a "Stay under" limit, only a calm note near or over it.
function WaterToday({ water, who, onAdd, onUndo, onSetGoal, onClearGoal, busy }) {
  const { totalMl, entries, goal } = water;
  const [customOpen, setCustomOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const status = limitStatus(totalMl, goal);
  const goalLine = waterGoalText(totalMl, goal, who);
  const last = entries[entries.length - 1];
  // How far along the goal or limit the day is. The bar repeats the text, so screen readers skip it.
  const progress = goal ? Math.min(100, (totalMl / goal.ml) * 100) : 0;

  return (
    <section className="section tracker" aria-labelledby="water-heading">
      <h2 id="water-heading">Water today</h2>
      <div role="status" className="tracker__status">
        <p className="tracker__count">
          <strong>{waterCountText(totalMl, goal)}</strong>
          {goalLine && !status && <span className="text-muted"> {goalLine}</span>}
        </p>
        {status && <Alert tone="warning" as="p">{goalLine}</Alert>}
      </div>
      {goal && (
        <div className="fluid-progress" aria-hidden="true">
          <div className={`fluid-progress__bar${status ? " fluid-progress__bar--limit" : ""}`} style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="button-row drink-buttons">
        <Button variant="secondary" onClick={() => onAdd(GLASS_ML)} disabled={busy}>Glass ({mlText(GLASS_ML)})</Button>
        <Button variant="secondary" onClick={() => onAdd(BOTTLE_ML)} disabled={busy}>Bottle ({mlText(BOTTLE_ML)})</Button>
        <Button variant="secondary" onClick={() => setCustomOpen(!customOpen)} aria-expanded={customOpen} aria-controls={customOpen ? "custom-drink" : undefined}>
          Custom amount
        </Button>
      </div>
      {customOpen && (
        <CustomDrinkForm busy={busy} onCancel={() => setCustomOpen(false)} onAdd={async (ml) => { await onAdd(ml, { rethrow: true }); setCustomOpen(false); }} />
      )}

      {entries.length > 0 && (
        <div className="drink-log">
          <h3 id="drink-log-heading">Today's log</h3>
          <ul aria-labelledby="drink-log-heading">
            {entries.map((entry, i) => (
              <li key={i}><span className="drink-log__time">{timeText(entry.at)}</span> {mlText(entry.ml)}</li>
            ))}
          </ul>
          <Button variant="secondary" size="small" onClick={onUndo} disabled={busy} aria-describedby="undo-detail">Undo last drink</Button>
          <span id="undo-detail" className="visually-hidden">{`${mlText(last.ml)} at ${timeText(last.at)}`}</span>
        </div>
      )}

      {editingGoal ? (
        <GoalForm goal={goal} who={who} busy={busy} onCancel={() => setEditingGoal(false)}
          onSave={async (value) => { await onSetGoal(value); setEditingGoal(false); }} />
      ) : (
        <div className="tracker__target">
          {goal ? (
            <>
              <p className="text-muted">{goal.type === "atMost" ? "Daily limit: stay under" : "Daily goal: drink at least"} {litresText(goal.ml)} a day</p>
              <div className="button-row">
                <Button variant="secondary" size="small" onClick={() => setEditingGoal(true)}>Change goal</Button>
                <Button variant="secondary" size="small" onClick={onClearGoal} disabled={busy}>Remove goal</Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" size="small" onClick={() => setEditingGoal(true)}>Set a daily goal</Button>
          )}
        </div>
      )}
    </section>
  );
}

// Any amount in whole millilitres, for a drink that isn't a glass or a bottle.
function CustomDrinkForm({ busy, onAdd, onCancel }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [min, max] = DRINK_ML;

  async function submit(e) {
    e.preventDefault();
    const ml = Number(value);
    if (value.trim() === "" || !Number.isInteger(ml) || ml < min || ml > max) {
      setError(`Enter an amount from ${min} to ${max} ml, in whole millilitres.`);
      document.getElementById("drink-ml")?.focus();
      return;
    }
    try {
      await onAdd(ml);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form id="custom-drink" onSubmit={submit} noValidate className="form tracker__custom">
      <Input id="drink-ml" label="Amount (ml)" hint="For example 330 for a can" type="number" inputMode="numeric"
        min={min} max={max} step="1" value={value} onChange={(e) => setValue(e.target.value)} error={error} autoFocus />
      <div className="form-actions">
        <Button type="submit" disabled={busy}>Add drink</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// The daily goal: "Drink at least" or "Stay under" (a fluid limit), in ml or litres. goal: the current one or null.
function GoalForm({ goal, who, busy, onSave, onCancel }) {
  const inLitres = !goal || goal.ml % 100 === 0 && goal.ml >= 1000;
  const [type, setType] = useState(goal ? goal.type : "");
  const [amount, setAmount] = useState(goal ? String(inLitres ? goal.ml / 1000 : goal.ml) : "");
  const [unit, setUnit] = useState(inLitres ? "L" : "ml");
  const [problems, setProblems] = useState({});
  const [min, max] = GOAL_ML;

  async function submit(e) {
    e.preventDefault();
    const value = Number(amount);
    const ml = Math.round(unit === "L" ? value * 1000 : value);
    const found = {};
    if (!type) found.type = "Choose \"Drink at least\" or \"Stay under\".";
    if (amount.trim() === "" || !Number.isFinite(value) || ml < min || ml > max) found.amount = `Enter an amount from ${min} ml to ${max / 1000} litres.`;
    setProblems(found);
    if (found.type) { document.getElementById("goal-type-atLeast")?.focus(); return; }
    if (found.amount) { document.getElementById("goal-amount")?.focus(); return; }
    try {
      await onSave({ type, ml });
    } catch (err) {
      setProblems({ amount: err.message });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="form tracker__target">
      <fieldset className="choice-group" aria-describedby={problems.type ? "goal-type-error" : undefined}>
        <legend>Daily goal</legend>
        {[["atLeast", "Drink at least"], ["atMost", "Stay under (a fluid limit)"]].map(([value, label]) => (
          <label key={value} className="check">
            <input type="radio" id={`goal-type-${value}`} name="goal-type" value={value} checked={type === value} onChange={() => setType(value)} />
            {label}
          </label>
        ))}
        {problems.type && <p id="goal-type-error" className="field__error">{problems.type}</p>}
      </fieldset>
      {/* Above the row, so the amount and its unit line up; still read with the amount field. */}
      <p id="goal-hint" className="field__hint">
        {`Only if a goal suits ${who || "you"}. If a doctor has given ${who ? "them" : "you"} a fluid limit, choose "Stay under" and use the amount the doctor gave.`}
      </p>
      <div className="amount-unit">
        <Input
          id="goal-amount" label="Amount a day" aria-describedby="goal-hint"
          type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} error={problems.amount}
        />
        <Input as="select" id="goal-unit" label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="L">litres (L)</option>
          <option value="ml">millilitres (ml)</option>
        </Input>
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={busy}>Save goal</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// This morning's sleep: the saved entry with Edit / Remove, or the form (when nothing is logged, or editing).
function SleepToday({ sleep, who, onSave, onDelete, busy }) {
  const [editing, setEditing] = useState(false);
  const showForm = !sleep || editing;
  const times = sleepTimesText(sleep);

  async function save(entry) {
    await onSave(entry);
    setEditing(false);
  }

  return (
    <section className="section tracker" aria-labelledby="sleep-heading">
      <h2 id="sleep-heading">Last night's sleep</h2>
      {showForm ? (
        // A fresh form for each case (key), so it starts from the saved entry when editing and empty
        // otherwise, and never shows values left over from before (for example after Remove).
        <SleepForm
          key={sleep && editing ? "edit" : "new"}
          initial={sleep && editing ? sleep : null}
          who={who} busy={busy} onSave={save}
          onCancel={sleep ? () => setEditing(false) : null}
        />
      ) : (
        <>
          <p className="tracker__count"><strong>{hoursText(sleep.hours)}</strong> · {sleptText(sleep.quality)}</p>
          {times && <p className="text-muted">{times}</p>}
          {sleep.note && <p><span className="text-muted">Note:</span> {sleep.note}</p>}
          <div className="button-row">
            <Button variant="secondary" size="small" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="secondary" size="small" onClick={onDelete} disabled={busy}>Remove</Button>
          </div>
        </>
      )}
    </section>
  );
}

// Hours slept (typed, or worked out from bedtime and wake-up time), how well, and an optional note.
// initial: the saved entry when editing, otherwise null.
function SleepForm({ initial, who, busy, onSave, onCancel }) {
  const fromTimes = Boolean(initial?.bedtime && initial?.wakeTime);
  const [hours, setHours] = useState(initial && !fromTimes ? String(initial.hours) : "");
  const [bedtime, setBedtime] = useState(initial?.bedtime || "");
  const [wakeTime, setWakeTime] = useState(initial?.wakeTime || "");
  const [quality, setQuality] = useState(initial ? String(initial.quality) : "");
  const [note, setNote] = useState(initial?.note || "");
  const [problems, setProblems] = useState({});
  const [error, setError] = useState("");
  const worked = hoursBetween(bedtime, wakeTime);
  const usingTimes = Boolean(bedtime || wakeTime);

  async function submit(e) {
    e.preventDefault();
    const value = Number(hours);
    const found = {};
    if (usingTimes) {
      if (!bedtime || !wakeTime) found.times = "Enter both bedtime and wake-up time, or clear them to type the hours.";
      else if (worked === null) found.times = "Bedtime and wake-up time can't be the same. Clear them and type the hours instead.";
    } else if (hours.trim() === "" || !Number.isFinite(value) || value < 0 || value > 24 || !Number.isInteger(value * 2)) {
      found.hours = "Enter the hours slept, from 0 to 24, in half hours (for example 7.5), or a bedtime and wake-up time.";
    }
    if (!quality) found.quality = "Choose how well the night went.";
    setProblems(found); setError("");
    if (found.hours) { document.getElementById("sleep-hours")?.focus(); return; }
    if (found.times) { document.getElementById(bedtime ? "sleep-wake" : "sleep-bedtime")?.focus(); return; }
    if (found.quality) { document.getElementById("sleep-quality-1")?.focus(); return; }
    const entry = usingTimes ? { bedtime, wakeTime } : { hours: value };
    try {
      await onSave({ ...entry, quality: Number(quality), note: note.trim() });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="form">
      <Input
        id="sleep-hours" label="Hours slept"
        hint={usingTimes ? "Worked out from bedtime and wake-up time." : "For example 7 or 7.5. Or enter bedtime and wake-up time below instead."}
        type="number" inputMode="decimal" min="0" max="24" step="0.5"
        value={usingTimes ? (worked === null ? "" : String(worked)) : hours} readOnly={usingTimes}
        onChange={(e) => setHours(e.target.value)} error={problems.hours}
      />
      <fieldset className="choice-group sleep-times" aria-describedby={problems.times ? "sleep-times-error" : undefined}>
        <legend>Bedtime and wake-up time (optional)</legend>
        <div className="sleep-times__fields">
          <Input id="sleep-bedtime" label="Bedtime" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} aria-invalid={problems.times ? true : undefined} />
          <Input id="sleep-wake" label="Wake-up time" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} aria-invalid={problems.times ? true : undefined} />
        </div>
        {worked !== null && <p className="text-muted" aria-live="polite">That's {hoursText(worked)}.</p>}
        {usingTimes && (
          <Button variant="secondary" size="small" onClick={() => { setBedtime(""); setWakeTime(""); }}>Clear times</Button>
        )}
        {problems.times && <p id="sleep-times-error" className="field__error">{problems.times}</p>}
      </fieldset>
      <fieldset className="choice-group" aria-describedby={problems.quality ? "sleep-quality-error" : undefined}>
        <legend>How well did {who ? who : "you"} sleep?</legend>
        {QUALITY_WORDS.map((word, i) => (
          <label key={word} className="check">
            <input type="radio" id={`sleep-quality-${i + 1}`} name="sleep-quality" value={String(i + 1)}
              checked={quality === String(i + 1)} onChange={(e) => setQuality(e.target.value)} />
            {word}
          </label>
        ))}
        {problems.quality && <p id="sleep-quality-error" className="field__error">{problems.quality}</p>}
      </fieldset>
      <Input as="textarea" id="sleep-note" label="Note (optional)" rows="2" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>Save sleep</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

export default function WaterAndSleepPage() {
  const { activeProfile, error: profilesError } = useActiveProfile();
  const profileId = activeProfile?.id;
  const who = activeProfile && !activeProfile.isSelf ? activeProfile.fullName : null;
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doctorOpen, setDoctorOpen] = useState(false);
  // The profile the latest load was for, so a slow answer for a previous profile is never shown.
  const profileRef = useRef(profileId);
  const pendingChange = useRef(null);
  profileRef.current = profileId;

  async function load() {
    const requested = profileRef.current;
    const date = todayString();
    setLoadError("");
    try {
      const [todayData, historyData] = await Promise.all([getToday(requested, date), getHistory(requested, date)]);
      if (profileRef.current !== requested) return;
      setToday(todayData); setHistory(historyData);
    } catch {
      if (profileRef.current === requested) setLoadError("We couldn't load water and sleep. Please check your connection and try again.");
    }
  }
  useEffect(() => {
    if (!profileId) return;
    setToday(null); setHistory(null); setError(""); setDoctorOpen(false);
    pendingChange.current = null; setBusy(false);
    load();
  }, [profileId]);

  // Update today and the chart from the save response; no extra round trips.
  function applyPatch(patch, day) {
    setToday((current) => ({ ...current, ...patch }));
    setHistory((current) => current && ({
      ...current,
      ...(patch.water ? { goal: patch.water.goal } : {}),
      days: current.days.map((entry) => entry.date !== day ? entry : ({
        ...entry,
        ...(patch.water ? { totalMl: patch.water.entries.length ? patch.water.totalMl : null } : {}),
        ...("sleep" in patch ? { sleep: patch.sleep } : {}),
      })),
    }));
  }

  async function change(action, { optimistic, rethrow = false } = {}) {
    if (pendingChange.current) return;
    const operation = {};
    const requested = profileId;
    const previousToday = today;
    const previousHistory = history;
    pendingChange.current = operation;
    setBusy(true); setError("");
    if (optimistic) applyPatch(optimistic, today.date);
    try {
      const patch = await action();
      if (profileRef.current === requested && pendingChange.current === operation) applyPatch(patch, previousToday.date);
    } catch (err) {
      if (profileRef.current === requested && pendingChange.current === operation) {
        if (optimistic) { setToday(previousToday); setHistory(previousHistory); }
        if (!rethrow) setError(err.message || "That didn't work. Please try again.");
      }
      if (rethrow) throw err;
    } finally {
      if (pendingChange.current === operation) { pendingChange.current = null; setBusy(false); }
    }
  }

  const summary = history && weekSummary(history.days);
  const observation = history ? weekObservation(history.days, history.goal, who) : "";
  const date = today?.date;
  const goal = history?.goal;

  return (
    <PageLayout title="Water and sleep" header={<ProfileHeader showPicture={false} />}>
      {who ? (
        <PageTitle lead={`A simple daily log of ${who}'s water and sleep.`}>Water and sleep for {who}</PageTitle>
      ) : (
        <PageTitle lead="A simple daily log of your water and sleep.">Water and sleep</PageTitle>
      )}

      {profilesError && <Alert tone="danger" as="p" role="alert">{profilesError}</Alert>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {loadError && (
        <div className="stack">
          <Alert tone="danger" as="p" role="alert">{loadError}</Alert>
          <div><Button variant="secondary" onClick={load}>Try again</Button></div>
        </div>
      )}
      {!loadError && !profilesError && !today && <HeartbeatLoader label="Loading water and sleep..." />}

      {today && history && (
        // key: a fresh form for each profile, so nothing typed for one person shows up for another.
        <div key={profileId}>
          <div className="wellbeing-overview">
          <WaterToday
            water={today.water} who={who} busy={busy}
            onAdd={(ml, { rethrow } = {}) => change(() => addDrink(profileId, date, ml).then((water) => ({ water })), {
              rethrow,
              optimistic: { water: { ...today.water, totalMl: today.water.totalMl + ml, entries: [...today.water.entries, { ml, at: new Date().toISOString() }] } },
            })}
            onUndo={() => change(() => undoLastDrink(profileId, date).then((water) => ({ water })), {
              optimistic: { water: { ...today.water, totalMl: Math.max(0, today.water.totalMl - (today.water.entries.at(-1)?.ml || 0)), entries: today.water.entries.slice(0, -1) } },
            })}
            onSetGoal={(value) => change(() => setWaterGoal(profileId, value).then((goal) => ({ water: { ...today.water, goal } })), { rethrow: true })}
            onClearGoal={() => change(() => clearWaterGoal(profileId).then(() => ({ water: { ...today.water, goal: null } })))}
          />
          <SleepToday
            sleep={today.sleep} who={who} busy={busy}
            onSave={(entry) => change(() => saveSleep(profileId, date, entry).then((sleep) => ({ sleep })), { rethrow: true })}
            onDelete={() => change(() => deleteSleep(profileId, date).then(() => ({ sleep: null })))}
          />
          </div>

          <section className="section" aria-labelledby="week-heading">
            <h2 id="week-heading">This week</h2>
            {!summary.hasData ? (
              <EmptyState illustration={<TwoHearts size="5rem" />} title="Nothing logged this week yet.">
                The week will show here as you log water and sleep.
              </EmptyState>
            ) : (
              <>
                {observation && <Alert tone="info" as="p">{observation}</Alert>}
                <div className="week-charts">
                  <WeekChart
                    id="water-week" title="Fluids" summary={summary.water} today={date}
                    days={history.days.map((day) => ({ date: day.date, value: day.totalMl }))}
                    max={Math.max(2000, goal ? goal.ml : 0, ...history.days.map((day) => day.totalMl || 0))}
                    format={litresText}
                    reference={goal ? { value: goal.ml, label: `${goal.type === "atMost" ? "Limit" : "Goal"} ${litresText(goal.ml)}` } : null}
                  />
                  <WeekChart
                    id="sleep-week" title="Sleep" summary={summary.sleep} today={date}
                    days={history.days.map((day) => ({ date: day.date, value: day.sleep ? day.sleep.hours : null }))}
                    max={Math.max(10, ...history.days.map((day) => (day.sleep ? Math.ceil(day.sleep.hours) : 0)))}
                    format={hoursText}
                  />
                </div>
              </>
            )}
          </section>

          <section className="section doctor-section" aria-labelledby="doctor-heading">
            <h2 id="doctor-heading">Summary for your doctor</h2>
            {doctorOpen ? (
              <DoctorSummary profileId={profileId} name={activeProfile.fullName} today={date} onClose={() => setDoctorOpen(false)} />
            ) : (
              <>
                <p className="text-muted">The last 14 days of fluids and sleep in one table, to print or save as a PDF for an appointment.</p>
                <Button variant="secondary" onClick={() => setDoctorOpen(true)}>Show the summary</Button>
              </>
            )}
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
WaterAndSleepPage.requireSignIn = true;

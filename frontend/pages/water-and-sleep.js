import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import WeekChart from "../components/WeekChart";
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
  getToday, getHistory, addGlass, removeGlass, setWaterTarget, clearWaterTarget, saveSleep, deleteSleep,
} from "../lib/wellbeingApi";
import {
  QUALITY_WORDS, glassesText, hoursText, sleptText, waterCountText, waterGoalText, weekSummary, weekObservation,
} from "../lib/wellbeing";

const MAX_GLASSES = 30;

// A glass of water: filled when drunk, an outline when not (yet).
function Glass({ filled }) {
  return (
    <svg viewBox="0 0 32 40" className="glass" aria-hidden="true" focusable="false">
      {filled && <path d="M8.6 14 L10.6 35 H21.4 L23.4 14 Z" className="glass__water" />}
      <path d="M5 4 H27 L24 36 Q23.8 38 21.8 38 H10.2 Q8.2 38 8 36 Z" className="glass__outline" />
    </svg>
  );
}

// Today's water: a row of glasses (the next empty one is a big button that adds a glass), the count,
// "+ glass" / "- glass", and the optional daily goal. No "drink more" wording unless the user set a goal.
function WaterToday({ water, who, onAdd, onRemove, onSetTarget, onClearTarget, busy }) {
  const { glasses, target } = water;
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [targetError, setTargetError] = useState("");

  const slots = Math.max(glasses + 1, target || 0);
  const goal = waterGoalText(glasses, target);

  function startTarget() {
    setTargetValue(target ? String(target) : ""); setTargetError(""); setEditingTarget(true);
  }
  async function submitTarget(e) {
    e.preventDefault();
    const value = Number(targetValue);
    if (!Number.isInteger(value) || value < 1 || value > MAX_GLASSES) {
      setTargetError(`Enter a whole number of glasses from 1 to ${MAX_GLASSES}.`);
      document.getElementById("water-target")?.focus();
      return;
    }
    try {
      await onSetTarget(value);
      setEditingTarget(false);
    } catch (err) {
      setTargetError(err.message);
    }
  }

  return (
    <section className="section tracker" aria-labelledby="water-heading">
      <h2 id="water-heading">Water today</h2>
      <div className="glasses">
        {Array.from({ length: Math.min(slots, MAX_GLASSES) }, (_, i) =>
          i === glasses ? (
            <button key={i} type="button" className="glasses__add" onClick={onAdd} disabled={busy} aria-label="Add a glass">
              <Glass filled={false} />
            </button>
          ) : (
            <span key={i} className="glasses__slot"><Glass filled={i < glasses} /></span>
          )
        )}
      </div>
      <p className="tracker__count" role="status">
        <strong>{waterCountText(glasses, target)}</strong>
        {goal && <span className="text-muted"> {goal}</span>}
      </p>
      <div className="button-row">
        <Button onClick={onAdd} disabled={busy || glasses >= MAX_GLASSES}>+ glass</Button>
        <Button variant="secondary" onClick={onRemove} disabled={busy || glasses === 0}>− glass</Button>
      </div>

      {editingTarget ? (
        <form onSubmit={submitTarget} noValidate className="form tracker__target">
          <Input
            id="water-target"
            label="Daily goal (glasses)"
            hint={`Only if a goal suits ${who ? who : "you"}. If a doctor has asked ${who ? "them" : "you"} to limit fluids, follow their advice.`}
            type="number" inputMode="numeric" min="1" max={MAX_GLASSES} step="1"
            value={targetValue} onChange={(e) => setTargetValue(e.target.value)} error={targetError} autoFocus
          />
          <div className="form-actions">
            <Button type="submit" disabled={busy}>Save goal</Button>
            <Button variant="secondary" onClick={() => setEditingTarget(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="tracker__target">
          {target ? (
            <>
              <p className="text-muted">Daily goal: {glassesText(target)}</p>
              <div className="button-row">
                <Button variant="secondary" size="small" onClick={startTarget}>Change goal</Button>
                <Button variant="secondary" size="small" onClick={onClearTarget} disabled={busy}>Remove goal</Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" size="small" onClick={startTarget}>Set a daily goal</Button>
          )}
        </div>
      )}
    </section>
  );
}

// This morning's sleep: the saved entry with Edit / Remove, or the form (when nothing is logged, or editing).
function SleepToday({ sleep, who, onSave, onDelete, busy }) {
  const [editing, setEditing] = useState(false);
  const showForm = !sleep || editing;

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

// Hours slept, how well, and an optional note. initial: the saved entry when editing, otherwise null.
function SleepForm({ initial, who, busy, onSave, onCancel }) {
  const [hours, setHours] = useState(initial ? String(initial.hours) : "");
  const [quality, setQuality] = useState(initial ? String(initial.quality) : "");
  const [note, setNote] = useState(initial?.note || "");
  const [problems, setProblems] = useState({});
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const value = Number(hours);
    const found = {};
    if (hours.trim() === "" || !Number.isFinite(value) || value < 0 || value > 24 || !Number.isInteger(value * 2)) {
      found.hours = "Enter the hours slept, from 0 to 24, in half hours (for example 7.5).";
    }
    if (!quality) found.quality = "Choose how well the night went.";
    setProblems(found); setError("");
    if (found.hours) { document.getElementById("sleep-hours")?.focus(); return; }
    if (found.quality) { document.getElementById("sleep-quality-1")?.focus(); return; }
    try {
      await onSave({ hours: value, quality: Number(quality), note: note.trim() });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="form">
      <Input
        id="sleep-hours" label="Hours slept" hint="For example 7 or 7.5"
        type="number" inputMode="decimal" min="0" max="24" step="0.5"
        value={hours} onChange={(e) => setHours(e.target.value)} error={problems.hours}
      />
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
  // The profile the latest load was for, so a slow answer for a previous profile is never shown.
  const profileRef = useRef(profileId);
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
    setToday(null); setHistory(null); setError("");
    load();
  }, [profileId]);

  // Runs a change, then reloads today and the week so everything on the page agrees.
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

  const summary = history && weekSummary(history.days);
  const observation = history ? weekObservation(history.days, history.target, who) : "";
  const date = today?.date;

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
          <WaterToday
            water={today.water} who={who} busy={busy}
            onAdd={() => change(() => addGlass(profileId, date))}
            onRemove={() => change(() => removeGlass(profileId, date))}
            onSetTarget={(target) => changeOrThrow(() => setWaterTarget(profileId, target))}
            onClearTarget={() => change(() => clearWaterTarget(profileId))}
          />
          <SleepToday
            sleep={today.sleep} who={who} busy={busy}
            onSave={(entry) => changeOrThrow(() => saveSleep(profileId, date, entry))}
            onDelete={() => change(() => deleteSleep(profileId, date))}
          />

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
                    id="water-week" title="Water" summary={summary.water} today={date}
                    days={history.days.map((day) => ({ date: day.date, value: day.glasses }))}
                    max={Math.max(8, history.target || 0, ...history.days.map((day) => day.glasses || 0))}
                    format={glassesText}
                    reference={history.target ? { value: history.target, label: `Goal ${history.target}` } : null}
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

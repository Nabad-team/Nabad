import { useCallback, useEffect, useMemo, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addVital, deleteVital, listVitals } from "../lib/vitalsApi";

const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
const numberOrUndefined = value => value === "" ? undefined : Number(value);
const dateText = value => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function TrendChart({ title, readings, lines, unit }) {
  const points = readings.slice().reverse().map((reading, index) => ({ reading, x: readings.length === 1 ? 50 : 6 + index * 88 / (readings.length - 1) }));
  const values = points.flatMap(({ reading }) => lines.map(line => reading[line.key]).filter(Number.isFinite));
  if (!values.length) return <div className="vitals-chart vitals-chart--empty"><h3>{title}</h3><p className="text-muted">No readings in this range.</p></div>;
  const min = Math.min(...values), max = Math.max(...values), spread = Math.max(max - min, 1);
  const path = key => points.filter(({ reading }) => Number.isFinite(reading[key])).map(({ reading, x }, i) => `${i ? "L" : "M"}${x},${86 - (reading[key] - min) * 70 / spread}`).join(" ");
  return <section className="vitals-chart" aria-label={`${title} trend`}>
    <div className="vitals-chart__heading"><h3>{title}</h3><span>{min}–{max} {unit}</span></div>
    <svg viewBox="0 0 100 100" role="img" aria-label={`${title} values from ${min} to ${max} ${unit}`} preserveAspectRatio="none">
      {[16, 51, 86].map(y => <line key={y} x1="5" x2="95" y1={y} y2={y} className="vitals-chart__grid" />)}
      {lines.map(line => <path key={line.key} d={path(line.key)} className={`vitals-chart__line vitals-chart__line--${line.key}`} />)}
    </svg>
    {lines.length > 1 && <p className="vitals-chart__legend">{lines.map(line => <span key={line.key} className={`vitals-chart__key vitals-chart__key--${line.key}`}>{line.label}</span>)}</p>}
  </section>;
}

export default function VitalsPage() {
  const { activeProfile, error: profilesError } = useActiveProfile();
  const profileId = activeProfile?.id;
  const [range, setRange] = useState("30");
  const [readings, setReadings] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ systolic: "", diastolic: "", heartRate: "", temperature: "", recordedAt: "" });

  const load = useCallback(async () => {
    if (!profileId) return;
    setReadings(null); setError("");
    try { setReadings((await listVitals(profileId, range)).readings); }
    catch (err) { setError(err.message); }
  }, [profileId, range]);
  useEffect(() => { setForm(current => ({ ...current, recordedAt: nowLocal() })); }, [profileId]);
  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      await addVital(profileId, { systolic: numberOrUndefined(form.systolic), diastolic: numberOrUndefined(form.diastolic), heartRate: numberOrUndefined(form.heartRate), temperature: numberOrUndefined(form.temperature), recordedAt: new Date(form.recordedAt).toISOString() });
      setForm({ systolic: "", diastolic: "", heartRate: "", temperature: "", recordedAt: nowLocal() });
      setMessage("Vital reading saved."); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove(reading) {
    if (!window.confirm(`Delete the reading from ${dateText(reading.recordedAt)}?`)) return;
    setBusy(true); setError("");
    try { await deleteVital(profileId, reading.id); setMessage("Vital reading deleted."); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const sorted = useMemo(() => readings || [], [readings]);
  const who = activeProfile?.isSelf === false ? activeProfile.fullName : null;

  return <PageLayout title="Vitals" header={<ProfileHeader showPicture={false} />}>
    <PageTitle lead={`Log measurements and see how they change over time${who ? ` for ${who}` : ""}.`}>{who ? `Vitals for ${who}` : "Vitals"}</PageTitle>
    {profilesError && <Alert tone="danger" as="p">{profilesError}</Alert>}
    {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
    {message && <Alert tone="success" as="p" role="status">{message}</Alert>}

    {profileId && <section className="section vitals-log" aria-labelledby="log-vitals-heading">
      <h2 id="log-vitals-heading">Log a reading</h2>
      <p className="text-muted">Enter one or more measurements. These readings do not replace medical advice.</p>
      <form onSubmit={submit} className="form vitals-form">
        <div className="vitals-form__grid">
          <Input id="vital-systolic" label="Systolic (mmHg)" type="number" min="50" max="300" value={form.systolic} onChange={e => setForm({ ...form, systolic: e.target.value })} />
          <Input id="vital-diastolic" label="Diastolic (mmHg)" type="number" min="30" max="200" value={form.diastolic} onChange={e => setForm({ ...form, diastolic: e.target.value })} />
          <Input id="vital-heart-rate" label="Heart rate (bpm)" type="number" min="20" max="250" value={form.heartRate} onChange={e => setForm({ ...form, heartRate: e.target.value })} />
          <Input id="vital-temperature" label="Temperature (°C)" type="number" min="30" max="45" step="0.1" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} />
          <Input id="vital-recorded-at" label="Date and time" type="datetime-local" required value={form.recordedAt} onChange={e => setForm({ ...form, recordedAt: e.target.value })} />
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save reading"}</Button>
      </form>
    </section>}

    <section className="section" aria-labelledby="vitals-history-heading">
      <div className="vitals-history__heading"><div><h2 id="vitals-history-heading">History and trends</h2><p className="text-muted">Up to 1,000 readings are shown.</p></div>
        <label className="field__label" htmlFor="vitals-range">Time range<select id="vitals-range" className="input" value={range} onChange={e => setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></select></label>
      </div>
      {readings === null && profileId && !error ? <HeartbeatLoader label="Loading vital readings..." /> : sorted.length === 0 ? <p className="vitals-empty">No vital readings in this range yet.</p> : <>
        <div className="vitals-charts">
          <TrendChart title="Blood pressure" readings={sorted.filter(r => r.systolic !== null)} lines={[{ key: "systolic", label: "Systolic" }, { key: "diastolic", label: "Diastolic" }]} unit="mmHg" />
          <TrendChart title="Heart rate" readings={sorted.filter(r => r.heartRate !== null)} lines={[{ key: "heartRate", label: "Heart rate" }]} unit="bpm" />
          <TrendChart title="Temperature" readings={sorted.filter(r => r.temperature !== null)} lines={[{ key: "temperature", label: "Temperature" }]} unit="°C" />
        </div>
        <div className="vitals-table-wrap"><table className="vitals-table"><caption>Vital readings, newest first</caption><thead><tr><th>Date</th><th>Blood pressure</th><th>Heart rate</th><th>Temperature</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{sorted.map(reading => <tr key={reading.id}><td>{dateText(reading.recordedAt)}</td><td>{reading.systolic === null ? "—" : `${reading.systolic}/${reading.diastolic} mmHg`}</td><td>{reading.heartRate === null ? "—" : `${reading.heartRate} bpm`}</td><td>{reading.temperature === null ? "—" : `${reading.temperature}°C`}</td><td><Button variant="secondary" size="small" disabled={busy} onClick={() => remove(reading)} aria-label={`Delete reading from ${dateText(reading.recordedAt)}`}>Delete</Button></td></tr>)}</tbody></table></div>
      </>}
    </section>
    <p className="section"><a href="/dashboard">Back to dashboard</a></p>
  </PageLayout>;
}

VitalsPage.requireSignIn = true;

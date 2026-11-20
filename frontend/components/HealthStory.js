import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import { LinesSkeleton } from "./ui/Skeleton";
import { getHealthStory } from "../lib/historyApi";
import { formatDate } from "../lib/dates";

// SCRUM-332: "My health story". The active profile's symptom checks, appointments, medication changes, documents and
// vitals, month by month, newest first (backend: healthStory.js, GET /api/history/timeline). Six months at a time,
// with "Show earlier months". The filters only hide and show what is already loaded; each event links to its page.
export const STORY_TYPES = ["symptom-check", "appointment", "medication", "document", "vitals"];
const TYPE_LABELS = { "symptom-check": "Symptom check", appointment: "Appointment", medication: "Medication", document: "Document", vitals: "Vitals" };
export const FILTER_LABELS = { "symptom-check": "Symptom checks", appointment: "Appointments", medication: "Medication changes", document: "Documents", vitals: "Vitals" };
const COUNT_WORDS = {
  "symptom-check": ["symptom check", "symptom checks"], appointment: ["appointment", "appointments"],
  medication: ["medication change", "medication changes"], document: ["document", "documents"], vitals: ["day of vitals", "days of vitals"],
};
const OPEN_LABELS = { "symptom-check": "Open symptom checks", appointment: "Open in Appointments", medication: "Open in Medications", document: "Open in Medical documents", vitals: "Open in My vitals" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (key) => `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;

function countsText(counts, shown) {
  return STORY_TYPES.filter((type) => shown.has(type) && counts[type])
    .map((type) => `${counts[type]} ${COUNT_WORDS[type][counts[type] === 1 ? 0 : 1]}`).join(", ");
}

export default function HealthStory({ profileId, forSelf = true, name }) {
  const [story, setStory] = useState(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [shown, setShown] = useState(() => new Set(STORY_TYPES));
  const controller = useRef(null);

  function load(until) {
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    return getHealthStory(profileId, { until }, signal);
  }

  // A different profile: start again, so one person's story is never shown under another's name.
  useEffect(() => {
    if (!profileId) return undefined;
    setStory(null); setError(""); setLoadingMore(false); setShown(new Set(STORY_TYPES));
    load().then(setStory).catch((failure) => {
      if (failure.name !== "AbortError") setError(failure.message || "We couldn't load the health story. Please try again.");
    });
    return () => controller.current?.abort();
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function showEarlier() {
    setLoadingMore(true); setError("");
    try {
      const earlier = await load(story.earlierUntil);
      setStory((current) => ({
        ...earlier,
        from: earlier.from, until: current.until,
        months: [...current.months, ...earlier.months],
        counts: Object.fromEntries(STORY_TYPES.map((type) => [type, (current.counts[type] || 0) + (earlier.counts[type] || 0)])),
        truncated: current.truncated || earlier.truncated,
      }));
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message || "We couldn't load earlier months. Please try again.");
    } finally { setLoadingMore(false); }
  }

  function toggle(type) {
    setShown((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  const months = (story?.months || [])
    .map((month) => ({ ...month, events: month.events.filter((event) => shown.has(event.type)) }))
    .filter((month) => month.events.length);
  const total = story ? STORY_TYPES.reduce((sum, type) => sum + (story.counts[type] || 0), 0) : 0;
  const whose = forSelf ? "your" : `${name}'s`;

  return (
    <Card className="section health-story" aria-labelledby="health-story-heading">
      <h2 id="health-story-heading">{forSelf ? "My health story" : `${name}'s health story`}</h2>
      <p className="text-muted">Everything saved in Nabad, month by month: symptom checks, appointments, medicines started or stopped, documents and vitals.</p>
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {!story && !error && <LinesSkeleton label="Loading the health story..." lines={4} />}
      {story && (
        <>
          <fieldset className="health-story__filters">
            <legend>Show</legend>
            {STORY_TYPES.map((type) => (
              <label key={type} className="check health-story__filter">
                <input type="checkbox" checked={shown.has(type)} onChange={() => toggle(type)} />
                <span>{FILTER_LABELS[type]} ({story.counts[type] || 0})</span>
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-muted" aria-live="polite">
            Showing {story.from === story.until ? monthName(story.until) : `${monthName(story.from)} to ${monthName(story.until)}`}
          </p>

          {total === 0 ? (
            <EmptyState title={story.hasEarlier
              ? "Nothing in these months. Older records are below."
              : `Nothing saved yet: ${whose} symptom checks, appointments, medicines, documents and vitals will appear here.`} />
          ) : months.length === 0 ? (
            <p className="text-muted">Nothing to show with these filters. Tick a kind of record above.</p>
          ) : months.map((month) => (
            <section key={month.month} className="health-story__month" aria-labelledby={`health-story-${month.month}`}>
              <h3 id={`health-story-${month.month}`}>{month.label}</h3>
              <p className="text-sm text-muted">{countsText(month.counts, shown)}</p>
              <ol className="history-records health-story__events" aria-label={`${month.label} records`}>
                {month.events.map((event) => (
                  <li key={`${event.type}-${event.id}`} className={`history-record health-story__event health-story__event--${event.type}`}>
                    <div className="history-record__heading">
                      <Badge tone="neutral">{TYPE_LABELS[event.type]}</Badge>
                      <span className="history-record__date">{formatDate(event.day)}{event.time ? `, ${event.time}` : ""}</span>
                      {event.badge && <Badge tone={event.attention ? "warning" : event.badge === "Upcoming" || event.badge === "Planned" ? "info" : "neutral"}>{event.badge}</Badge>}
                    </div>
                    <p className="history-record__title">{event.title}</p>
                    {event.detail && <p>{event.type === "symptom-check" ? `${forSelf ? "You" : name} described: “${event.detail}”` : event.detail}</p>}
                    <a href={event.href}>{OPEN_LABELS[event.type]}</a>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {story.truncated && <p className="text-sm text-muted">Some months have a lot of records: only the newest 500 of each kind are shown for them.</p>}
          {story.hasEarlier && (
            <div className="form-actions">
              <Button variant="secondary" onClick={showEarlier} disabled={loadingMore}>{loadingMore ? "Loading..." : "Show earlier months"}</Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

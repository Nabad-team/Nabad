import { useEffect, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { getUsageSummary } from "../lib/usageApi";

// SCRUM-311: "As a developer, I want usage analytics (e.g. number of triage sessions run) so that the team
// can track adoption." Anonymous daily totals for the Nabad team: symptom checks, initial checks,
// follow-up rounds and new accounts. No names, emails, symptoms or results: the API never sends any.
// Only team members listed in TEAM_DASHBOARD_EMAILS (backend) can load it; everyone else sees "not available".

export const RANGES = [7, 30, 90];
const METRICS = [
  { key: "sessionsStarted", label: "Symptom checks started", help: "New checks, not counting follow-up rounds." },
  { key: "assessments", label: "Assessments completed", help: "Every completed result, including follow-up rounds." },
  { key: "followupAssessments", label: "Follow-up rounds", help: "Results after answering follow-up questions." },
  { key: "newAccounts", label: "New accounts", help: "Accounts created on that day." },
];
const number = new Intl.NumberFormat("en-GB");
// "2026-11-10" -> "10 Nov", in UTC like the counts.
export const dayLabel = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

// One column per day. The drawing is hidden from screen readers: the caption and the table say the same.
function DailyChart({ id, title, daily, metric }) {
  const max = Math.max(1, ...daily.map((row) => row[metric]));
  const total = daily.reduce((sum, row) => sum + row[metric], 0);
  const busiest = daily.reduce((best, row) => (row[metric] > (best?.[metric] ?? -1) ? row : best), null);
  return (
    <figure className="usage-chart" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="usage-chart__title">{title} per day</h2>
      <figcaption className="usage-chart__summary">
        {total === 0 ? "None in this period." : `${number.format(total)} in ${daily.length} days. Busiest day: ${dayLabel(busiest.day)} (${number.format(busiest[metric])}).`}
      </figcaption>
      <div className="usage-chart__plot" aria-hidden="true">
        <span className="usage-chart__max">{number.format(max)}</span>
        <div className="usage-chart__area" style={{ gridTemplateColumns: `repeat(${daily.length}, 1fr)` }}>
          {daily.map((row) => (
            <div key={row.day} className="usage-chart__column" title={`${dayLabel(row.day)}: ${number.format(row[metric])}`}>
              {row[metric] > 0 && <div className="usage-chart__bar" style={{ height: `${(row[metric] / max) * 100}%` }} />}
            </div>
          ))}
        </div>
        <div className="usage-chart__axis">
          <span>{dayLabel(daily[0].day)}</span>
          <span>{dayLabel(daily[daily.length - 1].day)}</span>
        </div>
      </div>
    </figure>
  );
}

export default function TeamDashboardPage() {
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState({ loading: true });
    getUsageSummary(days, controller.signal)
      .then((summary) => { if (current) setState({ summary }); })
      .catch((error) => {
        if (!current || error.name === "AbortError") return;
        setState({ error: error.status === 404 ? "notTeam" : error.message || "We couldn't load the usage numbers. Please try again." });
      });
    return () => { current = false; controller.abort(); };
  }, [days]);

  const { summary, error, loading } = state;
  return (
    <PageLayout title="Team dashboard" header={<ProfileHeader showPicture={false} />}>
      <PageTitle lead="How many people use Nabad, day by day. Anonymous totals only: no names, emails, symptoms or results.">Team dashboard</PageTitle>

      {error === "notTeam" ? (
        <Alert tone="info" role="status" title="This page is for the Nabad team">
          It is only available to team members. If you are on the team, ask the person who manages the server to add your verified email.
        </Alert>
      ) : (
        <>
          <fieldset className="usage-range">
            <legend>Period</legend>
            {RANGES.map((range) => (
              <label key={range} className="usage-range__option">
                <input type="radio" name="usage-range" value={range} checked={days === range} onChange={() => setDays(range)} />
                Last {range} days
              </label>
            ))}
          </fieldset>

          {error && <Alert tone="danger" role="alert">{error}</Alert>}
          {loading && <HeartbeatLoader label="Loading usage numbers..." />}

          {summary && (
            <>
              <p className="usage-period">
                {dayLabel(summary.from)} to {dayLabel(summary.to)} (days in UTC). Updated {new Date(summary.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })} (Beirut time).
              </p>
              <ul className="usage-totals" aria-label="Totals for the period">
                {METRICS.map((metric) => (
                  <li key={metric.key}>
                    <Card as="div" className="usage-total">
                      <span className="usage-total__value">{number.format(summary.totals[metric.key])}</span>
                      <span className="usage-total__label">{metric.label}</span>
                      <span className="usage-total__help">{metric.help}</span>
                    </Card>
                  </li>
                ))}
              </ul>

              <div className="usage-charts">
                <DailyChart id="sessions" title="Symptom checks started" daily={summary.daily} metric="sessionsStarted" />
                <DailyChart id="accounts" title="New accounts" daily={summary.daily} metric="newAccounts" />
              </div>

              <details className="usage-table">
                <summary>Show the numbers for each day</summary>
                <table>
                  <caption className="visually-hidden">Usage per day, oldest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      {METRICS.map((metric) => <th key={metric.key} scope="col">{metric.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.daily.map((row) => (
                      <tr key={row.day}>
                        <th scope="row">{dayLabel(row.day)}</th>
                        {METRICS.map((metric) => <td key={metric.key}>{number.format(row[metric.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>

              <p className="usage-note">
                These are counts of requests, not of unique people. Checks are counted after a result is shown, including when the AI is unavailable and the rules answer alone. Counts are kept for 90 days.
              </p>
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}
TeamDashboardPage.requireSignIn = true;

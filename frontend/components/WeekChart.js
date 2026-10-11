import { formatDate } from "../lib/dates";
import { shortDay, longDay } from "../lib/wellbeing";

// A small column chart of one value per day (one series, so no legend: the title says what it shows).
// Columns are thin, rounded at the top and square at the baseline; days with nothing logged have no column.
// The text summary is the caption, the value shows on hover, and "Show the numbers" opens a table,
// so the chart is never the only way to read the data.
//   days:      [{ date: "YYYY-MM-DD", value: number or null }], oldest first
//   max:       the value at the top of the chart
//   format:    value -> text, e.g. 3 -> "3 glasses"
//   reference: optional { value, label } drawn as a thin line (the water goal)
export default function WeekChart({ id, title, summary, days, max, format, reference, today }) {
  const percent = (value) => `${Math.min(100, (value / max) * 100)}%`;
  return (
    <figure className="week-chart" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="week-chart__title">{title}</h3>
      <figcaption className="week-chart__summary">{summary}</figcaption>

      {/* The drawing repeats the caption and the table below, so screen readers skip it. */}
      <div className="week-chart__plot" aria-hidden="true">
        <span className="week-chart__max">{format(max)}</span>
        <div className="week-chart__area">
          {reference && (
            <div className="week-chart__reference" style={{ bottom: percent(reference.value) }}>
              <span>{reference.label}</span>
            </div>
          )}
          {days.map((day) => (
            <div key={day.date} className="week-chart__column" title={day.value === null ? `${longDay(day.date)}: nothing logged` : `${longDay(day.date)}: ${format(day.value)}`}>
              {day.value !== null && (
                <div className={`week-chart__bar${day.value === 0 ? " week-chart__bar--zero" : ""}`} style={{ height: percent(day.value) }} />
              )}
            </div>
          ))}
        </div>
        <div className="week-chart__days">
          {days.map((day) => (
            <span key={day.date} className={day.date === today ? "week-chart__day week-chart__day--today" : "week-chart__day"}>
              {day.date === today ? "Today" : shortDay(day.date)}
            </span>
          ))}
        </div>
      </div>

      <details className="week-chart__table">
        <summary>Show the numbers</summary>
        <table>
          <caption className="visually-hidden">{title}, day by day</caption>
          <thead>
            <tr><th scope="col">Day</th><th scope="col">{title}</th></tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{longDay(day.date)}, {formatDate(day.date)}</th>
                <td>{day.value === null ? "Not logged" : format(day.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

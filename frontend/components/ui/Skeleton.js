import Card from "./Card";

// Loading placeholders: grey shapes in the page's final layout, so nothing jumps when the data arrives.
//   - The region has aria-busy="true" and one visually hidden role="status" line ("Loading medications..."),
//     so a screen reader hears "Loading" once, not once per shape. The shapes are aria-hidden.
//   - The shapes shimmer gently; with reduced motion turned on they stay still (styles/components.css).
//   - Each page skeleton reuses the real list and card classes (.medication, .appointment, .provider-card...),
//     so its padding, borders and grid match what replaces it.
// The heartbeat (HeartbeatLoader) stays for actions in progress (uploading, saving), not for first loads.

export function SkeletonRegion({ label = "Loading...", className = "", children }) {
  return (
    <div className={`skeleton${className ? ` ${className}` : ""}`} aria-busy="true">
      <span className="visually-hidden" role="status">{label}</span>
      <div className="skeleton__shapes" aria-hidden="true">{children}</div>
    </div>
  );
}

// One grey shape. width: any CSS length ("60%", "8rem"); size: "text" (a line of body text), "title", "button" or "pill".
export function Bone({ width = "100%", size = "text", round = false, className = "" }) {
  return <span className={`skeleton__bone skeleton__bone--${size}${round ? " skeleton__bone--round" : ""}${className ? ` ${className}` : ""}`} style={{ width }} />;
}

const repeat = (count, render) => Array.from({ length: count }, (_, index) => render(index));
// Varied widths read as text rather than as a grid of identical bars.
const WIDTHS = ["62%", "48%", "70%", "55%", "66%"];

// My medications: the page card with the search field and medication rows.
export function MedicationsSkeleton({ label }) {
  return (
    <SkeletonRegion label={label}>
      <Card as="div" className="page-card">
        <div className="skeleton__stack"><Bone width="9rem" /><Bone size="field" /></div>
        <ul className="medication-list">
          {repeat(3, (index) => (
            <li key={index} className="medication">
              <div className="skeleton__stack"><Bone size="title" width={WIDTHS[index]} /><Bone width="40%" /><Bone width="30%" /></div>
              <div className="skeleton__row"><Bone size="button" width="5.5rem" /><Bone size="button" width="5rem" /></div>
            </li>
          ))}
        </ul>
      </Card>
    </SkeletonRegion>
  );
}

// My appointments: the calendar card, then the list card.
export function AppointmentsSkeleton({ label }) {
  return (
    <SkeletonRegion label={label}>
      <Card as="div" className="page-card">
        <div className="skeleton__row skeleton__row--between"><Bone size="button" width="2.75rem" /><Bone size="title" width="10rem" /><Bone size="button" width="2.75rem" /></div>
        <div className="skeleton__calendar">{repeat(35, (index) => <Bone key={index} size="cell" />)}</div>
      </Card>
      <Card as="div" className="page-card">
        <ul className="appointment-list">
          {repeat(2, (index) => (
            <li key={index} className="appointment">
              <div className="skeleton__stack"><Bone size="title" width={WIDTHS[index]} /><Bone width="35%" /><Bone width="45%" /><Bone width="25%" /></div>
              <div className="skeleton__row"><Bone size="button" width="5rem" /><Bone size="button" width="5rem" /></div>
            </li>
          ))}
        </ul>
      </Card>
    </SkeletonRegion>
  );
}

// My documents: the filters, then document rows (inside the page's own card).
export function DocumentsSkeleton({ label }) {
  return (
    <SkeletonRegion label={label}>
      <div className="medical-documents__filters skeleton__filters">{repeat(4, (index) => <div key={index} className="skeleton__stack"><Bone width="7rem" /><Bone size="field" /></div>)}</div>
      <ul className="medical-documents__list">
        {repeat(3, (index) => (
          <li key={index}>
            <div className="skeleton__stack"><Bone width={WIDTHS[index]} /><Bone width="40%" /></div>
            <Bone width="9rem" />
            <Bone size="button" width="6rem" />
            <Bone size="button" width="5rem" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

// My vitals: the three trend charts, then table rows (inside the History and trends card).
export function VitalsSkeleton({ label }) {
  return (
    <SkeletonRegion label={label}>
      <div className="vitals-charts">{repeat(3, (index) => <div key={index} className="skeleton__stack"><Bone width="8rem" /><Bone size="chart" /></div>)}</div>
      <div className="skeleton__table">{repeat(5, (index) => <div key={index} className="skeleton__table-row"><Bone width="70%" /><Bone width="60%" /><Bone width="45%" /><Bone width="45%" /><Bone size="button" width="4.5rem" /></div>)}</div>
    </SkeletonRegion>
  );
}

// My health: the two-column card grid, each card a heading and a few rows.
export function HealthSkeleton({ label }) {
  return (
    <SkeletonRegion label={label}>
      <div className="card-grid">
        <Card as="div" className="card--full"><div className="skeleton__stack"><Bone size="title" width="40%" /><Bone width="60%" /></div></Card>
        {repeat(4, (index) => (
          <Card key={index} as="div">
            <div className="skeleton__stack">
              <Bone size="title" width={["30%", "45%", "35%", "40%"][index]} />
              {repeat(3, (row) => <div key={row} className="skeleton__row skeleton__row--between"><Bone width={WIDTHS[(index + row) % WIDTHS.length]} /><Bone size="button" width="4.5rem" /></div>)}
            </div>
          </Card>
        ))}
      </div>
    </SkeletonRegion>
  );
}

// Find care: the result count, the tool buttons and provider cards.
export function ProvidersSkeleton({ label }) {
  return (
    <SkeletonRegion label={label}>
      <div className="skeleton__stack"><Bone width="10rem" /><Bone width="70%" /></div>
      <div className="provider-tools"><Bone size="button" width="12rem" /><Bone size="button" width="8rem" /></div>
      <ul className="provider-list">
        {repeat(4, (index) => (
          <li key={index} className="provider-card">
            <Bone size="title" width={WIDTHS[index]} />
            <Bone width="35%" />
            <div className="skeleton__row">{repeat(4, (button) => <Bone key={button} size="button" width={["4rem", "6rem", "7rem", "6rem"][button]} />)}</div>
            <Bone width="7rem" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

// Dashboard: Next step, then Your progress with its four rings and the appointment row. While the profile is
// loading the whole dashboard shows this; afterwards Your progress shows it until its data has arrived.
export function NextStepSkeleton() {
  return (
    <Card as="div" className="next-step">
      <div className="next-step__copy skeleton__stack"><Bone width="5rem" /><Bone size="title" width="60%" /></div>
      <Bone size="button" width="9rem" />
    </Card>
  );
}

export function ProgressSkeleton() {
  return (
    <Card as="div" className="section progress-summary">
      <Bone size="title" width="10rem" />
      <ul className="progress-summary__list">
        {repeat(4, (index) => (
          <li key={index} className="progress-summary__item">
            <div className="progress-summary__visual"><Bone size="ring" round /></div>
            <div className="progress-summary__copy skeleton__stack"><Bone size="title" width="50%" /><Bone width="35%" /><Bone width="80%" /><Bone size="button" width="8rem" /></div>
          </li>
        ))}
      </ul>
      <div className="progress-summary__appointments"><div className="skeleton__stack"><Bone width="14rem" /><Bone width="60%" /></div><Bone size="button" width="9rem" /></div>
    </Card>
  );
}

export function DashboardSkeleton({ label, nextStep = true }) {
  return (
    <SkeletonRegion label={label}>
      {nextStep && <NextStepSkeleton />}
      <ProgressSkeleton />
    </SkeletonRegion>
  );
}

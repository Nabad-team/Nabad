// The heartbeat line from the Nabad logo, our one signature element. Use it in two places only:
// under page titles (HeartbeatDivider, via PageTitle) and as the loading indicator (HeartbeatLoader).

// The logo's pulse (flat, small bump, sharp spike up and down, flat) drawn on a 144x16 grid.
const DIVIDER_POINTS = "1,8 16,8 19,5.5 22,8 25,1.5 29,14.5 32,8 143,8";

export function HeartbeatDivider() {
  return (
    <svg className="heartbeat-divider" viewBox="0 0 144 16" aria-hidden="true" focusable="false">
      <polyline points={DIVIDER_POINTS} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LOADER_POINTS = "1,12 18,12 22,9 26,12 30,3 36,21 40,12 71,12";

// A pulse travels along the line. With reduced motion turned on, the line stays still.
// The label is visible text in a role="status" element, so screen readers announce it.
export function HeartbeatLoader({ label = "Loading..." }) {
  return (
    <div className="loader" role="status">
      <svg className="loader__line" viewBox="0 0 72 24" aria-hidden="true" focusable="false">
        <polyline className="loader__track" points={LOADER_POINTS} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline className="loader__pulse" points={LOADER_POINTS} pathLength="100" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

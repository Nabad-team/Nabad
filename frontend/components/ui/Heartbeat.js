// The heartbeat line from the Nabad logo, our one signature element, under page titles (HeartbeatDivider, via
// PageTitle). Pages that load show grey placeholders (ui/Skeleton.js); the only animated loader is the Symptom
// check's while it is checking (AssistantLoader in components/NabadAssistant.js).

// The logo's pulse (flat, small bump, sharp spike up and down, flat) drawn on a 144x16 grid.
const DIVIDER_POINTS = "1,8 16,8 19,5.5 22,8 25,1.5 29,14.5 32,8 143,8";

export function HeartbeatDivider() {
  return (
    <svg className="heartbeat-divider" viewBox="0 0 144 16" aria-hidden="true" focusable="false">
      <polyline points={DIVIDER_POINTS} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

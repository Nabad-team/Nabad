import Alert from "./ui/Alert";

// Per-account daily AI limits (backend dailyAiLimits.js). A day ends at midnight in Beirut.
// usage / limit: { feature, used, limit, remaining, resetsAt } from the server.

// "in about 3 hours", "in less than an hour".
function untilReset(resetsAt, now = new Date()) {
  const hours = Math.round((new Date(resetsAt) - now) / 3600000);
  if (!Number.isFinite(hours)) return "";
  if (hours < 1) return "in less than an hour";
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`;
}

// A small line: "15 of 40 messages used today". showFrom: show it only once this many are used.
export function AiUsageLine({ usage, noun, showFrom = 0, className = "" }) {
  if (!usage || !Number.isFinite(usage.used) || !Number.isFinite(usage.limit) || usage.used < showFrom) return null;
  return (
    <p className={["ai-usage-line", className].filter(Boolean).join(" ")} data-testid="ai-usage-line">
      {usage.used} of {usage.limit} {noun} used today
    </p>
  );
}

// The friendly notice when today's limit is reached, instead of an error.
export function DailyLimitNotice({ limit, message, children }) {
  if (!limit) return null;
  // The server's message says it starts again at midnight, Beirut time; this says how long that is from now.
  const until = untilReset(limit.resetsAt);
  return (
    <Alert tone="info" role="status" title="You've reached today's limit" className="daily-limit-notice">
      <p>{message}</p>
      {until && <p>That&apos;s {until}.</p>}
      {children}
    </Alert>
  );
}

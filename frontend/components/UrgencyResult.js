// SCRUM-128: shows the urgency classification returned by POST /api/triage/classify.
// Answers the two questions in the story: "do I need care?" (label + action)
// and "how soon?" (timeframe). Colour is never the only signal: the label is always written out.
const STYLES = {
  emergency: { border: "#b91c1c", background: "#fef2f2", color: "#7f1d1d" },
  urgent: { border: "#c2410c", background: "#fff7ed", color: "#7c2d12" },
  soon: { border: "#a16207", background: "#fefce8", color: "#713f12" },
  routine: { border: "#0f766e", background: "#f0fdfa", color: "#134e4a" },
};

export default function UrgencyResult({ result }) {
  if (!result) return null;
  const style = STYLES[result.level] || STYLES.routine;
  const isEmergency = result.level === "emergency";

  return (
    <section
      aria-labelledby="urgency-heading"
      // An emergency is announced immediately by screen readers; the others politely.
      role={isEmergency ? "alert" : "status"}
      style={{
        marginTop: "1.5rem",
        padding: "1rem 1.25rem",
        border: `2px solid ${style.border}`,
        borderRadius: "10px",
        background: style.background,
        color: style.color,
      }}
    >
      <h2 id="urgency-heading" style={{ marginTop: 0 }}>
        Urgency: {result.label}
      </h2>
      <p>
        <strong>How soon:</strong> {result.timeframe}
      </p>
      <p>
        <strong>What to do:</strong> {result.action}
      </p>

      {isEmergency && (
        <a
          href="tel:140"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.25rem",
            background: style.border,
            color: "white",
            borderRadius: "8px",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          Call 140 now
        </a>
      )}

      {result.reasons?.length > 0 && (
        <>
          <p style={{ marginBottom: "0.25rem" }}>
            <strong>Why:</strong>
          </p>
          <ul style={{ marginTop: 0 }}>
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      )}

      <p style={{ fontSize: "0.9rem", marginBottom: 0 }}>{result.disclaimer}</p>
    </section>
  );
}

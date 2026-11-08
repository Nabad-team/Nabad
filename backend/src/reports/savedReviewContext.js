// Reuse the saved AI explanation, not a copy of the uploaded file. Every value
// remains untrusted context; no source document is reconstructed or persisted.
const text = (value, limit) => typeof value === "string"
  ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").slice(0, limit).trim() : "";

function savedReviewContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const summary = text(value.summary, 700);
  const findings = (Array.isArray(value.findings) ? value.findings : []).slice(0, 8)
    .filter(item => item && typeof item === "object" && !Array.isArray(item))
    .map(item => ({ name: text(item.name, 100), sourceQuote: text(item.sourceQuote, 240),
      result: text(item.result, 160), reference: text(item.reference, 160),
      explanation: text(item.explanation, 450), followUp: text(item.followUp, 300) }));
  if (!summary && !findings.length) return null;
  return { source: "saved_ai_review", originalDocumentAvailable: false, summary, findings,
    nextStep: text(value.nextStep, 700),
    uncertainties: (Array.isArray(value.uncertainties) ? value.uncertainties : []).slice(0, 8).map(item => text(item, 240)),
    reportCoverage: text(value.reportCoverage, 40),
  };
}

function savedReviewValues(review) {
  return review ? review.findings.map(item => [item.sourceQuote, item.result, item.reference].join("\n")).join("\n") : "";
}

module.exports = { savedReviewContext, savedReviewValues };

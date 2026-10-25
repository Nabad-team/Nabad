// Only expose a fixed category and message. Provider error bodies may contain
// uploaded health data, credentials or internal configuration and are never used.
function providerFailureDetails(error, mode = "report") {
  if (!["provider_unavailable", "timeout"].includes(error?.code)) return null;
  const failure = error.providerFailure || {};
  const ending = mode === "report" ? " No analysis was completed." : " No AI answer was generated.";
  if (error.code === "timeout") return { serviceIssue: "timeout", message: `The AI service took too long to respond. Please try again.${ending}` };
  if (failure.code === "network") return { serviceIssue: "connection", message: `The AI service could not be reached. Please try again later.${ending}` };
  if ([401, 403].includes(failure.status)) return { serviceIssue: "access", message: `The AI service connection needs attention. Please contact the website administrator with this reference.${ending}` };
  if (failure.status === 429) return { serviceIssue: "usage_limit", message: `The AI provider has reached a usage limit. Please try again later; if this continues, contact the website administrator.${ending}` };
  if ([400, 413, 415, 422].includes(failure.status)) return { serviceIssue: "request_rejected", message: `The AI provider could not accept this request. Try a searchable PDF or TXT report, or a question without an image. If this continues, contact the website administrator.${ending}` };
  if (failure.status === 404) return { serviceIssue: "model_unavailable", message: `The configured AI service could not be found. Please contact the website administrator with this reference.${ending}` };
  return { serviceIssue: "unavailable", message: `The AI provider is temporarily unavailable. Please try again later.${ending}` };
}

module.exports = { providerFailureDetails };

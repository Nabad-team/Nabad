const manifest = require("./report-review-manifest.json");
const reportCases = require("./report-analysis-cases.json");

const REVIEW_STATUSES = new Set(["pending", "approved", "rejected"]);

function validateReviewManifest(value = manifest, cases = reportCases) {
  const errors = [];
  if (value.schemaVersion !== 1) errors.push("Unsupported review manifest schema version.");
  if (!Array.isArray(value.requiredDimensions) || !value.requiredDimensions.length) errors.push("Review dimensions are missing.");
  const caseIds = new Set(cases.map((entry) => entry.id));
  const reviews = new Map();
  for (const entry of value.cases || []) {
    if (!caseIds.has(entry.id)) errors.push(`${entry.id}: review does not match a report case.`);
    if (reviews.has(entry.id)) errors.push(`${entry.id}: duplicate review entry.`);
    reviews.set(entry.id, entry.review);
    const review = entry.review || {};
    if (!REVIEW_STATUSES.has(review.status)) errors.push(`${entry.id}: invalid review status.`);
    if (review.status === "approved" || review.status === "rejected") {
      if (!review.reviewer || !review.reviewerQualification || !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt || "")) errors.push(`${entry.id}: completed review requires reviewer, qualification, and ISO date.`);
      if (!review.scores || value.requiredDimensions.some((dimension) => !Number.isInteger(review.scores[dimension]) || review.scores[dimension] < 0 || review.scores[dimension] > 2)) errors.push(`${entry.id}: completed review requires a 0-2 score for every dimension.`);
      if (typeof review.criticalSafetyFailure !== "boolean") errors.push(`${entry.id}: completed review must state whether a critical safety failure occurred.`);
      if (review.status === "approved" && review.criticalSafetyFailure) errors.push(`${entry.id}: a case with a critical safety failure cannot be approved.`);
      if (review.status === "rejected" && !String(review.notes || "").trim()) errors.push(`${entry.id}: a rejected case requires review notes.`);
    } else if (review.reviewer || review.reviewerQualification || review.reviewedAt || review.scores || review.criticalSafetyFailure !== null) {
      errors.push(`${entry.id}: pending review must not look completed.`);
    }
  }
  for (const id of caseIds) if (!reviews.has(id)) errors.push(`${id}: missing clinical review entry.`);
  const approved = [...reviews.values()].filter((review) => review?.status === "approved").length;
  const rejected = [...reviews.values()].filter((review) => review?.status === "rejected").length;
  const pending = [...reviews.values()].filter((review) => review?.status === "pending").length;
  if (value.clinicalValidationStatus === "approved" && (pending || rejected || approved !== caseIds.size)) errors.push("The dataset cannot be marked approved until every case is approved.");
  return { valid: errors.length === 0, errors, summary: { total: caseIds.size, approved, rejected, pending, clinicallyValidated: value.clinicalValidationStatus === "approved" && approved === caseIds.size } };
}

if (require.main === module) {
  const result = validateReviewManifest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

module.exports = { validateReviewManifest };

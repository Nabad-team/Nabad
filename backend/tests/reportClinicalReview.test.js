const { test } = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../evals/report-review-manifest.json");
const cases = require("../evals/report-analysis-cases.json");
const { validateReviewManifest } = require("../evals/reportReview.cjs");

test("every report evaluation case has an explicit pending clinical review", () => {
  const result = validateReviewManifest(manifest, cases);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.deepEqual(result.summary, { total: cases.length, approved: 0, rejected: 0, pending: cases.length, clinicallyValidated: false });
});

test("a case cannot be approved without a complete qualified review", () => {
  const copy = JSON.parse(JSON.stringify(manifest));
  copy.cases[0].review.status = "approved";
  const result = validateReviewManifest(copy, cases);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /requires reviewer, qualification/i);
});

test("a critical safety failure can never be approved", () => {
  const copy = JSON.parse(JSON.stringify(manifest));
  copy.cases[0].review = {
    status: "approved", reviewer: "Clinical reviewer", reviewerQualification: "Licensed physician", reviewedAt: "2026-11-01",
    scores: Object.fromEntries(copy.requiredDimensions.map((dimension) => [dimension, 2])), criticalSafetyFailure: true, notes: "Safety issue found.",
  };
  const result = validateReviewManifest(copy, cases);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /cannot be approved/i);
});

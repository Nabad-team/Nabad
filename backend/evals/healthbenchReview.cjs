const fs = require("node:fs/promises");
const { scoreRubrics } = require("./healthbenchData.cjs");

function summarizeReview(report) {
  const results = report.results.filter((entry) => entry.suite === "healthbench");
  if (!results.length) throw new Error("This result file contains no HealthBench cases.");
  const scores = [];
  let failedDelivery = 0;
  let unreviewed = 0;
  for (const entry of results) {
    if (!entry.result?.answer) { failedDelivery += 1; continue; }
    const grades = entry.review?.rubricGrades;
    if (!entry.review?.reviewer || !Array.isArray(grades) || grades.some((item) => item.criteriaMet === null || item.criteriaMet === undefined)) { unreviewed += 1; continue; }
    if (grades.some((item, index) => item.index !== index)) throw new Error("Rubric grade order was changed; restore the original indices before scoring.");
    const score = scoreRubrics(entry.sourceRubrics, grades);
    if (score === null) throw new Error("No positive rubric points are available; this case cannot be scored.");
    scores.push(score);
  }
  return { evaluation: "Nabad English HealthBench subset", comparableToFullHealthBench: false, clinicallyValidated: false,
    attemptedCases: results.length, plannedCases: report.plannedCases,
    providerCalls: results.filter((entry) => entry.providerCalled).length,
    ruleResponses: results.filter((entry) => entry.result?.responseSource === "safety_rules").length,
    failedDelivery, unreviewed, reviewedCases: scores.length,
    reviewedSubsetMean: scores.length ? scores.reduce((sum, value) => sum + Math.max(0, Math.min(1, value)), 0) / scores.length : null,
    coverageComplete: results.length === report.plannedCases && !failedDelivery && !unreviewed,
  };
}

if (require.main === module) {
  (async () => {
    const file = process.argv[2];
    if (!file) throw new Error("Usage: node evals/healthbenchReview.cjs evals/results/<result-file>.json");
    console.log(JSON.stringify(summarizeReview(JSON.parse(await fs.readFile(file, "utf8"))), null, 2));
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { summarizeReview };

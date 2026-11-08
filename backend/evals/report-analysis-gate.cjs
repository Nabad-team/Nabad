// Deterministic, synthetic regression gate for report-analysis grounding.
// This validates application safeguards, not clinical accuracy or live-model quality.
const cases = require("./report-analysis-cases.json");
const extractionCases = require("./report-extraction-cases.json");
const { parseReportReply } = require("../src/reports/analyze");
const { assessPdfCoverage } = require("../src/reports/extract");

let failures = 0;
for (const entry of cases) {
  try {
    const result = parseReportReply(JSON.stringify(entry.expected), { reportText: entry.reportText });
    const passed = result.urgency === entry.expected.urgency
      && result.findings.length === entry.expected.findings.length
      && result.findings.every((finding, index) => finding.category === entry.expected.findings[index].category);
    if (!passed) throw new Error("validated output did not preserve expected urgency, finding count, or categories");
    console.log(`PASS ${entry.id} (${entry.category})`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${entry.id}: ${error.code || error.message}`);
  }
}

for (const entry of extractionCases) {
  try {
    const result = assessPdfCoverage(entry.pageTexts, entry.pageLabels);
    if (result.status !== entry.expectedStatus) throw new Error(`expected ${entry.expectedStatus}, received ${result.status}`);
    if (entry.expectedUnreadablePages && JSON.stringify(result.unreadablePages) !== JSON.stringify(entry.expectedUnreadablePages)) throw new Error("unexpected unreadable-page classification");
    if (entry.expectedSparsePages && JSON.stringify(result.sparsePages) !== JSON.stringify(entry.expectedSparsePages)) throw new Error("unexpected sparse-page classification");
    if (entry.expectedIssue && !result.issues.join(" ").includes(entry.expectedIssue)) throw new Error("expected coverage issue was not reported");
    console.log(`PASS ${entry.id} (extraction)`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${entry.id}: ${error.message}`);
  }
}

const total = cases.length + extractionCases.length;
console.log(`${total - failures}/${total} synthetic report cases passed`);
if (failures) process.exitCode = 1;

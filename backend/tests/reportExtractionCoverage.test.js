const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assessPdfCoverage } = require("../src/reports/extract");

test("page coverage identifies unreadable and sparse PDF pages", () => {
  const result = assessPdfCoverage([
    "Patient report with enough selectable text to describe several laboratory rows and their reference ranges.",
    "",
    "Result 4.2",
    "Another complete page containing enough selectable report text for reliable extraction and review.",
  ]);
  assert.equal(result.status, "uncertain");
  assert.deepEqual(result.unreadablePages, [2]);
  assert.deepEqual(result.sparsePages, [3]);
  assert.match(result.issues.join(" "), /page 2/i);
  assert.match(result.issues.join(" "), /page 3/i);
});

test("sequential readable PDF pages have complete coverage", () => {
  const page = "A complete synthetic report page containing patient-independent laboratory values, units, flags, and reference ranges.";
  const result = assessPdfCoverage([page, page], ["1", "2"]);
  assert.equal(result.status, "complete");
  assert.deepEqual(result.issues, []);
  assert.equal(result.readablePages, 2);
});

test("page-label gaps and extraction truncation are reported", () => {
  const page = "A complete synthetic report page containing enough selectable text to be treated as readable content.";
  const result = assessPdfCoverage([page, page], ["1", "3"], { truncated: true, expectedPageCount: 4 });
  assert.equal(result.pageCount, 4);
  assert.equal(result.processedPages, 2);
  assert.match(result.issues.join(" "), /not sequential/i);
  assert.match(result.issues.join(" "), /analysis limit/i);
});

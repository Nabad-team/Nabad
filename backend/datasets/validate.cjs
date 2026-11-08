const fs = require("node:fs");
const path = require("node:path");
const { isEnglishCompatibleText } = require("../src/reports/englishPolicy");
const { parseChatReply } = require("../src/reports/chat");

const root = __dirname;
const files = ["assistant-sft.jsonl", "assistant-safety-eval.jsonl"];
const records = [];
const errors = [];
const fail = (id, message) => errors.push(`${id}: ${message}`);

for (const filename of files) {
  const lines = fs.readFileSync(path.join(root, filename), "utf8").split(/\r?\n/).filter(Boolean);
  lines.forEach((line, index) => {
    try { records.push({ ...JSON.parse(line), filename, line: index + 1 }); }
    catch { errors.push(`${filename}:${index + 1}: invalid JSON`); }
  });
}

const ids = new Set();
for (const record of records) {
  const label = record.id || `${record.filename}:${record.line}`;
  if (!/^(?:sft|eval)-[a-z0-9-]+-\d{3}$/.test(record.id || "")) fail(label, "invalid ID");
  if (ids.has(record.id)) fail(label, "duplicate ID");
  ids.add(record.id);
  if (record.language !== "en" || record.source !== "synthetic") fail(label, "only synthetic English records are allowed");
  if ((record.kind === "sft" && record.split !== "train") || (record.kind === "eval" && record.split !== "test") || !["sft", "eval"].includes(record.kind)) fail(label, "kind and split do not match");
  if (!record.input || typeof record.input.question !== "string" || record.input.question.length < 3 || record.input.question.length > 1200) fail(label, "invalid question");
  if (!isEnglishCompatibleText(JSON.stringify(record))) fail(label, "contains a disallowed non-English script");
  if (!Array.isArray(record.tags) || !record.tags.length) fail(label, "missing tags");
  if (!record.clinicalReview || !["pending", "approved", "rejected"].includes(record.clinicalReview.status)) fail(label, "invalid clinical review status");
  if (record.clinicalReview.status === "approved" && (!record.clinicalReview.reviewer || !record.clinicalReview.reviewedAt)) fail(label, "approved records require reviewer and date");
  const serialized = JSON.stringify(record);
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(serialized) || /\b(?:\+?\d[\s().-]*){8,}\b/.test(serialized)) fail(label, "possible personal contact data");
  if (record.kind === "sft") {
    if (!record.target || !Array.isArray(record.target.evidence) || !Array.isArray(record.target.citations)) fail(label, "invalid supervised target");
    else {
      try { parseChatReply(JSON.stringify(record.target), { report: record.input.report }); }
      catch (error) { fail(label, `target fails production validation (${error.code || error.name})`); }
    }
  } else if (!record.expected || !Array.isArray(record.expected.mustInclude) || !Array.isArray(record.expected.mustAvoid)) fail(label, "invalid evaluation rubric");
}

const advanced = require("../evals/advanced-cases.json");
for (const item of advanced) if (ids.has(item.id)) fail(item.id, "overlaps the held-out advanced evaluation suite");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const training = records.filter((item) => item.kind === "sft");
  const evaluation = records.filter((item) => item.kind === "eval");
  const approved = training.filter((item) => item.clinicalReview.status === "approved");
  console.log(JSON.stringify({ valid: true, training: training.length, heldOutEvaluation: evaluation.length, clinicallyApprovedForTraining: approved.length }, null, 2));
}

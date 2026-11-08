const { test } = require("node:test");
const assert = require("node:assert/strict");
const { savedReviewContext } = require("../src/reports/savedReviewContext");
const { answerChat, buildChatMessages, parseChatReply } = require("../src/reports/chat");

const review = {
  summary: "The AI review describes a hemoglobin result.",
  findings: [{ name: "Hemoglobin", sourceQuote: "Hemoglobin 13.5 g/dL", result: "13.5 g/dL", reference: "12-16 g/dL", explanation: "Hemoglobin carries oxygen.", followUp: "Review with the ordering clinician." }],
  nextStep: "Review the full report with the ordering clinician.", uncertainties: ["The complete source is not available here."], reportCoverage: "partial_text",
};
const contextFrom = messages => JSON.parse(messages.at(-1).content.find(part => part.type === "text").text.split("\n").slice(1).join("\n"));

test("saved review context is labelled as AI-generated and excludes unrelated stored fields", () => {
  const context = savedReviewContext({ ...review, owner: "private-owner", profileId: "private-profile", secret: "private-secret" });
  assert.equal(context.source, "saved_ai_review");
  assert.equal(context.originalDocumentAvailable, false);
  assert.equal(context.reportCoverage, "partial_text");
  assert.deepEqual(context.findings, review.findings);
  assert.doesNotMatch(JSON.stringify(context), /private-owner|private-profile|private-secret/);
  assert.equal(savedReviewContext(null), null);
  assert.equal(savedReviewContext({}), null);
});

test("legacy or oversized saved fields are bounded before entering a model request", () => {
  const context = savedReviewContext({ summary: "s".repeat(5000), findings: Array.from({ length: 30 }, () => ({ ...review.findings[0], explanation: "x".repeat(5000) })), uncertainties: Array(20).fill("u".repeat(1000)) });
  assert.equal(context.summary.length, 700);
  assert.equal(context.findings.length, 8);
  assert.equal(context.findings[0].explanation.length, 450);
  assert.equal(context.uncertainties.length, 8);
  assert.equal(context.uncertainties[0].length, 240);
});

test("a reopened report remains available to follow-ups after the first chat turns leave the history window", async () => {
  const result = await answerChat({ question: "What measurement did the saved review list?", previousReportReview: review, retriever: null,
    history: [{ role: "user", content: "A recent unrelated turn." }],
    client: { complete: async messages => {
      const context = contextFrom(messages);
      assert.equal(context.attachedReportText, null);
      assert.equal(context.previousReportReview.findings[0].result, "13.5 g/dL");
      assert.match(messages[0].content, /not the original document/);
      return JSON.stringify({ answer: "The saved review lists hemoglobin 13.5 g/dL. Attach the original report again to verify the details.", evidence: [] });
    } },
  });
  assert.match(result.answer, /saved review lists/);
});

test("saved AI explanations cannot provide original-report evidence or introduce unsupported measurements", () => {
  for (const reply of [
    { answer: "The saved review lists hemoglobin 99 g/dL.", evidence: [] },
    { answer: "The saved review lists hemoglobin 13.5 g/dL.", evidence: ["Hemoglobin 13.5 g/dL"] },
    { answer: "The reference range is 42-50 g/dL.", evidence: [] },
  ]) assert.throws(() => parseChatReply(JSON.stringify(reply), { previousReportReview: review }), error => error.code === "unsupported_quote");
  const inventedSummary = { ...review, summary: "A previous generated summary mentioned 999 mg/L." };
  assert.throws(() => parseChatReply(JSON.stringify({ answer: "Your result is 999 mg/L.", evidence: [] }), { previousReportReview: inventedSummary }), error => error.code === "unsupported_quote");
});

test("a newly attached report takes precedence over all saved review measurements", () => {
  const report = { kind: "text", text: "New synthetic report: CRP 20 mg/L." };
  assert.equal(contextFrom(buildChatMessages({ question: "Explain this new report.", history: [], report, previousReportReview: review })).previousReportReview, null);
  assert.throws(() => parseChatReply(JSON.stringify({ answer: "The result is 13.5 g/dL.", evidence: [] }), { report, previousReportReview: review }), error => error.code === "unsupported_quote");
});

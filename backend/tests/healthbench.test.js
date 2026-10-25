const { test } = require("node:test");
const assert = require("node:assert/strict");
const { adaptEnglishCases, scoreRubrics, makeEnglishDetector } = require("../evals/healthbenchData.cjs");
const { summarizeReview } = require("../evals/healthbenchReview.cjs");
const { selectCases } = require("../evals/caseSelection.cjs");
const { buildChatMessages } = require("../src/reports/chat");

// Invented schema fixtures only. No official benchmark examples are checked in.
const fixture = (overrides = {}) => ({ prompt_id: "fixture-only", example_tags: ["language:English", "theme:synthetic-fixture"], prompt: [{ role: "user", content: "A synthetic fixture question." }], rubrics: [{ criterion: "Synthetic helpfulness criterion.", points: 4, tags: [] }, { criterion: "Synthetic undesirable behavior.", points: -3, tags: [] }], ...overrides });

test("HealthBench imports only explicit English labels, leaving other languages and missing labels out", () => {
  const { cases, summary } = adaptEnglishCases([fixture(), fixture({ prompt_id: "fr", example_tags: ["language:French"] }), fixture({ prompt_id: "mixed", example_tags: ["language:English", "language:Arabic"] }), fixture({ prompt_id: "unknown", example_tags: [] })]);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].language, "en");
  assert.equal(summary.skipped.not_explicitly_english, 3);
});

test("unlabelled source rows use explicit offline detection metadata rather than assuming English", () => {
  const { cases } = adaptEnglishCases([fixture({ example_tags: [] })], { detectEnglish: () => true });
  assert.equal(cases.length, 1);
  assert.equal(cases[0].source.englishSelection, "offline_language_detection_requires_review");
});

test("offline language filtering rejects uncertain short text and non-English conversation turns", async () => {
  const detect = await makeEnglishDetector();
  const english = "This is a synthetic English conversation about a laboratory report. Please explain what information is available and what is still missing without making assumptions about the person's medical history.";
  assert.equal(detect(fixture({ prompt: [{ role: "user", content: english }] })), true);
  assert.equal(detect(fixture({ prompt: [{ role: "user", content: "bonjour" }] })), false);
  assert.equal(detect(fixture({ prompt: [{ role: "user", content: english }, { role: "assistant", content: "هذا نص عربي تجريبي." }] })), false);
  assert.equal(detect(fixture({ prompt: [{ role: "user", content: "Ceci est une conversation en français concernant un rapport de laboratoire. Veuillez expliquer les informations manquantes sans inventer de résultats ou de conseils médicaux." }] })), false);
});

test("English prompt, history and original weighted rubrics are preserved without giving the model answers", () => {
  const row = fixture({ prompt: [{ role: "user", content: "First fixture question." }, { role: "assistant", content: "Earlier fixture reply." }, { role: "user", content: "Follow-up fixture question." }] });
  const entry = adaptEnglishCases([row]).cases[0];
  assert.equal(entry.question, row.prompt.at(-1).content);
  assert.deepEqual(entry.history, row.prompt.slice(0, -1));
  assert.deepEqual(entry.sourceRubrics, row.rubrics);
  const messages = buildChatMessages(entry);
  assert.ok(!JSON.stringify(messages).includes(row.rubrics[0].criterion));
  assert.ok(!JSON.stringify(messages).includes("ideal_completion"));
  assert.equal(selectCases([entry], ["--suite", "healthbench"])[0].id, entry.id);
});

test("app-incompatible HealthBench conversations are counted as skipped rather than truncated", () => {
  const { cases, summary } = adaptEnglishCases([
    fixture({ prompt_id: "long", prompt: [{ role: "user", content: "x".repeat(1201) }] }),
    fixture({ prompt_id: "history", prompt: [...Array.from({ length: 9 }, () => ({ role: "user", content: "Fixture." })), { role: "user", content: "Last fixture question." }] }),
    fixture({ prompt_id: "system", prompt: [{ role: "system", content: "Fixture instruction." }, { role: "user", content: "Question." }] }),
  ]);
  assert.equal(cases.length, 0);
  assert.equal(summary.skipped.question_exceeds_app_limits, 1);
  assert.equal(summary.skipped.history_exceeds_app_limits, 1);
  assert.equal(summary.skipped.unsupported_prompt_format, 1);
});

test("HealthBench score uses positive possible points and penalizes met negative criteria", () => {
  const rubric = fixture().rubrics;
  assert.equal(scoreRubrics(rubric, [{ criteriaMet: true }, { criteriaMet: false }]), 1);
  assert.equal(scoreRubrics(rubric, [{ criteriaMet: true }, { criteriaMet: true }]), 0.25);
  assert.equal(scoreRubrics(rubric, [{ criteriaMet: false }, { criteriaMet: true }]), -0.75);
  assert.throws(() => scoreRubrics(rubric, [{ criteriaMet: null }, { criteriaMet: false }]));
  assert.throws(() => scoreRubrics(rubric, [{ criteriaMet: true }]));
});

test("unreviewed or failed answers cannot produce a claimed HealthBench score", () => {
  const base = { suite: "healthbench", sourceRubrics: fixture().rubrics, providerCalled: true };
  const result = summarizeReview({ plannedCases: 2, results: [{ ...base, result: { answer: "Fixture answer." }, review: { reviewer: null, rubricGrades: [{ index: 0, criteriaMet: null }, { index: 1, criteriaMet: null }] } }, { ...base, result: null, error: { code: "timeout" } }] });
  assert.equal(result.reviewedSubsetMean, null);
  assert.equal(result.unreviewed, 1);
  assert.equal(result.failedDelivery, 1);
  assert.equal(result.coverageComplete, false);
});

test("review summary preserves failure counts and clips per-case scores before averaging", () => {
  const row = { suite: "healthbench", sourceRubrics: fixture().rubrics, result: { answer: "Fixture." }, providerCalled: false, review: { reviewer: "test reviewer", rubricGrades: [{ index: 0, criteriaMet: false }, { index: 1, criteriaMet: true }] } };
  const result = summarizeReview({ plannedCases: 1, results: [row] });
  assert.equal(result.reviewedSubsetMean, 0);
  assert.equal(result.reviewedCases, 1);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.comparableToFullHealthBench, false);
});

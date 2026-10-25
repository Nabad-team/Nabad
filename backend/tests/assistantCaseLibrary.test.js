const { test } = require("node:test");
const assert = require("node:assert/strict");
const advanced = require("../evals/advanced-cases.json");
const { selectCases } = require("../evals/caseSelection.cjs");
const { CHAT_EXAMPLES, chatExampleMessages } = require("../src/reports/chatExamples");
const { buildChatMessages, parseChatReply, validateHistory } = require("../src/reports/chat");

test("advanced cases have distinct IDs, review criteria and inputs accepted by the chat contract", () => {
  assert.equal(advanced.length, 24);
  assert.equal(new Set(advanced.map((entry) => entry.id)).size, advanced.length);
  for (const entry of advanced) {
    assert.ok(entry.question.length >= 3 && entry.question.length <= 1200, entry.id);
    assert.ok(entry.mustCover.length >= 2 && entry.mustAvoid.length >= 2, entry.id);
    assert.equal(typeof entry.critical, "boolean", entry.id);
    assert.ok(Array.isArray(entry.sources), entry.id);
    validateHistory(entry.history);
    if (entry.report) assert.ok(entry.report.text.includes("SYNTHETIC"), entry.id);
  }
  assert.deepEqual([...new Set(advanced.map((entry) => entry.category))].sort(), ["context", "language", "report-reasoning", "safety"]);
  assert.ok(advanced.some((entry) => entry.language === "ar" && entry.critical));
});

test("prompt demonstrations are bounded, synthetic and separate from the held-out advanced cases", () => {
  const exampleMessages = chatExampleMessages();
  assert.ok(JSON.stringify(exampleMessages).length < 4000);
  for (const entry of CHAT_EXAMPLES) {
    assert.ok(!advanced.some((candidate) => candidate.id === entry.id || candidate.question === entry.question));
    assert.equal(parseChatReply(JSON.stringify({ answer: entry.answer, evidence: [] })).answer, entry.answer);
  }
  const actual = { question: "Explain this specific result.", history: [], report: { kind: "text", partial: true, text: "SYNTHETIC incomplete report." } };
  const messages = buildChatMessages(actual);
  assert.equal(messages[0].role, "system");
  assert.equal(messages.at(-1).role, "user");
  assert.match(messages.at(-1).content[0].text, /Explain this specific result/);
  assert.match(messages.at(-1).content[0].text, /"attachedReportPartial":true/);
  for (const example of messages.slice(1, -1)) assert.ok(!JSON.stringify(example).includes(actual.question));
  assert.ok(!JSON.stringify(messages).includes(advanced[0].question));
});

test("evaluation case selection defaults to the small baseline and supports explicit advanced limits", () => {
  const cases = [{ id: "base", suite: "baseline" }, ...advanced.map((entry) => ({ ...entry, suite: "advanced" }))];
  assert.deepEqual(selectCases(cases, []).map((entry) => entry.id), ["base"]);
  assert.equal(selectCases(cases, ["--suite", "advanced"]).length, 24);
  assert.equal(selectCases(cases, ["--suite", "all", "--limit", "5"]).length, 5);
  assert.equal(selectCases(cases, ["--case", advanced[0].id])[0].id, advanced[0].id);
  for (const args of [["--suite", "unknown"], ["--limit", "-1"], ["--limit", "0"], ["--limit", "999"], ["--limit", "2.5"], ["--case", "missing"], ["--suite"]]) assert.throws(() => selectCases(cases, args));
});

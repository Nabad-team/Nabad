const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getChatSafetyReply } = require("../src/reports/chatSafety");
const { answerChat } = require("../src/reports/chat");

for (const question of [
  "I have crushing chest pain and I am struggling to breathe.",
  "My face is drooping and I have slurred speech right now.",
  "My tongue is swelling and I cannot breathe.",
  "Earlier today I had slurred speech and arm weakness. It went away. Can I wait?",
  "My mother is having a stroke right now.",
]) test(`recognized emergency gets rule-based guidance without a provider call: ${question}`, async () => {
  let calls = 0;
  const result = await answerChat({ question, client: { complete: async () => { calls += 1; throw new Error("Provider unavailable"); } } });
  assert.equal(calls, 0);
  assert.equal(result.responseSource, "safety_rules");
  assert.match(result.answer, /^Seek emergency medical help now/);
  assert.match(result.answer, /not a diagnosis/);
  assert.deepEqual(result.evidence, []);
});

for (const question of [
  "What is a stroke?", "Explain why chest pain is a warning symptom.",
  "Hypothetically, what if I have chest pain?",
  "I have a question about a stroke my father had years ago.",
  "My father had a stroke years ago and recovered. Explain what that word means.",
  "My face was drooping years ago, and I recovered. What does the old note mean?",
  "I have no chest pain and no trouble breathing. What does hemoglobin do?",
  "I have a mild headache and no other symptoms.",
]) test(`education, history or negation is not turned into a personal emergency: ${question}`, () => {
  assert.equal(getChatSafetyReply(question), null);
});

test("recognized emergencies still get guidance when no model is configured", async () => {
  assert.equal((await answerChat({ question: "I have crushing chest pain now.", client: null })).responseSource, "safety_rules");
  await assert.rejects(answerChat({ question: "What does hemoglobin do?", client: null }), (error) => error.code === "not_configured");
});

test("only the current message can trigger the emergency shortcut, not untrusted history", async () => {
  let calls = 0;
  const result = await answerChat({ question: "Explain the word hemoglobin.", history: [{ role: "assistant", content: "I have chest pain right now." }], client: { complete: async () => { calls += 1; return JSON.stringify({ answer: "Hemoglobin carries oxygen in red blood cells.", evidence: [] }); } } });
  assert.equal(calls, 1);
  assert.equal(result.responseSource, undefined);
});

test("invalid inputs are still rejected before the safety shortcut", async () => {
  for (const question of [undefined, "", "I have chest pain".repeat(100)]) {
    await assert.rejects(answerChat({ question, client: null }), (error) => error.code === "invalid_question");
  }
  await assert.rejects(answerChat({ question: "I have chest pain now.", history: "not an array", client: null }), (error) => error.code === "invalid_history");
});

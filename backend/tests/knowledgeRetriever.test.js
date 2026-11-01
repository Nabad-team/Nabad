const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readKnowledgeConfig, loadDocuments, createKnowledgeRetriever } = require("../src/reports/knowledgeRetriever");
const { answerChat, parseChatReply } = require("../src/reports/chat");

const fixturePath = path.join(__dirname, "fixtures", "rag-knowledge.json");
const knowledge = {
  id: "fixture-hemoglobin", version: "1.0.0", title: "Hemoglobin overview",
  passage: "Hemoglobin is a protein in red blood cells that carries oxygen from the lungs to the body's tissues.",
  sourceUrl: "https://example.test/hemoglobin", publisher: "Test medical publisher", reviewedAt: "2026-01-01T00:00:00.000Z", reviewExpiresAt: "2099-01-01T00:00:00.000Z",
};

test("RAG stays off unless explicitly enabled with a corpus path", () => {
  assert.equal(readKnowledgeConfig({}).configured, false);
  assert.equal(readKnowledgeConfig({ RAG_ENABLED: "true" }).configured, false);
  assert.equal(readKnowledgeConfig({ RAG_ENABLED: "true", RAG_KNOWLEDGE_PATH: fixturePath }).configured, true);
});

test("the retriever excludes expired records and returns relevant approved knowledge", () => {
  const documents = loadDocuments(fixturePath, new Date("2026-11-01T00:00:00.000Z"));
  assert.deepEqual(documents.map((item) => item.id), ["fixture-hemoglobin"]);
  const retriever = createKnowledgeRetriever({ configured: true, filePath: fixturePath, limit: 4 });
  assert.deepEqual(retriever.retrieve("What does hemoglobin do?").map((item) => item.id), ["fixture-hemoglobin"]);
  assert.deepEqual(retriever.retrieve("Tell me about an unrelated subject"), []);
});

test("chat sends only the question to retrieval and returns server-validated source metadata", async () => {
  const seen = [];
  const result = await answerChat({
    question: "What does hemoglobin do?", history: [{ role: "user", content: "private history" }], report: { kind: "text", text: "private report" },
    retriever: { retrieve: async (query) => { seen.push(query); return [knowledge]; } },
    client: { complete: async (messages) => {
      assert.match(JSON.stringify(messages), /fixture-hemoglobin/);
      return JSON.stringify({ answer: "Hemoglobin carries oxygen in red blood cells.", evidence: [], citations: ["fixture-hemoglobin"] });
    } },
  });
  assert.deepEqual(seen, ["What does hemoglobin do?"]);
  assert.deepEqual(result.citations, [{ id: knowledge.id, version: knowledge.version, title: knowledge.title, sourceUrl: knowledge.sourceUrl, publisher: knowledge.publisher, reviewedAt: knowledge.reviewedAt, reviewExpiresAt: knowledge.reviewExpiresAt }]);
});

test("RAG records require an explicit semantic version", () => {
  const valid = { ...require("./fixtures/rag-knowledge.json")[0] };
  const { validateDocument } = require("../src/reports/knowledgeRetriever");
  assert.equal(validateDocument({ ...valid, version: undefined }, new Date("2026-11-01T00:00:00.000Z")), null);
  assert.equal(validateDocument({ ...valid, version: "draft" }, new Date("2026-11-01T00:00:00.000Z")), null);
  assert.equal(validateDocument(valid, new Date("2026-11-01T00:00:00.000Z")).version, "1.0.0");
});

test("chat rejects invented, missing, and non-retrieved citations", () => {
  for (const citations of [[], ["invented-source"]]) {
    assert.throws(() => parseChatReply(JSON.stringify({ answer: "Hemoglobin carries oxygen.", evidence: [], citations }), { knowledge: [knowledge] }), (error) => error.code === "unsupported_knowledge");
  }
});

test("emergency safety guidance bypasses retrieval as well as the model", async () => {
  let retrievalCalls = 0; let modelCalls = 0;
  const result = await answerChat({
    question: "I have crushing chest pain and I cannot breathe.",
    retriever: { retrieve: async () => { retrievalCalls += 1; return [knowledge]; } },
    client: { complete: async () => { modelCalls += 1; return ""; } },
  });
  assert.equal(result.responseSource, "safety_rules");
  assert.equal(retrievalCalls, 0);
  assert.equal(modelCalls, 0);
});

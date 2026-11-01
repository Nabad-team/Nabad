const fs = require("node:fs");
const path = require("node:path");

const MAX_DOCUMENTS = 2000;
const MAX_PASSAGE_CHARS = 1800;
const DEFAULT_LIMIT = 4;
const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase();
const STOP_WORDS = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "this", "to", "what", "when", "why", "with", "you", "your"]);
const tokens = (value) => (normalize(value).match(/[\p{L}\p{N}]{2,}/gu) || []).filter((token) => !STOP_WORDS.has(token));

function readKnowledgeConfig(env = process.env) {
  if (env.RAG_ENABLED !== "true") return { configured: false, problem: "disabled" };
  if (!env.RAG_KNOWLEDGE_PATH?.trim()) return { configured: false, problem: "missing_path" };
  const filePath = path.resolve(env.RAG_KNOWLEDGE_PATH.trim());
  const limit = env.RAG_MAX_RESULTS ? Number(env.RAG_MAX_RESULTS) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) return { configured: false, problem: "invalid_limit" };
  return { configured: true, filePath, limit };
}

function validateDocument(value, now = new Date()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, title, passage, sourceUrl, publisher, languages, approved, reviewedAt, reviewExpiresAt } = value;
  if (![id, title, passage, sourceUrl, publisher, reviewedAt, reviewExpiresAt].every((item) => typeof item === "string" && item.trim())) return null;
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(id) || passage.length > MAX_PASSAGE_CHARS) return null;
  let url;
  try { url = new URL(sourceUrl); } catch { return null; }
  const reviewed = new Date(reviewedAt); const expires = new Date(reviewExpiresAt);
  if (url.protocol !== "https:" || approved !== true || Number.isNaN(reviewed.valueOf()) || Number.isNaN(expires.valueOf()) || reviewed > now || expires <= now) return null;
  if (!Array.isArray(languages) || languages.length !== 1 || languages[0] !== "en") return null;
  return { id, title: title.trim(), passage: passage.trim(), sourceUrl: url.href, publisher: publisher.trim(), languages, reviewedAt, reviewExpiresAt };
}

function loadDocuments(filePath, now = new Date()) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed) || parsed.length > MAX_DOCUMENTS) throw new Error("Invalid RAG knowledge corpus");
  const documents = parsed.map((item) => validateDocument(item, now)).filter(Boolean);
  const ids = new Set();
  for (const document of documents) {
    if (ids.has(document.id)) throw new Error("Duplicate RAG knowledge document ID");
    ids.add(document.id);
  }
  return documents;
}

function scoreDocuments(question, documents) {
  const query = [...new Set(tokens(question))];
  if (!query.length) return [];
  const frequencies = new Map();
  const indexed = documents.map((document) => {
    const titleTokens = tokens(document.title); const passageTokens = tokens(document.passage);
    const all = new Set([...titleTokens, ...passageTokens]);
    for (const token of all) frequencies.set(token, (frequencies.get(token) || 0) + 1);
    return { document, titleTokens, passageTokens };
  });
  return indexed.map(({ document, titleTokens, passageTokens }) => {
    const titleCounts = new Map(); const passageCounts = new Map();
    for (const token of titleTokens) titleCounts.set(token, (titleCounts.get(token) || 0) + 1);
    for (const token of passageTokens) passageCounts.set(token, (passageCounts.get(token) || 0) + 1);
    const score = query.reduce((sum, token) => {
      const inverseFrequency = Math.log(1 + documents.length / (1 + (frequencies.get(token) || 0)));
      return sum + inverseFrequency * (3 * (titleCounts.get(token) || 0) + Math.min(3, passageCounts.get(token) || 0));
    }, 0);
    return { ...document, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function createKnowledgeRetriever(config) {
  if (!config?.configured) return null;
  const documents = loadDocuments(config.filePath);
  return { retrieve(question) { return scoreDocuments(question, documents).slice(0, config.limit).map(({ score, ...document }) => document); }, documentCount: documents.length };
}

let cached;
function getKnowledgeRetriever(env = process.env) {
  const config = readKnowledgeConfig(env);
  if (!config.configured) return null;
  const cacheKey = `${config.filePath}:${config.limit}`;
  if (!cached || cached.key !== cacheKey) cached = { key: cacheKey, value: createKnowledgeRetriever(config) };
  return cached.value;
}

module.exports = { readKnowledgeConfig, validateDocument, loadDocuments, scoreDocuments, createKnowledgeRetriever, getKnowledgeRetriever };

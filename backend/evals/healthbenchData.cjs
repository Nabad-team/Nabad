const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

// Versioned source from OpenAI's official simple-evals/healthbench_eval.py.
const DATA_URL = "https://openaipublic.blob.core.windows.net/simple-evals/healthbench/2025-05-07-06-14-12_oss_eval.jsonl";
const MIRROR_URL = "https://huggingface.co/datasets/openai/healthbench/resolve/main/2025-05-07-06-14-12_oss_eval.jsonl?download=true";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "healthbench.jsonl");
const MANIFEST_FILE = path.join(DATA_DIR, "healthbench-manifest.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function parseRows(text) {
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
}

function inspectRows(rows) {
  const languageTags = {};
  const tags = {};
  for (const row of rows) for (const tag of row.example_tags || []) {
    if (/language/i.test(tag)) languageTags[tag] = (languageTags[tag] || 0) + 1;
    tags[tag] = (tags[tag] || 0) + 1;
  }
  return { rows: rows.length, fields: Object.keys(rows[0] || {}).sort(), languageTags, tags,
    promptCharacters: rows.reduce((sum, row) => sum + (row.prompt || []).reduce((count, message) => count + (message.content?.length || 0), 0), 0), rubricItems: rows.reduce((sum, row) => sum + (row.rubrics?.length || 0), 0) };
}

async function makeEnglishDetector() {
  const { francAll } = await import("franc-min");
  const shortEnglish = /^(?:yes|no|okay|ok|thanks|thank you|please explain|tell me more)[.!?\s]*$/i;
  return (row) => Array.isArray(row.prompt) && row.prompt.every(({ content }) => {
    if (typeof content !== "string") return false;
    if (shortEnglish.test(content.trim())) return true;
    // Discard non-Latin scripts rather than letting a long English passage
    // conceal a short non-English turn. This is intentionally conservative.
    if (/[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Symbol}\s]/u.test(content)) return false;
    const letters = content.match(/\p{L}/gu) || [];
    if (letters.length < 40) return false;
    const ranked = francAll(content, { minLength: 40 });
    return ranked[0]?.[0] === "eng" && (ranked[1]?.[1] || 0) <= 0.9;
  });
}

function adaptEnglishCases(rows, { detectEnglish } = {}) {
  const cases = [];
  const skipped = {};
  const skip = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };
  const ids = new Set();
  for (const row of rows) {
    const languageTags = (row.example_tags || []).filter((tag) => /^language\s*:/i.test(tag));
    const english = languageTags.length ? languageTags.every((tag) => /^language\s*:\s*(english|en)\s*$/i.test(tag)) : detectEnglish?.(row) === true;
    if (!english) { skip("not_explicitly_english"); continue; }
    if (typeof row.prompt_id !== "string" || ids.has(row.prompt_id)) { skip("invalid_or_duplicate_id"); continue; }
    ids.add(row.prompt_id);
    if (!Array.isArray(row.prompt) || !row.prompt.length || row.prompt.at(-1).role !== "user" || row.prompt.some((message) => !["user", "assistant"].includes(message.role) || typeof message.content !== "string")) { skip("unsupported_prompt_format"); continue; }
    const question = row.prompt.at(-1).content;
    const history = row.prompt.slice(0, -1).map(({ role, content }) => ({ role, content }));
    // Evaluate the real application's limits without silently changing a case.
    if (question.trim().length < 3 || question.length > 1200) { skip("question_exceeds_app_limits"); continue; }
    if (history.length > 8 || history.some((message) => message.content.length > 1200)) { skip("history_exceeds_app_limits"); continue; }
    if (!Array.isArray(row.rubrics) || !row.rubrics.length || row.rubrics.some((item) => typeof item.criterion !== "string" || !Number.isFinite(item.points) || !Array.isArray(item.tags)) || !row.rubrics.some((item) => item.points > 0)) { skip("invalid_rubrics"); continue; }
    cases.push({ id: `healthbench-${row.prompt_id}`, suite: "healthbench", language: "en", category: "official-healthbench", question, history,
      source: { dataset: "HealthBench", promptId: row.prompt_id, tags: row.example_tags, englishSelection: languageTags.length ? "source_language_tag" : "offline_language_detection_requires_review" },
      sourceRubrics: structuredClone(row.rubrics), rubric: "Grade the delivered answer against each original physician-written criterion. Do not send criteria to the evaluated model." });
  }
  return { cases, summary: { totalRows: rows.length, eligibleEnglishCases: cases.length, skipped, englishSelection: detectEnglish ? "Source tags when present; otherwise franc-min English ranked first with a distance margin, every turn checked. Machine selection requires review." : "Explicit English source tags only.", inputAdaptation: "No translation, truncation or system-message injection; application-incompatible prompts are skipped.", comparableToFullHealthBench: false } };
}

// Same per-case weighted formula as the official reference evaluator. Negative
// criteria_met=true means the undesirable behavior happened and incurs a penalty.
function scoreRubrics(rubrics, grades) {
  if (!Array.isArray(rubrics) || !Array.isArray(grades) || rubrics.length !== grades.length || !rubrics.length) throw new Error("Every rubric requires a grade.");
  if (rubrics.some((item) => !Number.isFinite(item.points)) || grades.some((item) => typeof item.criteriaMet !== "boolean")) throw new Error("Rubric points and boolean review decisions are required; unreviewed answers cannot be scored.");
  const possible = rubrics.reduce((sum, item) => sum + Math.max(0, item.points), 0);
  if (!possible) return null;
  return rubrics.reduce((sum, item, index) => sum + (grades[index].criteriaMet ? item.points : 0), 0) / possible;
}

async function downloadHealthBench() {
  const response = await fetch(MIRROR_URL, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HealthBench download returned HTTP ${response.status}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return cacheHealthBench(buffer, MIRROR_URL);
}

async function cacheHealthBench(buffer, downloadedFrom) {
  if (buffer.length > 64 * 1024 * 1024) throw new Error("Unexpected HealthBench download size.");
  const rows = parseRows(buffer.toString("utf8"));
  if (rows.length !== 5000 || rows.some((row) => !Array.isArray(row.prompt) || !Array.isArray(row.rubrics))) throw new Error("Unexpected HealthBench dataset format.");
  await fs.mkdir(DATA_DIR, { recursive: true });
  const manifest = { source: DATA_URL, downloadedFrom, downloadedAt: new Date().toISOString(), sha256: sha256(buffer), rows: rows.length, license: "MIT", licenseSource: "https://huggingface.co/datasets/openai/healthbench", evaluationOnly: true };
  await fs.writeFile(DATA_FILE, buffer);
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  return { manifest, inspection: inspectRows(rows) };
}

async function readHealthBench() {
  let buffer, manifest;
  try { [buffer, manifest] = await Promise.all([fs.readFile(DATA_FILE), fs.readFile(MANIFEST_FILE, "utf8").then(JSON.parse)]); }
  catch { throw new Error("Download the official dataset first: node evals/healthbenchData.cjs --download"); }
  if (sha256(buffer) !== manifest.sha256) throw new Error("HealthBench checksum changed. Download a fresh copy before evaluating.");
  return { rows: parseRows(buffer.toString("utf8")), manifest };
}

if (require.main === module) {
  (async () => {
    if (process.argv.includes("--download")) console.log(JSON.stringify(await downloadHealthBench(), null, 2));
    else if (process.argv.includes("--inspect-source")) {
      const file = process.argv[process.argv.indexOf("--inspect-source") + 1];
      if (!file || file.startsWith("--")) throw new Error("Provide a local dataset path.");
      const text = await fs.readFile(file, "utf8");
      console.log(JSON.stringify(inspectRows(parseRows(text.slice(0, text.lastIndexOf("\n")))), null, 2));
    }
    else if (process.argv.includes("--import")) {
      const input = process.argv[process.argv.indexOf("--import") + 1];
      if (!input || input.startsWith("--")) throw new Error("Provide a local path after --import.");
      console.log(JSON.stringify(await cacheHealthBench(await fs.readFile(input), "local-import"), null, 2));
    }
    else { const { rows, manifest } = await readHealthBench(); console.log(JSON.stringify({ manifest, inspection: inspectRows(rows) }, null, 2)); }
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { DATA_URL, DATA_FILE, readHealthBench, downloadHealthBench, inspectRows, parseRows, adaptEnglishCases, scoreRubrics, makeEnglishDetector };

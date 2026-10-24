// SCRUM-180: safety guardrails around the language model used for AI triage.
//
// A language model can be wrong, can be manipulated by what the user types, and can say
// things a triage app must never say. So nothing it returns reaches the user unchecked:
//
// Before the model (input guardrails)
//   - cleanSymptoms: strips control characters and any <symptoms> tags, so the user's text
//     cannot "close" the data section of the prompt and start writing instructions.
//   - detectPromptInjection: if the text tries to give the model orders ("ignore previous
//     instructions"), the model is not called at all and the safety rules answer alone.
//
// After the model (output guardrails)
//   - parseModelReply: the reply must be one JSON object with a known level and at least one
//     reason. Anything else is rejected and the rules answer alone.
//   - filterText: drops any sentence with a medicine dose, a phone number or link (a made-up
//     emergency number is dangerous), a certain diagnosis, or false reassurance.
//   - applySafetyFloor: the final level is the MORE serious of the rules' level and the model's.
//     The model can raise the urgency, never lower it, so it can never hide a red flag.

const { LEVELS } = require("../urgency");
const { isCareTypeId } = require("../careTypes");

class GuardrailError extends Error {
  constructor(code) {
    super(`Model reply rejected: ${code}`);
    this.name = "GuardrailError";
    this.code = code; // "unparseable" | "invalid_level" | "no_reasons"
  }
}

const MAX_REASONS = 3;
const MAX_SELF_CARE = 4;
const MAX_REASON_CHARS = 300;
const MAX_SELF_CARE_CHARS = 200;
const MAX_CARE_TYPE_CHARS = 80;

// ---------- Input ----------

function cleanSymptoms(text) {
  return String(text ?? "")
    // Control characters (keeps tab and newline).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    // Any opening or closing symptoms tag, with or without spaces or capitals.
    .replace(/<\s*\/?\s*symptoms\s*>/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Phrases people do not use to describe symptoms, but do use to give a model orders.
const INJECTION_PATTERNS = [
  { id: "ignore_instructions", pattern: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|rules?|prompts?|guidelines?)\b/i },
  { id: "system_prompt", pattern: /\b(system|developer)\s+(prompt|message|instructions?)\b/i },
  { id: "role_change", pattern: /\b(you are now|from now on you|pretend (to be|you are)|act as (an? )?(ai|assistant|model|chatbot|doctor))\b/i },
  { id: "reveal_prompt", pattern: /\b(reveal|show|print|repeat)\b[^.\n]{0,30}\b(your|the) (instructions|prompt|rules)\b/i },
  { id: "jailbreak", pattern: /\b(jailbreak|developer mode|dan mode)\b/i },
  { id: "forced_output", pattern: /["']?level["']?\s*:\s*["']?(emergency|urgent|soon|routine)/i },
  // Arabic: "ignore (all) the instructions / orders / rules".
  { id: "ignore_instructions_ar", pattern: /(تجاهل|انسَ|انس)\s+(كل\s+|جميع\s+)?(التعليمات|الأوامر|القواعد)/ },
];

// Returns the ids of the patterns found (empty when the text looks like a normal description).
function detectPromptInjection(text) {
  return INJECTION_PATTERNS.filter(({ pattern }) => pattern.test(String(text ?? ""))).map(({ id }) => id);
}

// ---------- Output ----------

// Each check removes a whole sentence; the id says why (it is logged and returned for testing).
const UNSAFE_TEXT = [
  { id: "medication_dose", pattern: /\b\d+(\.\d+)?\s?(mg|mcg|µg|g|ml|iu|units?|tablets?|pills?|capsules?|drops?|puffs?)\b|\b(dose|dosage|prescribe|prescription)\b/i },
  // Western and Arabic-Indic digits (٠-٩), since replies can be in Arabic.
  { id: "phone_number", pattern: /\+?[\d٠-٩][\d٠-٩\s().-]{5,}[\d٠-٩]/ },
  { id: "link", pattern: /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|lb|gov)\b/i },
  { id: "certain_diagnosis", pattern: /\b(you (definitely|certainly|clearly) have|you are diagnosed|your diagnosis is|i diagnose|this is definitely)\b/i },
  { id: "false_reassurance", pattern: /\b(no need to (see|visit|call|go)|don'?t need (to see )?(a )?(doctor|medical)|nothing to worry about|you can ignore (it|this|these))\b/i },
];

// Returns { text, removed } where text is null if the sentence must not be shown.
function filterText(value, maxChars, { ignore = [] } = {}) {
  if (typeof value !== "string") return { text: null, removed: "not_text" };
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return { text: null, removed: "empty" };
  const unsafe = UNSAFE_TEXT.find(({ id, pattern }) => !ignore.includes(id) && pattern.test(text));
  if (unsafe) return { text: null, removed: unsafe.id };
  return { text: text.length > maxChars ? text.slice(0, maxChars - 1).trimEnd() + "…" : text, removed: null };
}

function filterList(values, maxItems, maxChars, removed) {
  if (!Array.isArray(values)) return [];
  const kept = [];
  for (const value of values) {
    const result = filterText(value, maxChars);
    if (result.removed) removed.push(result.removed);
    else if (!kept.includes(result.text)) kept.push(result.text);
  }
  return kept.slice(0, maxItems);
}

// Models sometimes wrap JSON in ```json fences or add a sentence around it.
function extractJson(raw) {
  const text = String(raw ?? "").replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new GuardrailError("unparseable");
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new GuardrailError("unparseable");
  }
}

// Turns the model's raw reply into a checked result, or throws GuardrailError.
// Returns { level, reasons, careType, careTypeId, selfCare, removed } where removed lists the dropped sentences' reasons.
function parseModelReply(raw) {
  const value = extractJson(raw);
  const level = typeof value.level === "string" ? value.level.trim().toLowerCase() : "";
  if (!Object.hasOwn(LEVELS, level)) throw new GuardrailError("invalid_level");

  const removed = [];
  const reasons = filterList(value.reasons, MAX_REASONS, MAX_REASON_CHARS, removed);
  if (reasons.length === 0) throw new GuardrailError("no_reasons");
  const careTypeResult = value.careType === undefined || value.careType === null ? { text: null, removed: null } : filterText(value.careType, MAX_CARE_TYPE_CHARS);
  if (careTypeResult.removed) removed.push(careTypeResult.removed);
  const selfCare = filterList(value.selfCare, MAX_SELF_CARE, MAX_SELF_CARE_CHARS, removed);
  // SCRUM-278: the model may suggest one of the fixed care-type ids. Anything not on the list is
  // dropped (the server then picks one itself); it never rejects the whole reply.
  const careTypeIdText = typeof value.careTypeId === "string" ? value.careTypeId.trim().toLowerCase() : null;
  const careTypeId = isCareTypeId(careTypeIdText) ? careTypeIdText : null;
  if (value.careTypeId !== undefined && value.careTypeId !== null && !careTypeId) removed.push("unknown_care_type_id");

  return { level, reasons, careType: careTypeResult.text, careTypeId, selfCare, removed };
}

// ---------- Combining with the rules ----------

const moreSerious = (a, b) => (LEVELS[a].rank <= LEVELS[b].rank ? a : b);

// ruleLevel: from the rule classifier (and follow-up answers). modelLevel: from parseModelReply.
// Returns the final level and which guardrail applied.
function applySafetyFloor(ruleLevel, modelLevel) {
  const level = moreSerious(ruleLevel, modelLevel);
  let applied = "agreed";
  if (LEVELS[modelLevel].rank > LEVELS[ruleLevel].rank) applied = "model_lower_ignored";
  else if (LEVELS[modelLevel].rank < LEVELS[ruleLevel].rank) applied = "model_raised";
  return { level, applied };
}

module.exports = {
  GuardrailError,
  cleanSymptoms,
  detectPromptInjection,
  filterText,
  parseModelReply,
  applySafetyFloor,
  INJECTION_PATTERNS,
  UNSAFE_TEXT,
  MAX_REASONS,
  MAX_SELF_CARE,
};

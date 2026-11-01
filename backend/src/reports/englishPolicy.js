// The health assistant is intentionally English-only. This deterministic
// boundary rejects scripts that clearly indicate another language. It is not a
// general language classifier: Latin-script names and medical terms remain valid.
const UNSUPPORTED_SCRIPTS = /[\p{Script=Arabic}\p{Script=Armenian}\p{Script=Bengali}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Georgian}\p{Script=Han}\p{Script=Hangul}\p{Script=Hebrew}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Tamil}\p{Script=Thai}]/u;
const UNSUPPORTED_SCRIPTS_GLOBAL = new RegExp(UNSUPPORTED_SCRIPTS.source, "gu");
const LATIN_LETTERS = /\p{Script=Latin}/gu;

function isEnglishCompatibleText(value) {
  return typeof value === "string" && !UNSUPPORTED_SCRIPTS.test(value.normalize("NFKC"));
}

// Written reports often contain a patient name or a short bilingual header in
// another script even when all clinical content is English. Permit that small
// incidental portion without weakening the English-only question/output rule.
function isEnglishCompatibleReport(value) {
  if (typeof value !== "string") return false;
  const text = value.normalize("NFKC");
  const unsupported = (text.match(UNSUPPORTED_SCRIPTS_GLOBAL) || []).length;
  if (!unsupported) return true;
  const latin = (text.match(LATIN_LETTERS) || []).length;
  if (latin < 20) return false;
  return unsupported <= 32 || unsupported / (unsupported + latin) <= 0.15;
}

module.exports = { isEnglishCompatibleText, isEnglishCompatibleReport, UNSUPPORTED_SCRIPTS };

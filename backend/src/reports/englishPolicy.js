// The health assistant is intentionally English-only. This deterministic
// boundary rejects scripts that clearly indicate another language. It is not a
// general language classifier: Latin-script names and medical terms remain valid.
const UNSUPPORTED_SCRIPTS = /[\p{Script=Arabic}\p{Script=Armenian}\p{Script=Bengali}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Georgian}\p{Script=Han}\p{Script=Hangul}\p{Script=Hebrew}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Tamil}\p{Script=Thai}]/u;

function isEnglishCompatibleText(value) {
  return typeof value === "string" && !UNSUPPORTED_SCRIPTS.test(value.normalize("NFKC"));
}

module.exports = { isEnglishCompatibleText, UNSUPPORTED_SCRIPTS };

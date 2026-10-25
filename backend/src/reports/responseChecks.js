// These checks are a backstop for generated text, not a clinical classifier.
function asciiNumbers(value) {
  return String(value || "").normalize("NFKC")
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.codePointAt(0) - (digit.codePointAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)))
    .replace(/\u066b/g, ".").replace(/,/g, ".");
}

const numericValues = (value) => asciiNumbers(value).match(/\d+(?:\.\d+)?/g) || [];

function hasUnsafeAdvice(value) {
  const text = asciiNumbers(value).replace(/[\u064b-\u065f\u0670]/g, "");
  // Direct personal diagnoses; qualified explanations such as "if you have" and
  // "you may have" remain possible. Refusals are not diagnoses.
  const diagnosis = /\b(?:you have|you suffer from|you are suffering from|your symptoms (?:are caused by|mean you have)|the patient has)\s+(?!(?:described|reported|mentioned|asked|provided|not provided|no (?:tests?|reports?|results?|data|information)|a question|a result|a report|a test)\b)/gi;
  for (const match of text.matchAll(diagnosis)) {
    // A conditional discussion or statement of uncertainty is not a diagnosis.
    if (!/\b(?:if|when|whether)\s*$/i.test(text.slice(0, match.index))) return true;
  }
  if (/(?:^|[.!؟؛:\n]\s*)(?:أنت مصاب|انت مصاب|لديك مرض|لديك فقر الدم|تشخيصك هو)/.test(text)) return true;
  const dose = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|units?|tablets?|pills?|capsules?|drops?|puffs?)\b|\b(?:dose|dosage|tablets?|pills?|capsules?|daily|nightly|twice|times a day|every (?:day|night|morning|\d+ hours?))\b|(?:جرعة|يوميا|مرتين|كل يوم|\d+\s*(?:ملغ|مغ|ميكروغرام|مل|حبات?|أقراص|قرص))/i;
  const directive = /(?:^|[;:]\s*|\b(?:you (?:should|must|can|need to)|i (?:recommend|advise)(?: (?:that )?you)?|please)\s+)(?:take|start|stop|use|inject|inhale|swallow|increase|decrease|reduce|double|halve|switch)\b[^\n]{0,180}/gi;
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/u)) {
    for (const match of sentence.matchAll(directive)) if (dose.test(match[0])) return true;
  }
  if (/(?:^|[.!؟؛:\n]\s*)(?:(?:يجب عليك|عليك|أنصحك أن)\s+)?(?:تناول|خذ|خذي|ابدأ|ابدئي|زد|زيدي|ضاعف|أوقف|اوقف|قلل)[^!؟\n]{0,180}/.test(text) && dose.test(text)) return true;
  return false;
}

// Only explicit, arithmetically verified mass-concentration equivalences may
// introduce a new number. We never infer molecular-weight conversions or ranges.
const measurement = "(?<![\\d.])([-+]?\\d+(?:\\.\\d+)?)\\s*((?:mg|g|ug|µg|ng)\\s*\\/\\s*(?:dl|ml|l))(?![a-z/])";
const factors = { "mg/l": 1, "mg/dl": 10, "g/l": 1000, "g/dl": 10000, "ug/l": 0.001, "µg/l": 0.001, "ng/ml": 0.001 };
const unitKey = (unit) => unit.toLowerCase().replace(/\s+/g, "");

function numbersAreGrounded(value, reportText, { allowConversions = false } = {}) {
  const text = asciiNumbers(value);
  const source = asciiNumbers(reportText);
  const allowed = new Set(numericValues(source).map(Number));
  const verified = [];
  if (allowConversions) {
    const sourceMeasurements = [...source.matchAll(new RegExp(measurement, "gi"))];
    const equivalent = new RegExp(`${measurement}\\s*(?:=|equals?|is equivalent to|converts to|يعادل|يساوي|تساوي)\\s*${measurement}`, "gi");
    for (const match of text.matchAll(equivalent)) {
      const leftUnit = unitKey(match[2]); const rightUnit = unitKey(match[4]);
      if (!factors[leftUnit] || !factors[rightUnit]) continue;
      const left = Number(match[1]) * factors[leftUnit];
      const right = Number(match[3]) * factors[rightUnit];
      const anchored = sourceMeasurements.some((item) => (Number(item[1]) === Number(match[1]) && unitKey(item[2]) === leftUnit) || (Number(item[1]) === Number(match[3]) && unitKey(item[2]) === rightUnit));
      if (anchored && Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-10) verified.push([match.index, match.index + match[0].length]);
    }
  }
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].every((match) => allowed.has(Number(match[0])) || verified.some(([start, end]) => match.index >= start && match.index + match[0].length <= end));
}

module.exports = { numericValues, numbersAreGrounded, hasUnsafeAdvice };

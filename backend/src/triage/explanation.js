// SCRUM-130 (backlog #29): "As a user, I want a plain-language explanation of why a
// recommendation was given so that I trust the result."
//
// explainUrgency() turns a triage result into an explanation a non-medical person can check:
//   summary       one sentence: what we suggest and the main reason
//   triggers      the user's own words that led to the result ({ words: [...], meaning })
//   changedBy     follow-up answers that made the result more urgent
//   notCounted    warning signs the user said they do NOT have, so they can see nothing was misread
//   watchFor      when to get help sooner (or, for an emergency, not to wait)
//   basedOn       what the result was based on: the safety rules, the answers, an AI check
//
// It is a pure function (no database, no network). It works with the results of /classify,
// /refine and /ai-assess, and only ever quotes the app's own phrase list back, never raw user text.

const { classifyUrgency, LEVELS, RULES, normalise, containsPositive, mentions } = require("./urgency");
const { refineUrgency, SPECIFIC, GENERAL } = require("./followUps");

const RECOMMENDATION = {
  emergency: "getting emergency care now",
  urgent: "getting seen by a doctor today",
  soon: "seeing a doctor in the next day or two",
  routine: "looking after yourself at home for now",
};

const CALL_140 = "Call 140 straight away if you get chest pain, trouble breathing, a drooping face or slurred speech, a seizure, or bleeding that won't stop.";
const WATCH_FOR = {
  emergency: ["Don't wait to see if it gets better. Call 140 or go to the nearest emergency department now."],
  urgent: [CALL_140, "If you can't be seen by a doctor today, go to an emergency department."],
  soon: [CALL_140, "Get seen today if your symptoms get much worse or you can't keep fluids down."],
  routine: [CALL_140, "See a doctor if your symptoms last more than a few days or get worse."],
};

// Only these levels count as warning signs worth confirming in "notCounted".
const WARNING_LEVELS = ["emergency", "urgent"];
const MAX_TRIGGERS = 3;
const MAX_WORDS_PER_TRIGGER = 3;
const MAX_NOT_COUNTED = 3;
const MAX_QUOTED_IN_SUMMARY = 3; // keeps the one-sentence summary short

const quote = (words) => `“${words}”`;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// True if the phrase appears as whole words, negated or not ("no chest pain" contains "chest pain").
function appears(text, phrase) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`).test(text);
}

// "a", "a and b", "a, b and c"
function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// The words that made each rule match, for the rules at the rules' own winning level.
// words: the matched phrases, minus any already inside a longer match ("cant breathe" in "i cant breathe").
// SCRUM-125: a phrase recognised from everyday wording is quoted as the user said it ("my chest hurts").
// Those words can only be ones the patterns in everydayWording.js allow, never free text.
function findTriggers(text, level, understood) {
  const userWords = (phrase) => (containsPositive(text, phrase)
    ? [phrase]
    : understood.filter((item) => item.means === phrase).map((item) => item.said));
  return RULES.filter((rule) => rule.level === level)
    .map((rule) => {
      const phrases = rule.all
        ? (rule.all.every((p) => mentions(text, p, understood)) ? rule.all : [])
        : rule.any.filter((p) => mentions(text, p, understood));
      const matched = [...new Set(phrases.flatMap(userWords))];
      const words = matched.filter((p) => !matched.some((other) => other !== p && other.includes(p))).slice(0, MAX_WORDS_PER_TRIGGER);
      return words.length ? { words, meaning: rule.reason } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_TRIGGERS);
}

// Warning signs mentioned only in the negative ("no chest pain", "without fever").
// A phrase that was counted through everyday wording ("no chest pain earlier, but now my chest hurts") is never listed.
function findNotCounted(text, understood) {
  const found = [];
  for (const rule of RULES.filter((r) => WARNING_LEVELS.includes(r.level))) {
    const phrase = (rule.all || rule.any).find((p) => appears(text, p) && !mentions(text, p, understood));
    if (phrase && !found.includes(phrase)) found.push(phrase);
  }
  // "no high fever" also contains "fever": list only the longer phrase.
  return found.filter((p) => !found.some((other) => other !== p && other.includes(p))).slice(0, MAX_NOT_COUNTED);
}

// The answers that made the result more urgent than the description alone.
function findChangedBy(symptoms, answers, initial) {
  if (!answers || typeof answers !== "object" || Object.keys(answers).length === 0) return [];
  const refined = refineUrgency(symptoms, answers);
  if (LEVELS[refined.level].rank >= LEVELS[initial.level].rank) return [];
  return Object.entries(answers).flatMap(([id, value]) => {
    const question = [...SPECIFIC, ...GENERAL].find((q) => q.id === id);
    const option = question?.options.find((o) => o.value === value);
    const raised = option?.reason && refined.reasons.includes(option.reason) && !initial.reasons.includes(option.reason);
    return raised ? [{ question: question.text, answer: option.label, effect: option.reason }] : [];
  });
}

function describeBasis({ ai, hasAnswers }) {
  const parts = [];
  if (ai?.used) {
    parts.push("Nabad's safety rules and an AI check of your description. The AI can only make the advice more cautious, never less.");
    if (ai.guardrails?.[0] === "model_lower_ignored") parts.push("The AI suggested something less urgent, but the safety rules come first.");
  } else if (hasAnswers) {
    parts.push("Nabad's safety rules, which look for known warning signs in what you wrote, and your answers to the follow-up questions.");
  } else {
    parts.push("Nabad's safety rules, which look for known warning signs in what you wrote.");
  }
  if (ai && !ai.used) {
    if (ai.reason === "emergency_rule") parts.push("Because this may be an emergency, we didn't wait for an AI check.");
    else if (ai.reason !== "not_configured") parts.push("The AI check wasn't available this time.");
  }
  return parts.join(" ");
}

// result: from classifyUrgency, refineUrgency or assessWithAi. answers: the follow-up answers, if any.
function explainUrgency({ symptoms, result, answers }) {
  const level = Object.hasOwn(LEVELS, result?.level) ? result.level : "routine";
  const text = normalise(symptoms);
  const initial = classifyUrgency(symptoms);
  const triggers = initial.matchedRuleIds.length ? findTriggers(text, initial.level, initial.understood) : [];
  const changedBy = findChangedBy(symptoms, answers, initial);
  const ai = result?.ai;
  const aiRaised = ai?.used && ai.guardrails?.[0] === "model_raised";

  const quoted = (items) => {
    const shown = items.slice(0, MAX_QUOTED_IN_SUMMARY).map(quote);
    if (items.length > MAX_QUOTED_IN_SUMMARY) shown.push("more");
    return joinList(shown);
  };

  let because;
  if (aiRaised) because = "an AI check of your description found signs that need quicker care";
  else if (changedBy.length) because = `of your ${changedBy.length === 1 ? "answer" : "answers"} ${quoted(changedBy.map((c) => c.answer))}`;
  else if (triggers.length) because = `you mentioned ${quoted(triggers.flatMap((t) => t.words))}`;
  else if (ai?.used) because = "of how an AI check read your description";
  else because = "nothing you described matched a known warning sign";

  return {
    summary: `We suggest ${RECOMMENDATION[level]} because ${because}.`,
    triggers,
    changedBy,
    notCounted: findNotCounted(text, initial.understood),
    watchFor: WATCH_FOR[level],
    basedOn: describeBasis({ ai, hasAnswers: Boolean(answers && Object.keys(answers).length) }),
  };
}

module.exports = { explainUrgency, RECOMMENDATION, WATCH_FOR, MAX_TRIGGERS, MAX_WORDS_PER_TRIGGER, MAX_NOT_COUNTED, MAX_QUOTED_IN_SUMMARY };

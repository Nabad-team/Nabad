// SCRUM-128 (backlog #27): "As a user, I want to receive an urgency classification
// so that I know whether and how soon I need care."
//
// This module turns a free-text symptom description into one of four urgency levels.
// It is a pure function (no database, no network) so it is easy to unit test, and so
// the rules can later be swapped for an AI model without touching the route or the UI.
//
// How it works:
//   1. Normalise the text (lowercase, collapse spaces).
//   2. Check every rule's phrases against the text, skipping phrases that are negated
//      ("no chest pain", "without fever").
//   3. The most serious matched level wins. Nothing matched -> "routine" with low confidence.
//
// These rules use commonly published red-flag symptoms. They are guidance, not a
// diagnosis, and must be reviewed by the team's clinical/product owner before release.

const { EVERYDAY_WORDING } = require("./everydayWording");

const LEVELS = {
  emergency: {
    rank: 0,
    label: "Emergency",
    timeframe: "Now",
    action: "Call 140 (Lebanese Red Cross) or go to the nearest emergency department immediately.",
  },
  urgent: {
    rank: 1,
    label: "Urgent",
    timeframe: "Within a few hours (today)",
    action: "Get seen today at an emergency department or urgent care clinic. Call 140 if it gets worse.",
  },
  soon: {
    rank: 2,
    label: "See a doctor soon",
    timeframe: "Within 24 to 48 hours",
    action: "Book an appointment with a doctor in the next day or two. Get help sooner if it gets worse.",
  },
  routine: {
    rank: 3,
    label: "Routine / self-care",
    timeframe: "Within a few days, if it does not improve",
    action: "Rest and monitor your symptoms. Book a regular appointment if they last more than a few days or get worse.",
  },
};

// Each rule: an id (for logging/tests), a level, a reason shown to the user, and phrases.
// "all" means every listed phrase must appear (used for combinations such as fever + stiff neck).
const RULES = [
  // ---- Emergency ----
  { id: "chest-pain", level: "emergency", reason: "Chest pain or pressure can be a sign of a heart attack.",
    any: ["chest pain", "chest pressure", "chest tightness", "pain in my chest", "pressure in my chest", "crushing pain"] },
  { id: "suspected-heart-attack", level: "emergency", currentEmergency: true, reason: "A suspected heart attack needs emergency care.",
    any: ["heart attack", "heart-attack", "heartattack", "myocardial infarction"] },
  { id: "breathing", level: "emergency", reason: "Severe difficulty breathing needs immediate care.",
    any: ["can't breathe", "cannot breathe", "cant breathe", "struggling to breathe", "difficulty breathing", "trouble breathing", "short of breath at rest", "gasping", "choking", "lips turning blue", "blue lips"] },
  { id: "stroke", level: "emergency", reason: "Face drooping, arm weakness or slurred speech can be signs of a stroke.",
    any: ["face drooping", "drooping face", "face is drooping", "slurred speech", "can't speak", "cannot speak", "one side of my body", "one side of the body", "sudden weakness", "sudden numbness", "arm weakness"] },
  { id: "suspected-stroke", level: "emergency", currentEmergency: true, reason: "A suspected stroke needs emergency care.",
    any: ["stroke", "cerebrovascular accident"] },
  { id: "consciousness", level: "emergency", reason: "Loss of consciousness or a seizure needs emergency care.",
    any: ["unconscious", "passed out", "fainted", "not waking up", "won't wake up", "unresponsive", "seizure", "convulsion"] },
  { id: "bleeding", level: "emergency", reason: "Heavy bleeding that will not stop is an emergency.",
    any: ["heavy bleeding", "bleeding heavily", "won't stop bleeding", "bleeding won't stop", "bleeding that won't stop", "coughing up blood", "vomiting blood", "throwing up blood"] },
  { id: "anaphylaxis", level: "emergency", reason: "Swelling of the face, lips or throat can be a severe allergic reaction.",
    any: ["throat swelling", "swollen throat", "throat is closing", "tongue swelling", "swollen tongue", "lips swelling", "swollen lips", "anaphylaxis"] },
  { id: "worst-headache", level: "emergency", reason: "A sudden, extremely severe headache can signal bleeding in the brain.",
    any: ["worst headache", "thunderclap headache", "sudden severe headache"] },
  { id: "meningitis", level: "emergency", reason: "Fever with a stiff neck can be a sign of meningitis.",
    all: ["fever", "stiff neck"] },
  { id: "self-harm", level: "emergency", reason: "Thoughts of ending your life need immediate support. You can also call Embrace Lifeline on 1564.",
    any: ["suicidal", "suicide", "kill myself", "end my life", "want to die"] },
  { id: "poisoning", level: "emergency", reason: "Overdose or poisoning needs emergency care.",
    any: ["overdose", "poisoned", "swallowed poison", "swallowed bleach"] },

  // ---- Urgent ----
  { id: "high-fever", level: "urgent", reason: "A very high fever needs to be checked today.",
    any: ["high fever", "fever of 40", "fever of 39.5", "40 degrees", "104 degrees"] },
  { id: "severe-abdominal", level: "urgent", reason: "Severe abdominal pain should be checked today.",
    any: ["severe stomach pain", "severe abdominal pain", "severe belly pain", "sharp pain in my lower right"] },
  { id: "dehydration", level: "urgent", reason: "Not being able to keep fluids down can lead to dehydration.",
    any: ["can't keep anything down", "cannot keep fluids down", "can't keep water down", "no urine", "not peeing"] },
  { id: "injury", level: "urgent", reason: "A possible broken bone, deep cut or head injury should be checked today.",
    any: ["broken bone", "bone is sticking out", "deep cut", "head injury", "hit my head", "can't move my", "cannot put weight"] },
  { id: "pregnancy", level: "urgent", reason: "Bleeding or pain during pregnancy should be checked today.",
    all: ["pregnant", "bleeding"] },

  // ---- Soon ----
  { id: "fever", level: "soon", reason: "A fever should be checked by a doctor if it lasts or gets worse.",
    any: ["fever", "temperature"] },
  { id: "persistent", level: "soon", reason: "Symptoms lasting several days should be checked by a doctor.",
    any: ["for a week", "for weeks", "for several days", "for 3 days", "for three days", "keeps coming back", "getting worse"] },
  { id: "infection", level: "soon", reason: "Signs of infection should be checked by a doctor.",
    any: ["ear pain", "earache", "burning when i pee", "burning urination", "pus", "infected", "swollen and red"] },
  { id: "vomiting", level: "soon", reason: "Ongoing vomiting or diarrhoea should be checked by a doctor.",
    any: ["vomiting", "throwing up", "diarrhea", "diarrhoea"] },
  { id: "rash", level: "soon", reason: "A new rash should be looked at by a doctor.",
    any: ["rash"] },

  // ---- Routine ----
  { id: "mild", level: "routine", reason: "Mild, common symptoms like these can usually be managed at home.",
    any: ["runny nose", "sneezing", "sore throat", "mild headache", "cough", "cold", "tired", "fatigue", "minor cut", "bruise"] },
];

// Words that cancel a phrase when they appear shortly before it ("no chest pain", "without fever").
const NEGATIONS = ["no", "not", "without", "don't have", "dont have", "do not have", "denies", "never"];
const NEGATION_WINDOW = 3; // how many words before the phrase we look for a negation
// A negation does not carry past these words: in "not sure but chest pain" the "not"
// belongs to "sure", so the chest pain must still count. Missing a red flag is the worst
// possible mistake here, so we only cancel a phrase when the negation clearly applies to it.
const CLAUSE_BREAKS = ["but", "and", "or", "then", "now", "also", "however", "."];

// SCRUM-125: contractions typed or dictated without an apostrophe ("cant", "dont", "im").
// Voice transcripts often drop them, and the rules and negations are written with them.
const CONTRACTIONS = /\b(can|won|don|doesn|didn|isn|aren|wasn|weren|couldn|wouldn|shouldn|haven|hasn)t\b/g;

function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    // SCRUM-125: a comma, semicolon, colon or ?/! ends a clause, so a negation never carries
    // past it: in "no cough, chest pain" the chest pain must count.
    .replace(/[,;:!?]/g, " . ")
    .replace(/[^a-z0-9'.\s]/g, " ")
    .replace(CONTRACTIONS, "$1't")
    .replace(/\bim\b/g, "i'm")
    .replace(/\bive\b/g, "i've")
    .replace(/\s+/g, " ")
    .trim();
}

// True if a negation applies to whatever starts at this position of the (normalised) text.
function isNegatedAt(text, index) {
  let words = text.slice(0, index).replace(/\./g, " . ").trim().split(/\s+/).slice(-NEGATION_WINDOW);
  const lastBreak = words.map((word) => CLAUSE_BREAKS.includes(word)).lastIndexOf(true);
  if (lastBreak !== -1) words = words.slice(lastBreak + 1);
  const before = words.join(" ");
  return NEGATIONS.some((word) => new RegExp(`(^|\\s)${word}(\\s|$)`).test(before));
}

// True if the phrase appears at least once in the text without a negation just before it.
function containsPositive(text, phrase) {
  let from = 0;
  while (true) {
    const index = text.indexOf(phrase, from);
    if (index === -1) return false;
    // Whole words only: "rash" must not match inside "crash", nor "cold" inside "scolded".
    const isLetter = (char) => /[a-z0-9]/.test(char || "");
    if (isLetter(text[index - 1]) || isLetter(text[index + phrase.length])) {
      from = index + 1;
      continue;
    }
    if (!isNegatedAt(text, index)) return true;
    from = index + phrase.length;
  }
}

// SCRUM-125: everyday wording the user used, and the rule phrase it means.
// Returns [{ said: "my chest hurts" (the words as normalised), means: "chest pain" }], negated ones left out.
function findEverydayWording(text) {
  const found = [];
  for (const { means, patterns } of EVERYDAY_WORDING) {
    for (const pattern of patterns) {
      const global = new RegExp(pattern.source, "g");
      for (const match of text.matchAll(global)) {
        if (isNegatedAt(text, match.index)) continue;
        if (!found.some((item) => item.means === means && item.said === match[0])) found.push({ said: match[0], means });
      }
    }
  }
  return found;
}

// A rule phrase counts if the user wrote it, or wrote everyday wording that means it.
function mentions(text, phrase, understood) {
  return containsPositive(text, phrase) || understood.some((item) => item.means === phrase);
}

// A named emergency is a red flag when it describes the current speaker or
// someone currently present. Do not treat a clearly historical/third-person
// mention as a current emergency.
function containsCurrentEmergency(text, phrase) {
  let from = 0;
  while (true) {
    const index = text.indexOf(phrase, from);
    if (index === -1) return false;
    const previousClause = text.lastIndexOf(".", index);
    const nextClause = text.indexOf(".", index + phrase.length);
    const before = text.slice(previousClause + 1, index);
    const after = text.slice(index + phrase.length, nextClause === -1 ? undefined : nextClause);
    const historical = /\b(had|years ago|last year|in the past|previously|history of|recovered from)\b/.test(`${before} ${after}`);
    const otherPerson = /\b(my|his|her|their)\s+(father|mother|dad|mom|mum|parent|grandfather|grandmother|brother|sister|friend|uncle|aunt|child|son|daughter)\b/.test(before);
    if (!isNegatedAt(text, index) && !historical && !otherPerson) return true;
    from = index + phrase.length;
  }
}

function ruleMatches(text, rule, understood = []) {
  if (rule.currentEmergency) return rule.any.some((phrase) => containsCurrentEmergency(text, phrase));
  if (rule.all) return rule.all.every((phrase) => mentions(text, phrase, understood));
  return rule.any.some((phrase) => mentions(text, phrase, understood));
}

function classifyUrgency(description) {
  const text = normalise(description);
  const understood = findEverydayWording(text);
  const matched = RULES.filter((rule) => ruleMatches(text, rule, understood));

  if (matched.length === 0) {
    return {
      level: "routine",
      ...publicLevel("routine"),
      confidence: "low",
      reasons: ["Nothing in your description matched a known warning sign. If you feel unwell or unsure, contact a doctor."],
      matchedRuleIds: [],
      understood,
    };
  }

  // Most serious level wins (lowest rank).
  const level = matched.reduce((best, rule) => (LEVELS[rule.level].rank < LEVELS[best].rank ? rule.level : best), "routine");
  // Only the winning level's reasons are shown to the user: telling someone with chest pain
  // that their runny nose "can be managed at home" would contradict "call 140 now".
  // All matched rule ids are still returned (most serious first) for logging and tests.
  const ordered = [...matched].sort((a, b) => LEVELS[a.level].rank - LEVELS[b.level].rank);
  const winning = ordered.filter((rule) => rule.level === level);

  return {
    level,
    ...publicLevel(level),
    confidence: "rule-match",
    reasons: [...new Set(winning.map((rule) => rule.reason))],
    matchedRuleIds: ordered.map((rule) => rule.id),
    // SCRUM-125: everyday wording that was recognised, so the user can see how they were understood.
    understood,
  };
}

function publicLevel(level) {
  const { label, timeframe, action } = LEVELS[level];
  return { label, timeframe, action };
}

module.exports = { classifyUrgency, LEVELS, RULES, normalise, containsPositive, isNegatedAt, findEverydayWording, mentions };

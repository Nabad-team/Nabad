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
    any: ["throat swelling", "swollen throat", "throat is closing", "tongue swelling", "swollen tongue", "lips swelling", "swollen lips", "anaphylaxis", "severe allergic reaction", "anaphylactic"] },
  { id: "worst-headache", level: "emergency", reason: "A sudden, extremely severe headache can signal bleeding in the brain.",
    any: ["worst headache", "thunderclap headache", "sudden severe headache"] },
  { id: "meningitis", level: "emergency", reason: "Fever with a stiff neck can be a sign of meningitis.",
    all: ["fever", "stiff neck"] },
  { id: "self-harm", level: "emergency", reason: "Thoughts of ending your life need immediate support. You can also call Embrace Lifeline on 1564.",
    any: ["suicidal", "suicide", "kill myself", "end my life", "want to die"] },
  { id: "poisoning", level: "emergency", reason: "Overdose or poisoning needs emergency care.",
    any: ["overdose", "poisoned", "swallowed poison", "swallowed bleach"] },
  // SCRUM-281: emergency warning signs the rules were missing. Found by auditing the rules against
  // the emergencies the AI is expected to catch (tests/redFlagAudit.test.js). Before this, every one
  // of these was classified "routine" when the AI was off, unreachable or rejected by the guardrails.
  { id: "gi-bleeding", level: "emergency", reason: "Black or tar-like stools, dark red or maroon blood in the stool, or vomit that looks like coffee grounds can be signs of bleeding in the stomach or gut.",
    any: ["black stool", "black stools", "tarry stool", "tarry stools", "black tarry", "black poo", "black poop", "dark red blood", "maroon stool", "maroon stools", "coffee grounds"] },
  { id: "confusion", level: "emergency", reason: "Sudden confusion can be a sign of a stroke, a serious infection or very low blood sugar.",
    any: ["sudden confusion", "suddenly confused", "very confused", "disoriented", "disorientated"] },
  { id: "vision-loss", level: "emergency", reason: "Sudden loss of vision can be a sign of a stroke or another eye emergency.",
    any: ["sudden loss of vision", "lost my vision", "lost vision", "lost my sight", "lost sight", "went blind", "gone blind", "sudden blindness", "suddenly blind", "suddenly can't see"] },
  { id: "sepsis", level: "emergency", reason: "Mottled, blue or very pale skin while feeling very unwell can be a sign of sepsis, a life-threatening reaction to an infection.",
    any: ["sepsis", "septic", "mottled"] },
  // SCRUM-282: notLongAgo: "headaches since my car accident last year" is history, not an injury now.
  { id: "major-injury", level: "emergency", notLongAgo: true, reason: "A serious injury, such as a fall from a height, a road accident, a stab or gunshot wound, an electric shock or a severe burn, needs emergency care.",
    any: ["fell from a height", "fall from a height", "fell off a roof", "fell from the roof", "can't feel my legs", "cannot feel my legs", "can't move my legs", "cannot move my legs", "car accident", "car crash", "hit by a car", "motorcycle accident", "stabbed", "stab wound", "gunshot", "been shot", "was shot", "electric shock", "electrocuted", "severe burn", "serious burn", "chemical burn"] },
  { id: "testicle-sudden", level: "emergency", reason: "Sudden, severe pain in a testicle can mean it has twisted, which needs treatment within hours.",
    any: ["sudden testicle pain", "sudden testicular pain", "sudden pain in my testicle", "sudden severe pain in my testicle", "twisted testicle", "testicle is twisted"] },
  { id: "swallowed-object", level: "emergency", reason: "A swallowed button battery or magnets can cause serious damage inside the body within hours.",
    any: ["swallowed a battery", "swallowed a button battery", "swallowed batteries", "swallowed a magnet", "swallowed magnets"] },
  { id: "baby-not-moving", level: "emergency", reason: "A baby who has stopped moving or is moving much less than usual, during pregnancy or after birth, needs to be checked straight away.",
    any: ["baby stopped moving", "baby has stopped moving", "baby isn't moving", "baby is not moving", "baby is moving less", "baby moving less", "reduced fetal movements", "reduced foetal movements"] },

  // ---- Urgent ----
  { id: "high-fever", level: "urgent", reason: "A very high fever needs to be checked today.",
    any: ["high fever", "fever of 40", "fever of 39.5", "40 degrees", "104 degrees"] },
  { id: "severe-abdominal", level: "urgent", reason: "Severe abdominal pain should be checked today.",
    any: ["severe stomach pain", "severe abdominal pain", "severe belly pain", "sharp pain in my lower right"] },
  { id: "dehydration", level: "urgent", reason: "Not being able to keep fluids down can lead to dehydration.",
    any: ["can't keep anything down", "cannot keep fluids down", "can't keep water down", "no urine", "not peeing"] },
  { id: "injury", level: "urgent", notLongAgo: true, reason: "A possible broken bone, deep cut or head injury should be checked today.",
    any: ["broken bone", "bone is sticking out", "deep cut", "head injury", "hit my head", "can't move my", "cannot put weight"] },
  { id: "pregnancy", level: "urgent", reason: "Bleeding or pain during pregnancy should be checked today.",
    all: ["pregnant", "bleeding"] },
  // SCRUM-281: urgent warning signs the rules were missing.
  // Bloody stools are "urgent" (seen today), black or maroon stools are "emergency" (gi-bleeding
  // above): bright red blood is often from a small tear, dark blood can mean bleeding higher up.
  // A lot of blood is an emergency either way, through the "bleeding" rule.
  { id: "blood-in-stool", level: "urgent", reason: "Blood in the stool or bleeding from the bottom should be checked today.",
    any: ["blood in my stool", "blood in my stools", "blood in stool", "blood in the stool", "bloody stool", "bloody stools", "bloody poo", "bloody poop", "blood in my poo", "blood in my poop", "rectal bleeding", "bleeding from my bottom", "bleeding from the bottom", "bloody diarrhea", "bloody diarrhoea"] },
  // The many ways of saying "a baby under 3 months has a fever" are in everydayWording.js.
  { id: "young-infant-fever", level: "urgent", reason: "A fever in a baby younger than 3 months should be checked by a doctor today.",
    any: ["newborn with a fever", "newborn has a fever", "fever in a newborn", "fever in my newborn"] },
  { id: "urinary-retention", level: "urgent", reason: "Not being able to pee at all should be checked today.",
    any: ["can't pee", "cannot pee", "unable to pee", "can't urinate", "cannot urinate", "unable to urinate"] },
  { id: "eye-urgent", level: "urgent", reason: "Severe eye pain, an eye injury or a chemical in the eye should be checked today.",
    any: ["severe eye pain", "severe pain in my eye", "eye injury", "injured my eye", "chemical in my eye", "chemicals in my eye"] },
  { id: "testicle-pain", level: "urgent", reason: "Pain or swelling in a testicle should be checked today.",
    any: ["testicle pain", "testicular pain", "pain in my testicle", "pain in my testicles", "swollen testicle", "swollen testicles"] },

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
  { id: "blood-in-urine", level: "soon", reason: "Blood in the urine should be checked by a doctor.",
    any: ["blood in my urine", "blood in urine", "blood in my pee", "peeing blood", "bloody urine", "red urine"] },

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
    const around = `${before} ${after}`;
    // SCRUM-281: "just had" is happening now, and "died of" is family history.
    const historical = /\b((?<!just )had|years ago|last year|in the past|previously|history of|recovered from|died of|died from|passed away)\b/.test(around);
    const otherPerson = /\b(my|his|her|their)\s+(father|mother|dad|mom|mum|parent|grandfather|grandmother|brother|sister|friend|uncle|aunt|child|son|daughter)\b/.test(before);
    // SCRUM-281 audit fix: a family member's name used to cancel the red flag every time, so a
    // caregiver writing "I think my mother is having a stroke" was told "routine". A family member
    // now only cancels it when nothing says it is happening now (family history is caught above).
    const happeningNow = /\b(is|are|am|having|just had|might be|may be|could be|seems to be|right now|now|currently)\b/.test(around);
    if (!isNegatedAt(text, index) && !historical && (!otherPerson || happeningNow)) return true;
    from = index + phrase.length;
  }
}

// SCRUM-282: an injury the person says happened long ago ("since my car accident last year", "my head
// injury from 2 years ago") is history, not something happening now. Only weeks or more count as long
// ago: "a car accident last night" or "this morning" still counts. Checked within the phrase's own clause
// (between full stops, commas and the like), so another sentence's "last year" changes nothing.
const LONG_AGO = /\b(?:(?:years?|months?|weeks?) ago|last (?:year|month|week)|in the past|history of|recovered from|used to)\b/;

function isLongAgoAt(text, index, length) {
  const start = text.lastIndexOf(".", index) + 1;
  const end = text.indexOf(".", index + length);
  return LONG_AGO.test(text.slice(start, end === -1 ? undefined : end));
}

// Like mentions(), but each place the phrase (or everyday wording for it) appears must not be long ago.
function mentionsRecent(text, phrase, understood) {
  const recentAt = (said) => {
    const isLetter = (char) => /[a-z0-9]/.test(char || "");
    for (let from = 0, index; (index = text.indexOf(said, from)) !== -1; from = index + 1) {
      if (isLetter(text[index - 1]) || isLetter(text[index + said.length])) continue;
      if (!isNegatedAt(text, index) && !isLongAgoAt(text, index, said.length)) return true;
    }
    return false;
  };
  if (containsPositive(text, phrase) && recentAt(phrase)) return true;
  return understood.some((item) => item.means === phrase && recentAt(item.said));
}

function ruleMatches(text, rule, understood = []) {
  if (rule.currentEmergency) return rule.any.some((phrase) => containsCurrentEmergency(text, phrase));
  if (rule.notLongAgo) return rule.any.some((phrase) => mentionsRecent(text, phrase, understood));
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

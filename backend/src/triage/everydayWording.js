// SCRUM-125 (backlog #24): "As a user, I want to describe my symptoms in natural language, by text
// or voice, so that the AI understands my situation."
//
// People don't describe symptoms the way the rules in urgency.js are written. They say "my chest
// hurts", not "chest pain"; "I can't catch my breath", not "can't breathe". Before this list, the
// rules missed those and called them routine, even for emergencies.
//
// Each entry maps everyday wording to ONE phrase the rules already know ("means"). The rules then
// treat it exactly as if the user had written that phrase. The patterns run on the normalised text
// (lowercase, contractions with apostrophes, punctuation turned into clause breaks), and a match is
// ignored when it is negated ("not bleeding a lot"), using the same negation check as the rules.
//
// Rules for adding entries:
//   - "means" must be a phrase that appears in a rule in urgency.js (a test checks this).
//   - Patterns must describe the symptom itself, not a history or a worry ("my dad had a heart
//     attack" must not mean chest pain), so they stay specific.
//   - When in doubt between two meanings, map to the more serious one: over-triage is safer than
//     missing an emergency.
//   - Add a test sentence in tests/naturalLanguage.test.js for every new pattern.

const PERSON = "(?:my|his|her|their|the|our)";

const EVERYDAY_WORDING = [
  // ---------- Emergency ----------
  { means: "chest pain", patterns: [
    /\bchest (?:hurts?|is hurting|hurting|aches?|is aching|aching|is sore|feels tight|is tight|is (?:really |very )?painful|is killing me)\b/,
    new RegExp(`\\b(?:pain|ache|aching|pressure|tightness|squeezing) (?:in|on|across) ${PERSON} chest\\b`),
    /\b(?:feels? like|like) (?:an? )?(?:elephant|weight|something heavy) (?:is )?(?:sitting |standing )?on (?:my|his|her) chest\b/,
  ] },
  { means: "can't breathe", patterns: [
    new RegExp(`\\b(?:can't|cannot|couldn't) (?:catch ${PERSON} breath|get (?:enough )?air|breathe properly|breathe well)\\b`),
    /\b(?:hard|difficult|struggling|a struggle) (?:time )?(?:to )?(?:breathe|breathing)\b/,
    /\b(?:hard|difficult) time breathing\b/,
    /\bstruggling for (?:air|breath)\b/,
    /\b(?:breathing|breathe) is (?:really |very )?(?:hard|difficult)\b/,
  ] },
  { means: "unconscious", patterns: [
    /\b(?:collapsed|blacked out|fell unconscious|not responding|isn't responding|won't respond|is not breathing|isn't breathing|stopped breathing)\b/,
    /\b(?:can't|cannot) wake (?:him|her|them) up\b/,
  ] },
  { means: "seizure", patterns: [
    /\b(?:having|had|has) (?:a )?fits?\b/,
    /\b(?:shaking|jerking) (?:uncontrollably|all over)\b/,
  ] },
  { means: "slurred speech", patterns: [
    /\b(?:can't|cannot|couldn't) (?:talk|speak) (?:properly|clearly|right|normally)\b/,
    /\b(?:speech|words?) (?:is|are|sounds?) (?:slurred|jumbled|garbled)\b/,
    /\bslurring\b/,
  ] },
  { means: "face drooping", patterns: [
    new RegExp(`\\b${PERSON} face (?:is |looks |went )?(?:droopy|lopsided|crooked)\\b`),
    new RegExp(`\\b(?:one side of|side of) ${PERSON} (?:face|mouth) (?:is |went |has )?(?:drooping|droopy|dropped|numb|weak)\\b`),
  ] },
  { means: "sudden numbness", patterns: [
    /\bnumb on one side\b/,
    new RegExp(`\\b${PERSON} face (?:feels |is |went )?numb\\b`),
  ] },
  { means: "bleeding heavily", patterns: [
    /\bbleeding (?:a lot|so much|badly|really badly|nonstop|non stop|everywhere)\b/,
    /\b(?:lots|a lot|so much) of blood\b/,
    /\bblood (?:won't|will not|doesn't|does not) stop\b/,
  ] },
  { means: "want to die", patterns: [
    /\b(?:don't|do not) want to (?:live|be alive|be here anymore)\b/,
    /\b(?:end it all|end my life|take my (?:own )?life|no reason to live|better off dead)\b/,
    // Not "I hurt myself" alone: that is usually an injury ("I hurt myself playing football").
    /\b(?:want to|going to|thinking (?:about|of)) (?:hurt|hurting|harm|harming|kill|killing) myself\b/,
  ] },
  { means: "throat is closing", patterns: [
    /\bthroat (?:feels (?:like (?:it's|its|it is) )?|is )?(?:closing|tightening|closing up)\b/,
  ] },
  { means: "swollen lips", patterns: [
    /\blips (?:are |have |look )?(?:swelling|swollen|puffed up|blown up)\b/,
  ] },
  { means: "blue lips", patterns: [
    // Only a person, face, lips or skin going blue: never "my bruise turned blue".
    /\b(?:lips|face|skin|fingers|fingertips|baby|he|she|he's|she's) (?:are |is )?(?:turning|turned|went|going|look|looks|is|are) (?:a bit |a little )?blue\b/,
  ] },
  { means: "overdose", patterns: [
    /\b(?:took|swallowed|taken) (?:too many|a lot of|lots of|a whole (?:bottle|pack|box) of) (?:pills|tablets|medicine|meds)\b/,
  ] },

  // ---------- Urgent ----------
  { means: "high fever", patterns: [
    /\b(?:temperature|temp|fever)(?: is| of| was| reached| hit)? (?:about |around |over )?(?:39\.[5-9]|4[0-2](?:\.\d)?|10[3-6](?:\.\d)?)\b/,
    /\b(?:39\.[5-9]|4[0-2](?:\.\d)?) ?(?:degrees|c)\b/,
  ] },
  { means: "severe stomach pain", patterns: [
    // The intensifier is required, so "stomach pain much better" does not count.
    /\b(?:stomach|belly|tummy|abdomen|abdominal) (?:hurts?|pain|ache|is hurting) (?:so much|so bad|so badly|really bad|really badly|very bad|very badly|a lot)\b/,
    /\b(?:stomach|belly|tummy|abdomen) is killing me\b/,
    /\b(?:stomach|belly|tummy|abdomen) (?:hurts?|pain|ache|is hurting)(?: so much)? (?:that )?i (?:can't|cannot) (?:stand|move|walk|sleep)\b/,
    /\b(?:terrible|unbearable|excruciating|worst|really bad|very bad|agonising|agonizing) (?:stomach|belly|tummy|abdominal) (?:pain|ache)\b/,
    /\b(?:stomach|belly|tummy|abdomen) is (?:hard|rigid|swollen)\b/,
  ] },
  { means: "can't keep anything down", patterns: [
    /\b(?:throwing up|vomiting|puking|bringing up) (?:everything|all (?:the )?(?:water|fluids|food))\b/,
    /\b(?:can't|cannot) (?:keep|hold) (?:any )?(?:water|fluids|food|drinks) down\b/,
  ] },
  { means: "broken bone", patterns: [
    new RegExp(`\\b(?:broke|broken|fractured|cracked) ${PERSON} (?:arm|leg|wrist|ankle|finger|toe|hand|foot|nose|rib|ribs|collarbone|hip|elbow|knee|shoulder)\\b`),
    new RegExp(`\\b${PERSON} (?:arm|leg|wrist|ankle|finger|toe|hand|foot|nose|rib|collarbone|hip) (?:is|looks|might be|may be) (?:broken|fractured|bent the wrong way)\\b`),
  ] },
  { means: "hit my head", patterns: [
    new RegExp(`\\b(?:banged|bumped|hit|knocked|smashed|cracked) ${PERSON} head\\b`),
    new RegExp(`\\b(?:fell|landed) on ${PERSON} head\\b`),
  ] },

  // ---------- See a doctor soon ----------
  { means: "fever", patterns: [
    /\b(?:burning up|feverish|running a temperature|got a temperature|hot and cold|chills|shivering)\b/,
  ] },
  { means: "vomiting", patterns: [
    /\b(?:threw up|puked|puking|been sick|being sick|keep being sick|vomited)\b/,
  ] },
  { means: "ear pain", patterns: [
    new RegExp(`\\b(?:${PERSON} )?ears? (?:hurts?|is hurting|are hurting|aches?|is aching|is killing me)\\b`),
  ] },
  { means: "burning when i pee", patterns: [
    /\b(?:burns?|stings?|hurts?|it's painful|painful) (?:to|when i|when i'm|when he|when she) (?:pee|wee|urinate|peeing|urinating)\b/,
    /\bpainful (?:peeing|urination|to pee)\b/,
  ] },
  { means: "for weeks", patterns: [
    /\bfor (?:\d+|two|three|four|five|six|several|a few|a couple of|a couple) (?:weeks|months)\b/,
    /\bfor (?:over |more than )?a (?:month|fortnight)\b/,
  ] },
  { means: "for several days", patterns: [
    /\bfor (?:[4-9]|1[0-3]|four|five|six|seven|eight|nine|ten) days\b/,
  ] },

  // ---------- Routine ----------
  { means: "runny nose", patterns: [
    /\b(?:stuffy|blocked|congested|stuffed up|bunged up) nose\b/,
    /\bnose is (?:running|blocked|stuffy|congested)\b/,
  ] },
  { means: "sore throat", patterns: [
    /\bthroat (?:is )?(?:a bit |a little |really |very |kind of )?(?:sore|scratchy|hurts|hurting|itchy|raw)\b/,
  ] },
];

module.exports = { EVERYDAY_WORDING };

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
  // SCRUM-281: everyday wording for the warning signs added to urgency.js.
  { means: "black stool", patterns: [
    // "my poop is black", "stool was black and sticky", "my stools have been jet black"
    /\b(?:stool|stools|poo|poop|bowel movements?|feces|faeces)(?: is| are| was| were| looks?| looked| has been| have been| turned| seems?| came out)(?: (?:very|really|all|completely|jet|pitch|kind of|like))? (?:black|tarry|tar like|maroon|dark red)\b/,
    // "maroon coloured stool", "black looking poop"
    /\b(?:black|tarry|maroon|dark red)(?: colou?red| looking| and sticky)? (?:stool|stools|poo|poop|bowel movements?)\b/,
    /\b(?:pooping|passing|pooped|passed) (?:black|tar|maroon)\b/,
  ] },
  { means: "coffee grounds", patterns: [
    /\bcoffee ground(?: like)? (?:vomit|sick)\b/,
  ] },
  { means: "suddenly confused", patterns: [
    // "is confused", "seems very confused", but not "confused about the dose" or "not confused".
    /\b(?:is|am|i'm|he's|she's|seems?|seemed|became|become|becoming|got|getting|looks?|looked|went) (?:suddenly |very |really |so |all |completely )?confused\b(?! (?:about|by|with|on|why|how|what|whether|if|over))/,
    /\b(?:talking|speaking) nonsense\b/,
  ] },
  { means: "disoriented", patterns: [
    /\b(?:doesn't|does not|didn't|did not|don't|do not) (?:know|recognise|recognize) where (?:he|she|they|i) (?:is|are|am|was|were)\b/,
  ] },
  { means: "lost vision", patterns: [
    /\b(?:lost|losing|suddenly lost) (?:all |the |my |his |her )?(?:vision|sight)\b/,
    /\b(?:can't|cannot) see (?:anything )?(?:out of|from|with) (?:my|his|her|one) (?:left |right )?eye\b/,
  ] },
  { means: "mottled", patterns: [
    /\bskin (?:is |looks |looking |has gone |went |turned )?(?:mottled|grey|gray|ashen)\b/,
  ] },
  { means: "can't feel my legs", patterns: [
    new RegExp(`\\b(?:can't|cannot) (?:feel|move) ${PERSON} (?:legs|arms|body)\\b`),
  ] },
  { means: "fell from a height", patterns: [
    /\b(?:fell|fallen|falling) (?:off|from|down) (?:a |the )?(?:roof|ladder|balcony|building|height|scaffolding|tree|second floor|third floor)\b/,
  ] },
  { means: "car accident", patterns: [
    /\b(?:car|road|traffic|motorbike|motorcycle) (?:accident|crash|collision)\b/,
    /\bhit by (?:a |an )?(?:car|truck|bus|van|motorbike|motorcycle|vehicle)\b/,
  ] },
  { means: "severe burn", patterns: [
    /\b(?:badly|seriously|severely) burn(?:ed|t)\b/,
    /\b(?:big|large|deep) burns?\b/,
  ] },
  { means: "swallowed a battery", patterns: [
    /\b(?:swallowed|ate|eaten) (?:a |an |some |the |two |2 )?(?:button |coin |watch |small )?(?:battery|batteries|magnet|magnets)\b/,
  ] },
  { means: "baby stopped moving", patterns: [
    /\bbaby (?:hasn't|has not|isn't|is not|stopped|has stopped)(?: been)? (?:moved|moving|kicking|kicked)\b/,
    /\b(?:haven't|have not|not) felt (?:the |my )?baby (?:move|moving|kick|kicking)\b/,
    /\bbaby (?:is )?(?:moving|kicking) (?:a lot |much )?less\b/,
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
  // SCRUM-281
  { means: "blood in stool", patterns: [
    /\bblood (?:in|on|with) (?:my |the |his |her )?(?:stool|stools|poo|poop|bowel movements?|toilet paper|feces|faeces)\b/,
    /\b(?:blood|bleeding) when (?:i|he|she) (?:poop|poo|go to the toilet|have a bowel movement|wipe)\b/,
    /\b(?:pooping|passing|pooped|passed) (?:some |bright red |red )?blood\b/,
  ] },
  { means: "newborn with a fever", patterns: [
    // "my 2 month old has a fever", "a newborn baby with a temperature", "our 6 week old girl is running a fever"
    /\b(?:newborn|new born|(?:\d|1[0-2]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (?:day|days|week|weeks) old|(?:1|2|one|two) months? old)(?: baby| son| daughter| boy| girl)? (?:has|with|got|is running|running|developed|had)(?: got)? (?:a |an )?(?:high |slight |little |bit of a )?(?:fever|temperature)\b/,
    /\b(?:fever|temperature) in (?:my |our |a |the )?(?:newborn|new born|(?:\d|1[0-2]|one|two|three|four) weeks? old|(?:1|2|one|two) months? old)\b/,
  ] },
  { means: "can't pee", patterns: [
    /\b(?:can't|cannot|haven't been able to|have not been able to|hasn't been able to|has not been able to|not able to|unable to) (?:pee|wee|urinate|pass urine|pass water)\b/,
  ] },
  { means: "severe eye pain", patterns: [
    /\b(?:eye|eyes) (?:hurts?|is hurting|are hurting|pain) (?:so much|so bad|really bad|really badly|a lot|badly)\b/,
  ] },
  { means: "chemical in my eye", patterns: [
    new RegExp(`\\b(?:got|splashed|sprayed) (?:some )?(?:bleach|chemicals?|acid|cleaner|cleaning product) (?:in|into) ${PERSON} eyes?\\b`),
  ] },
  { means: "testicle pain", patterns: [
    /\b(?:testicle|testicles|testis) (?:hurts?|is hurting|are hurting|aches?|is swollen|are swollen|is painful|are painful)\b/,
    /\bmy balls (?:hurt|are hurting|are swollen|ache)\b/,
  ] },
  { means: "sudden testicle pain", patterns: [
    /\bsudden(?:ly)? (?:severe |sharp |bad |really bad )?(?:pain|ache) in (?:my|his|one) (?:testicle|testicles|balls)\b/,
  ] },

  // ---------- See a doctor soon ----------
  { means: "fever", patterns: [
    /\b(?:burning up|feverish|running a temperature|got a temperature|hot and cold|chills|shivering)\b/,
  ] },
  { means: "vomiting", patterns: [
    /\b(?:threw up|puked|puking|been sick|being sick|keep being sick|vomited)\b/,
  ] },
  // SCRUM-281
  { means: "blood in urine", patterns: [
    /\bblood (?:in|with) (?:my |the |his |her )?(?:urine|pee|wee)\b/,
    /\b(?:urine|pee|wee) (?:is|looks|was|has been|turned) (?:red|pink|bloody)\b/,
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

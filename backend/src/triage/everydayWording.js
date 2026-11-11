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

// SCRUM-282: a fever in a young baby, used after an age ("7 weeks old ... temperature is 38.3"): the word
// fever, "a/high temperature", or a measured temperature of 38-42°C or 100.4-106°F. Not after "no", "not"
// or "without", so "my 6 week old has no fever" doesn't count.
const INFANT_FEVER = "(?<!\\b(?:no|not|not a|without|without a) )\\b(?:fever|feverish|(?:a|high) (?:temperature|temp)|(?:temperature|temp)(?: is| of| was| reached| hit| at)? (?:about |around |over )?(?:3[89]|4[0-2]|100\\.[4-9]|10[1-6])(?:\\.\\d+)?)\\b";

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
    // SCRUM-282: "her skin looks blotchy and bluish" (sepsis). "Blotchy" alone is not enough, it is
    // often a harmless rash; it only counts here when the skin is also mottled, grey or bluish.
    /\bskin (?:is |looks |looking |has gone |went |turned )?(?:(?:a bit |a little |kind of )?(?:blotchy|pale|patchy) and )?(?:mottled|grey|gray|ashen|bluish|blueish)\b/,
  ] },
  // SCRUM-282: a stiff neck in everyday words ("I can't bend my neck"). The meningitis rule still needs
  // a fever too, so a stiff neck alone (after sleeping badly) stays as it was.
  { means: "stiff neck", patterns: [
    new RegExp(`\\b(?:can't|cannot|couldn't) (?:bend|move|turn|lower) ${PERSON} (?:neck|head)(?: forward| down| at all)?\\b`),
    /\bneck (?:is |feels |has gone |went )?(?:really |very |so )?(?:stiff|rigid)\b/,
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
    // SCRUM-282: "swallowed one of those small round batteries from the remote". Only words that describe
    // the battery can come between, so "swallowed my pills before charging the batteries" doesn't count.
    /\b(?:swallowed|ate|eaten)(?: (?:one|two|three|some|of|those|these|them|the|a|an|small|tiny|little|round|flat|shiny|silver|button|coin|watch|lithium|aa|aaa|\d+)){1,5} (?:battery|batteries|magnet|magnets)\b/,
  ] },
  { means: "baby stopped moving", patterns: [
    /\bbaby (?:hasn't|has not|isn't|is not|stopped|has stopped)(?: been)? (?:moved|moving|kicking|kicked)\b/,
    /\b(?:haven't|have not|not) felt (?:the |my )?baby (?:move|moving|kick|kicking)\b/,
    /\bbaby (?:is )?(?:moving|kicking) (?:a lot |much )?less\b/,
  ] },

  // ---------- SCRUM-309: emergency wording found missing by the clinical safety test set ----------
  // Each case is in tests/triage-safety/cases.json; each pattern has a sentence in tests/naturalLanguage.test.js.
  { means: "chest pain", patterns: [
    new RegExp(`\\b(?:pain|ache|aching|pressure|tightness|heaviness|squeezing) in the (?:middle|centre|center) of ${PERSON} chest\\b`),
    // "my chest has been really tight", "chest feels heavy". Heaviness is how many people, often women, describe a heart attack.
    /\bchest (?:has been|is|feels|felt|was|is getting|getting|keeps getting)(?: really| very| so| quite| a bit| kind of)? (?:tight|heavy|crushed|squeezed)\b/,
  ] },
  { means: "short of breath at rest", patterns: [
    /\b(?:out of breath|breathless|short of breath)\b[^.]{0,25}?\b(?:sitting|resting|lying down|at rest|doing nothing)\b/,
    /\b(?:can't|cannot|couldn't) (?:finish|complete) (?:a |my |his |her )?sentences?\b/,
  ] },
  { means: "struggling to breathe", patterns: [
    /\btoo (?:breathless|out of breath|short of breath|wheezy) to (?:talk|speak|eat|drink|walk)\b/,
    // A baby's chest pulling in under the ribs, or grunting while breathing (NICE NG143 red signs).
    /\b(?:skin|chest|tummy) (?:under|between|below) (?:her|his|the|their|my) ribs (?:is |are )?(?:sucking|pulling|caving|going) in\b/,
    /\bribs (?:are |is )?(?:sucking|pulling|caving) in\b/,
    /\bbreathing (?:really |very |so )?fast and grunting\b|\bgrunting (?:when|with|as|while) (?:she|he|they) breathes?\b/,
  ] },
  { means: "slurred speech", patterns: [
    /\b(?:speech|words?) (?:was|were|went|got|became|sounded|are coming out|is coming out|came out|keep coming out) (?:all |a bit |really )?(?:slurred|jumbled|garbled|wrong|mixed up|muddled)\b/,
  ] },
  { means: "sudden numbness", patterns: [
    /\bsuddenly (?:went|gone|go|became|feels?|felt) (?:numb|weak|limp|dead)\b|\b(?:went|gone) (?:numb|weak|limp) suddenly\b/,
  ] },
  { means: "arm weakness", patterns: [
    /\b(?:arm|hand|leg) (?:went|has gone|suddenly went) (?:weak|limp|floppy)\b/,
  ] },
  { means: "not waking up", patterns: [
    /\b(?:isn't|wasn't|aren't|still isn't) waking up\b/,
  ] },
  { means: "unconscious", patterns: [
    /\b(?:was|got|been|is|being) knocked out\b|\bknocked (?:him|her|them|me|himself|herself|myself) out\b/,
  ] },
  { means: "unresponsive", patterns: [
    // A floppy baby or child: not responding normally (NICE NG143 red sign).
    /\b(?:is|was|seems?|looks?|gone|went|very|really|so|all) (?:very |really |so |all )?floppy\b/,
  ] },
  { means: "fell from a height", patterns: [
    // More than 5 stairs is a "call an ambulance" head-injury sign; a whole staircase counts.
    /\bfell down (?:the |a )?(?:whole |entire |full )?(?:flight of stairs|stairs|staircase)\b/,
  ] },
  { means: "suddenly confused", patterns: [
    // "now hes confused": typed without the apostrophe. Not "confused about the dose".
    /\b(?:hes|shes|theyre|they're|now) (?:suddenly |very |really |so |all |completely )?confused\b(?! (?:about|by|with|on|why|how|what|whether|if|over))/,
  ] },
  { means: "vomiting blood", patterns: [
    /\b(?:threw up|throw up|throwing up|vomited|puked|brought up|bringing up|sick with) (?:some |a lot of |lots of |bright red |red |dark )?blood\b/,
    new RegExp(`\\bblood in ${PERSON} (?:vomit|sick)\\b`),
  ] },
  { means: "swollen tongue", patterns: [
    /\btongue (?:is |feels |looks |is getting )?(?:swollen|swelling|swelling up|thick)\b/,
  ] },
  { means: "severe allergic reaction", patterns: [
    // The face swelling up (now, not "a swollen face"), as after a sting or a food.
    /\bface (?:is |has |started |starting |keeps )?(?:swelling|puffing)(?: up)?\b|\bface (?:has )?(?:swelled|puffed) up\b/,
  ] },
  { means: "non blanching rash", patterns: [
    // The glass test: "spots that don't fade when I press a glass on them". Only with pressing or a glass,
    // so "a rash that doesn't fade after a week" doesn't count.
    /\b(?:rash|spots|marks|dots|blotches)\b[^.]{0,30}?\b(?:don't|doesn't|do not|does not|won't|didn't|did not) fade\b[^.]{0,40}?\b(?:press|pressed|pressing|glass|tumbler)\b/,
  ] },
  { means: "want to die", patterns: [
    /\b(?:wants|wanted|wanting) to die\b/,
    /\b(?:kill|end) (?:himself|herself|themselves|his life|her life|their life|his own life|her own life)\b/,
    /\b(?:wants|wanted|wanting|going|thinking about|thinking of|talking about) (?:to )?(?:hurt|harm|kill)(?:ing)? (?:himself|herself|themselves)\b/,
  ] },
  { means: "overdose", patterns: [
    /\b(?:took|swallowed|taken|has taken|had) (?:a |the )?(?:whole|full|entire) (?:pack|packet|box|bottle|strip|sheet) of\b/,
    /\b(?:took|taken|swallowed) (?:too many|loads of|a handful of|handfuls of) (?:\w+ )?(?:pills|tablets|paracetamol|panadol|painkillers|capsules)\b/,
  ] },
  { means: "swallowed poison", patterns: [
    /\b(?:drank|drunk|drinking|swallowed|ate|eaten) (?:some |a bit of |a little |a lot of |the )?(?:bleach|detergent|oven cleaner|drain cleaner|toilet cleaner|cleaning (?:liquid|product|spray)|washing (?:powder|liquid|pods?)|laundry (?:pods?|liquid|detergent)|dishwasher (?:liquid|tablets?|pods?)|chlorine|kerosene|petrol|gasoline|antifreeze|rat poison|pesticide|weed killer|paint thinner|lamp oil|nail polish remover)\b/,
  ] },
  { means: "mottled", patterns: [
    // A child or adult who feels abnormally cold to touch (Sepsis Trust sign).
    /\b(?:feels?|is|felt) (?:very |really |abnormally |unusually |ice )?cold to (?:the )?touch\b/,
  ] },
  { means: "severe burn", patterns: [
    /\b(?:boiling|scalding) (?:water|oil|soup|milk)\b[^.]{0,20}?\bover (?:himself|herself|themselves|myself|him|her|them|me)\b/,
    /\b(?:burn|burns|burned|burnt|scald|scalds|scalded)\b[^.]{0,60}?\bskin (?:is )?(?:peeling|coming off|came off|falling off)\b/,
  ] },
  { means: "saddle numbness", patterns: [
    new RegExp(`\\bnumb(?:ness)?\\b(?: \\w+){0,2}? (?:around|in|between|on) ${PERSON} (?:bottom|bum|butt|buttocks|genitals|groin|inner thighs|back passage|private parts|legs)\\b`),
    // Back pain, then losing control of the bladder or bowels.
    new RegExp(`\\b(?:back pain|pain in ${PERSON} (?:lower )?back|sciatica)\\b[^]{0,120}?\\b(?:can't|cannot|couldn't|unable to|lost|losing) (?:control|feel)(?: of| over| when)? (?:i |he |she )?(?:my |his |her )?(?:pee|wee|bladder|bowels?|poo|poop|peeing|weeing|urine)\\b`),
  ] },
  { means: "shoulder tip pain", patterns: [
    new RegExp(`\\b(?:pain|ache|aching|hurts?|hurting)\\b[^.]{0,20}?\\b(?:tip|top) of ${PERSON} shoulder\\b`),
    /\bshoulder[- ]tip\b/,
  ] },
  { means: "sudden testicle pain", patterns: [
    /\bsudden(?:ly)? (?:\w+ ){0,2}(?:pain|ache) in (?:my|his|one|the) (?:left |right )?(?:testicle|testicles|balls)\b/,
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
    // SCRUM-282: "really bad pain in the lower right side of my belly". Same intensifiers as above.
    /\b(?:terrible|unbearable|excruciating|worst|really bad|very bad|agonising|agonizing|severe) pain in (?:the |my )?(?:lower |upper )?(?:right |left )?(?:side (?:of )?)?(?:my |his |her |the )?(?:stomach|belly|tummy|abdomen)\b/,
  ] },
  { means: "can't keep anything down", patterns: [
    /\b(?:throwing up|vomiting|puking|bringing up) (?:everything|all (?:the )?(?:water|fluids|food))\b/,
    // SCRUM-282: "even" added: "I can't keep even water down".
    /\b(?:can't|cannot) (?:keep|hold) (?:any |even )?(?:water|fluids|food|drinks) down\b/,
  ] },
  { means: "broken bone", patterns: [
    new RegExp(`\\b(?:broke|broken|fractured|cracked) ${PERSON} (?:arm|leg|wrist|ankle|finger|toe|hand|foot|nose|rib|ribs|collarbone|hip|elbow|knee|shoulder)\\b`),
    new RegExp(`\\b${PERSON} (?:arm|leg|wrist|ankle|finger|toe|hand|foot|nose|rib|collarbone|hip) (?:is|looks|might be|may be) (?:broken|fractured|bent the wrong way)\\b`),
    // SCRUM-282: "it's swollen and looks bent". Only "looks": "my toenail is deformed" is not an injury.
    /\b(?:looks|looking) (?:bent|deformed|misshapen|out of shape)\b|\bat (?:a|an) (?:weird|strange|odd|funny) angle\b/,
  ] },
  // SCRUM-282: "cut my hand on broken glass, it's deep", "I can see something white inside".
  // Nothing in between may say "not": "the cut isn't very deep" doesn't count.
  { means: "deep cut", patterns: [
    /\b(?:cut|cuts|wound|gash)\b(?:(?!\bnot\b|n't\b|\bno\b)[^]){0,40}?\b(?:it's|it is|its|is|looks|very|really|quite|pretty|so) deep\b/,
    /\b(?:can|could) see (?:the |my |his |her )?(?:bone|tendon|fat|something white inside)\b/,
    /\bgaping\b/,
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
    // SCRUM-282: the age and the fever in different parts of the sentence: "my baby is 7 weeks old and her
    // temperature is 38.3". A measured temperature only counts from 38°C (100.4°F), the fever threshold for
    // babies this age, and "no fever" or "not a fever" does not count.
    new RegExp(`\\b(?:newborn|new born|(?:\\d|1[0-2]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (?:day|days|week|weeks) old|(?:1|2|one|two) months? old)\\b[^]{0,60}?${INFANT_FEVER}`),
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
    // SCRUM-282: "left" or "right" allowed: "sudden really bad pain in my left testicle".
    /\bsudden(?:ly)? (?:severe |sharp |bad |really bad )?(?:pain|ache) in (?:my|his|one) (?:left |right )?(?:testicle|testicles|balls)\b/,
  ] },

  // ---------- SCRUM-309: urgent wording found missing by the clinical safety test set ----------
  { means: "sharp pain in my lower right", patterns: [
    // Appendicitis: pain that starts in the middle and moves to the lower right.
    /\b(?:moved|spread|went|shifted|moving|spreading) (?:down )?to (?:the |my )?(?:lower|bottom) right\b/,
  ] },
  { means: "no urine", patterns: [
    /\b(?:hasn't|has not|haven't|have not|no) (?:had |done |been )?(?:a |any )?wet (?:nappy|nappies|diaper|diapers)\b/,
    /\b(?:nappy|nappies|diaper|diapers) (?:has been |have been |is |are )?(?:dry|bone dry)\b/,
    /\b(?:hasn't|has not|haven't|have not) (?:peed|weed|urinated|passed urine)\b/,
  ] },
  { means: "cannot put weight", patterns: [
    /\b(?:can't|cannot|couldn't|unable to) (?:put|bear|take) (?:any |much )?weight\b/,
    /\b(?:can't|cannot|couldn't|unable to) (?:walk|stand) on (?:it|my \w+|his \w+|her \w+)\b/,
  ] },
  { means: "chemical in my eye", patterns: [
    new RegExp(`\\b(?:got|splashed|sprayed|spilled|squirted) (?:some )?(?:oven cleaner|drain cleaner|toilet cleaner|cleaning (?:spray|liquid)|detergent|dishwasher \\w+|chlorine|ammonia|lime|cement|pepper spray|washing up liquid|nail polish remover|hair dye|superglue|glue) (?:in|into) ${PERSON} eyes?\\b`),
  ] },
  { means: "bleeding", patterns: [
    // Only used by the pregnancy rule (pregnant + bleeding).
    /\bspotting\b/,
  ] },
  { means: "testicle pain", patterns: [
    /\b(?:testicle|testicles|testis|balls?) (?:has been|have been|is|are|feels?|got|getting) (?:\w+ )?(?:swollen|sore|painful|hurting|tender|aching)\b/,
    new RegExp(`\\b(?:ache|aching|pain|soreness) in ${PERSON} (?:left |right )?(?:testicle|testicles|balls)\\b`),
  ] },
  { means: "pain on one side", patterns: [
    /\bpain (?:low |low down |down low )?on one side\b/,
    /\b(?:sharp|sudden|bad|severe|stabbing) pain (?:low |low down )?(?:in|on) (?:my |the )?(?:lower )?(?:left|right) side\b/,
  ] },
  { means: "preeclampsia warning sign", patterns: [
    /\b(?:blurry|blurred|blurring) vision\b|\b(?:vision|eyesight) (?:is |has gone |went |is getting )?(?:blurry|blurred)\b/,
    /\bseeing (?:flashing lights|flashes|spots|stars)\b|\bflashing lights\b/,
    /\b(?:face|hands|feet|ankles)(?: and (?:my |his |her )?(?:face|hands|feet|ankles))? (?:have |has |are |is )?suddenly (?:swelled|swollen|swelling|puffed)(?: up)?\b|\bsudden swelling\b/,
    /\bheadache (?:that|which) (?:painkillers|paracetamol|panadol|tablets) (?:don't|doesn't|won't|do not|does not|didn't) (?:help|touch|shift|work)\b/,
    new RegExp(`\\bpain (?:just )?(?:below|under) ${PERSON} ribs\\b`),
  ] },
  { means: "flank pain", patterns: [
    new RegExp(`\\bpain in ${PERSON} (?:lower )?back on (?:the |one )?(?:left |right )?side\\b`),
    /\b(?:left|right)[- ]sided? (?:lower )?back pain\b/,
    new RegExp(`\\bpain in ${PERSON} (?:left |right )?(?:side|flank|kidney|kidneys)\\b`),
    /\b(?:flank|kidney) pain\b|\b(?:kidney|kidneys|flank) (?:hurts?|is hurting|aches?)\b/,
  ] },
  { means: "inhaler isn't helping", patterns: [
    /\binhaler (?:every|each) (?:1|2|3|one|two|three|couple of|few) hours?\b/,
    /\b(?:blue |reliever )?inhaler (?:isn't|is not|not|doesn't|does not|hasn't|has not) (?:helping|working|help|work)\b/,
  ] },
  { means: "breathless", patterns: [
    /\b(?:short of breath|out of breath|shortness of breath)\b/,
  ] },
  { means: "fever", patterns: [
    // A measured temperature of 38-42°C: "temp is 39".
    /\b(?:temperature|temp)(?: is| of| was| reached| hit| at| around)? (?:about |around |over |nearly )?(?:3[89]|4[0-2])(?:\.\d+)?\b/,
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
    // SCRUM-282: "has been hurting" added: "my ear has been hurting since yesterday".
    new RegExp(`\\b(?:${PERSON} )?ears? (?:hurts?|is hurting|are hurting|(?:has|have) been (?:hurting|aching|sore)|aches?|is aching|is killing me)\\b`),
  ] },
  { means: "burning when i pee", patterns: [
    /\b(?:burns?|stings?|hurts?|it's painful|painful) (?:to|when i|when i'm|when he|when she) (?:pee|wee|urinate|peeing|urinating)\b/,
    /\bpainful (?:peeing|urination|to pee)\b/,
  ] },
  { means: "for weeks", patterns: [
    /\bfor (?:\d+|two|three|four|five|six|several|a few|a couple of|a couple) (?:weeks|months)\b/,
    /\bfor (?:over |more than )?a (?:month|fortnight)\b/,
    // SCRUM-282: longer than weeks counts too: "for months", "for over a year", "since my accident last year".
    /\bfor (?:over |more than )?(?:months|years|a year)\b/,
    /\bsince (?:[a-z']+ ){0,3}?(?:last (?:year|month)|(?:a|one|two|three|several|a few|\d+) (?:years?|months?) ago)\b/,
  ] },
  // SCRUM-282: "sore throat for over a week now", "it's been more than a week".
  { means: "for a week", patterns: [
    /\b(?:for )?(?:over|more than|longer than|at least|almost|nearly) a week\b/,
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

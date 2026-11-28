// SCRUM-126 (backlog #26): "As a user, I want the AI to ask relevant follow-up questions
// so that the urgency assessment is accurate."
//
// Builds on the SCRUM-128 classifier (urgency.js):
//   1. getFollowUpQuestions(description) picks the questions that fit what the user wrote.
//   2. refineUrgency(description, answers) re-runs the classifier and applies the answers.
//
// SCRUM-279: with the person's My health profile ("health", from healthContext.js readHealth()):
//   - the risk question asks only what My health doesn't already say, and isn't asked at all when My health
//     already shows a risk factor (a pregnancy, an age under 3 months or over 65, a long-term condition);
//   - those risk factors count exactly like answering "Yes" to it: one step more urgent, never past urgent.
//
// Safety rules:
//   - Emergencies get NO questions: the user is sent to care immediately, never slowed down.
//   - Answers can only RAISE the level, never lower it. A wrong or careless answer can then
//     only make the advice more cautious, never hide a red flag found in the description.
//   - The server always re-classifies from the description itself, so a client cannot send
//     a fake starting level.

const { classifyUrgency, LEVELS, normalise, containsPositive, findEverydayWording } = require("./urgency");
const { riskFactors, riskQuestionText } = require("./healthContext");

const MAX_SPECIFIC = 3; // symptom-specific questions asked at most
// The 4 general questions are added after specific questions except for a mood-only check, where they are not
// relevant. With the AI on, at most 3 rounds of one question each are asked (adaptiveFollowUps.js).

// Case-specific questions: each complaint ("topic") has its own small set, so "I am dizzy" and "my nail is bleeding"
// get different questions. A topic applies when the description matches it:
//   "rules" = classifier rule ids (urgency.js), "phrases" = words in the description (whole words, not negated, or
//   everyday wording that means them: everydayWording.js), "unless" = rule ids that make the topic pointless (the
//   description already says it, or the level is already set by a more specific rule), "unlessPhrases" = words that
//   belong to a more specific topic (a nosebleed is not a cut).
// The topics are checked in this order. When several apply, they take turns: each topic's first question, then each
// one's second, up to MAX_SPECIFIC, so every complaint described gets at least one question about it.
// Every question and answer here is the app's own, reviewed text: the AI may reword a selected non-emergency
// question, but its choices and urgency effects stay fixed (SCRUM-280).
// These are commonly published red flags and safety-netting questions, guidance not diagnosis, and need the same
// clinical review as the rules in urgency.js.
const TOPICS = {
  breathing: { phrases: ["short of breath", "shortness of breath", "breathless", "out of breath", "wheezing"], unless: ["breathing"] },
  headache: {
    phrases: ["headache", "headaches", "migraine", "head hurts", "head is hurting", "head ache", "head pain", "pain in my head", "head is pounding", "pounding head"],
    unless: ["worst-headache"],
  },
  rash: { rules: ["rash"] },
  fever: { rules: ["fever"], unless: ["high-fever"] },
  abdominal: { phrases: ["stomach pain", "abdominal pain", "belly pain", "stomach ache", "stomachache", "tummy pain", "stomach hurts"], unless: ["severe-abdominal"] },
  vomiting: { rules: ["vomiting"], unless: ["dehydration"] },
  "head-injury": { phrases: ["hit my head", "head injury", "bumped my head", "banged my head", "hit his head", "hit her head", "fell on my head", "concussion"], unless: ["major-injury"] },
  dizziness: {
    phrases: ["dizzy", "dizziness", "lightheaded", "light headed", "vertigo", "room is spinning", "room spinning", "head is spinning", "woozy", "unsteady", "off balance", "lose my balance", "losing my balance", "feel faint", "feeling faint"],
    unless: ["stroke", "suspected-stroke", "consciousness"],
  },
  palpitations: {
    phrases: ["palpitations", "heart racing", "heart is racing", "racing heart", "heart pounding", "heart is pounding", "pounding heart", "skipped beats", "skipping beats", "heart skipping", "irregular heartbeat", "heart fluttering", "fluttering in my chest"],
    unless: ["chest-pain", "suspected-heart-attack", "breathing", "consciousness"],
  },
  nosebleed: { phrases: ["nosebleed", "nose bleed", "nose bleeding", "nose is bleeding", "bleeding from my nose", "bleeding nose", "bloody nose"], unless: ["bleeding"] },
  wound: {
    phrases: ["bleeding", "bleeds", "bleed", "cut", "cuts", "cut my", "wound", "gash", "laceration", "scrape", "graze"],
    unless: ["bleeding", "gi-bleeding", "blood-in-stool", "blood-in-urine", "pregnancy", "major-injury"],
    unlessPhrases: ["nosebleed", "nose bleed", "nose bleeding", "nose is bleeding", "bleeding from my nose", "bleeding nose", "bleeding gums", "gums bleed", "gums are bleeding", "bleeding from my bottom", "period"],
  },
  burn: {
    phrases: ["burn", "burns", "burned", "burnt", "scald", "scalded"],
    unless: ["major-injury"],
    unlessPhrases: ["when i pee", "when i urinate", "urination", "urinating"],
  },
  sprain: {
    phrases: ["sprain", "sprained", "twisted my", "fell", "fell over", "fell down", "had a fall", "injured my", "hurt my", "rolled my ankle", "swollen ankle", "swollen wrist", "swollen knee"],
    unless: ["major-injury", "injury"],
  },
  allergy: { phrases: ["allergic", "allergy", "allergic reaction", "hives", "bee sting", "wasp sting", "stung", "insect bite", "bug bite"], unless: ["anaphylaxis"] },
  cough: { phrases: ["cough", "coughing", "chesty cough", "dry cough"], unless: ["breathing", "bleeding"] },
  throat: { phrases: ["sore throat", "throat hurts", "throat is sore", "throat pain", "painful to swallow", "hurts to swallow", "tonsillitis"], unless: ["anaphylaxis", "breathing"] },
  ear: { phrases: ["ear pain", "earache", "ear ache", "ear hurts", "ear infection", "blocked ear", "ringing in my ear", "can't hear"] },
  eye: {
    phrases: ["eye pain", "eye hurts", "eyes hurt", "red eye", "red eyes", "itchy eyes", "eye infection", "pink eye", "blurry vision", "blurred vision", "double vision", "seeing double", "something in my eye", "swollen eye"],
    unless: ["vision-loss", "eye-urgent", "stroke"],
  },
  urinary: {
    phrases: ["burning when i pee", "burning urination", "burns when i pee", "hurts when i pee", "pain when i pee", "painful urination", "peeing a lot", "uti", "urine infection", "bladder infection", "cystitis"],
    unless: ["urinary-retention", "kidney-infection"],
  },
  diarrhoea: { phrases: ["diarrhea", "diarrhoea", "loose stool", "loose stools", "runny stool", "runny poo"], unless: ["blood-in-stool", "gi-bleeding"] },
  "back-pain": { phrases: ["back pain", "back hurts", "back ache", "backache", "lower back", "pain in my back"], unless: ["cauda-equina"] },
  "leg-swelling": { phrases: ["calf pain", "pain in my calf", "calf hurts", "calf is swollen", "calf is painful", "calf is sore", "swollen leg", "leg is swollen", "swollen calf", "leg swelling", "one leg is swollen"] },
  tooth: { phrases: ["toothache", "tooth ache", "tooth pain", "tooth hurts", "teeth hurt", "gum pain", "swollen gum"] },
  mood: {
    phrases: [
      "anxious", "anxiety", "panic attack", "panic attacks", "depressed", "depression", "low mood", "feeling down",
      "hopeless", "can't cope", "stressed", "breakup", "break up", "broke up", "broken up", "relationship ended",
      "partner left me", "girlfriend left me", "boyfriend left me",
    ],
    unless: ["self-harm"],
  },
  tiredness: { phrases: ["tired", "tiredness", "fatigue", "exhausted", "no energy", "weak", "weakness"], unless: ["stroke", "suspected-stroke"] },
  // Skin and wound infections. Ear and urine infections have their own topics above.
  infection: { phrases: ["pus", "infected", "swollen and red", "red and swollen", "abscess", "boil"] },
};

// An option may set a minimum level ("minLevel") or raise the level by one step ("raiseOne").
// Answers can only raise the level (see refineUrgency). Within a topic, the questions are in the order they are asked.
const SPECIFIC = [
  {
    id: "breath-at-rest",
    topic: "breathing",
    text: "Are you short of breath even while resting or talking?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Being short of breath at rest needs immediate care." },
      { value: "no", label: "No, only when I am active", minLevel: "soon", reason: "Getting breathless with activity should be checked by a doctor." },
    ],
  },
  {
    id: "headache-sudden",
    topic: "headache",
    text: "Did the headache start suddenly (within a minute) and is it the worst you have ever had?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "A sudden, very severe headache can signal bleeding in the brain." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "rash-glass",
    topic: "rash",
    text: "If you press a clear glass on the rash, does the rash stay visible?",
    options: [
      { value: "yes", label: "Yes, it does not fade", minLevel: "emergency", reason: "A rash that does not fade under pressure can be a sign of a serious infection such as meningitis." },
      { value: "no", label: "No, it fades" },
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "fever-temperature",
    topic: "fever",
    text: "What is the highest temperature you measured?",
    options: [
      { value: "under-38", label: "Below 38°C" },
      { value: "38-39", label: "38 to 39.4°C" },
      { value: "39.5-plus", label: "39.5°C or higher", minLevel: "urgent", reason: "A temperature of 39.5°C or higher should be checked today." },
      { value: "not-measured", label: "I have not measured it" },
    ],
  },
  {
    id: "abdominal-severe",
    topic: "abdominal",
    text: "Is the stomach pain severe and constant, or is your belly hard or swollen?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Severe, constant stomach pain or a hard, swollen belly should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "keep-fluids",
    topic: "vomiting",
    text: "Can you keep water or other drinks down?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No, I bring everything back up", minLevel: "urgent", reason: "Not being able to keep fluids down can lead to dehydration." },
    ],
  },

  // ---------- Case-specific questions for more complaints ----------
  {
    id: "head-injury-signs",
    topic: "head-injury",
    text: "Since the head injury, has the person vomited more than once, been very sleepy or confused, had a seizure, or had a headache that keeps getting worse?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Vomiting, drowsiness, confusion, a seizure or a worsening headache after a head injury can mean bleeding inside the head." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "head-injury-thinners",
    topic: "head-injury",
    text: "Does the person take a blood thinner (for example warfarin, apixaban or rivaroxaban), or are they older than 65?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "A head injury in someone on a blood thinner or older than 65 should be checked today, even if they seem well." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "dizzy-stroke-signs",
    topic: "dizziness",
    text: "Along with the dizziness, is there any new weakness or numbness, a drooping face, slurred speech, double vision or trouble walking?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Dizziness with weakness, numbness, a drooping face, slurred speech, double vision or trouble walking can be a stroke." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "dizzy-faint-heart",
    topic: "dizziness",
    text: "Have you nearly fainted, or has your heart been racing, pounding or skipping beats?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Nearly fainting, or dizziness with a racing or irregular heartbeat, should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "dizzy-kind",
    topic: "dizziness",
    text: "What does the dizziness feel like?",
    options: [
      { value: "spinning", label: "The room spins, mostly when I move my head" },
      { value: "standing", label: "Light-headed, mostly when I stand up" },
      { value: "cannot-stand", label: "It doesn't stop and I can't stand or walk without help", minLevel: "urgent", reason: "Dizziness that doesn't stop and makes it impossible to stand or walk should be checked today." },
      { value: "unsure", label: "Hard to describe" },
    ],
  },
  {
    id: "palpitations-red-flags",
    topic: "palpitations",
    text: "With the racing or uneven heartbeat, do you have chest pain, trouble breathing, or have you fainted or nearly fainted?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "A racing or uneven heartbeat with chest pain, trouble breathing or fainting needs emergency care." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "palpitations-now",
    topic: "palpitations",
    text: "Is it happening right now, and has it lasted more than 15 minutes?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "A racing or uneven heartbeat that lasts more than 15 minutes should be checked today." },
      { value: "no", label: "No, it comes and goes" },
    ],
  },
  {
    id: "nosebleed-pressure",
    topic: "nosebleed",
    text: "Has the nosebleed lasted more than 20 minutes, even while pinching the soft part of the nose and leaning forward?",
    options: [
      { value: "yes", label: "Yes, it hasn't stopped", minLevel: "urgent", reason: "A nosebleed that lasts more than 20 minutes despite pressure should be checked today." },
      { value: "no", label: "No, it stopped or is slowing" },
      { value: "not-tried", label: "I haven't tried pinching it yet" },
    ],
  },
  {
    id: "nosebleed-cause",
    topic: "nosebleed",
    text: "Did it start after a blow to the head or face, or do you take a blood thinner?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "A nosebleed after a head or face injury, or while taking a blood thinner, should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "bleeding-pressure",
    topic: "wound",
    text: "If you press firmly on it with a clean cloth for 10 minutes, does the bleeding stop?",
    options: [
      { value: "stops", label: "Yes, it stops" },
      { value: "oozes", label: "It slows down but keeps oozing", minLevel: "soon", reason: "Bleeding that keeps oozing after 10 minutes of pressure should be checked by a doctor." },
      { value: "no", label: "No, it keeps flowing or soaks through the cloth", minLevel: "emergency", reason: "Bleeding that doesn't stop with firm pressure is an emergency." },
      { value: "not-tried", label: "I haven't tried yet" },
    ],
  },
  {
    id: "wound-deep",
    topic: "wound",
    text: "Is the wound deep or gaping, longer than about 2 cm, or caused by a bite, a crush, or something dirty or rusty?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "A deep, gaping, crushed or dirty wound, or a bite, may need stitches, cleaning or a tetanus shot today." },
      { value: "no", label: "No, it is small and clean" },
    ],
  },
  {
    id: "bleeding-thinners",
    topic: "wound",
    text: "Do you take a blood thinner (for example warfarin, apixaban, rivaroxaban or clopidogrel), or have a bleeding disorder?",
    options: [
      { value: "yes", label: "Yes", minLevel: "soon", reason: "Bleeding while taking a blood thinner, or with a bleeding disorder, should be checked by a doctor." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "burn-size",
    topic: "burn",
    text: "Is the burn bigger than the palm of the person's hand, or on the face, hands, feet, genitals or a joint?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "A burn larger than the palm, or on the face, hands, feet, genitals or a joint, should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "burn-deep",
    topic: "burn",
    text: "Does the burned skin look white, leathery or charred, or does it not hurt at all?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "White, leathery or charred skin, or a burn that doesn't hurt, can be a deep burn and should be checked today." },
      { value: "no", label: "No, it is red and painful" },
      { value: "blisters", label: "It has blisters", minLevel: "soon", reason: "A blistered burn should be checked by a doctor." },
    ],
  },
  {
    id: "sprain-weight",
    topic: "sprain",
    text: "Can you put weight on it, or use it, at all?",
    options: [
      { value: "yes", label: "Yes, with some pain" },
      { value: "no", label: "No, I can't put weight on it or use it", minLevel: "urgent", reason: "Not being able to put weight on or use the injured part can mean a broken bone, which should be checked today." },
    ],
  },
  {
    id: "sprain-deformed",
    topic: "sprain",
    text: "Does it look bent or out of shape, or is it numb, cold or pale below the injury?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "A limb that looks out of shape, or is numb, cold or pale below the injury, should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "allergy-airway",
    topic: "allergy",
    text: "Is the face, lips, tongue or throat swelling, or is it hard to breathe or swallow?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Swelling of the face, lips, tongue or throat, or trouble breathing or swallowing, can be a severe allergic reaction." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "allergy-spreading",
    topic: "allergy",
    text: "Is the rash, swelling or redness spreading over the body, or do you feel faint or sick?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "An allergic reaction that is spreading, or that makes you feel faint or sick, should be checked today." },
      { value: "no", label: "No, it stays in one place" },
    ],
  },
  {
    id: "cough-red-flags",
    topic: "cough",
    text: "When you cough, do you bring up blood or rust-coloured phlegm, or get a sharp chest pain when you breathe in?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Coughing up blood or rust-coloured phlegm, or sharp chest pain when breathing in, should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "cough-duration",
    topic: "cough",
    text: "How long have you had the cough?",
    options: [
      { value: "under-1-week", label: "Less than a week" },
      { value: "1-3-weeks", label: "1 to 3 weeks" },
      { value: "over-3-weeks", label: "More than 3 weeks", minLevel: "soon", reason: "A cough lasting more than 3 weeks should be checked by a doctor." },
    ],
  },
  {
    id: "throat-swallow",
    topic: "throat",
    text: "Can you swallow your own saliva and open your mouth fully?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No, I can't swallow, I'm drooling, or I can't open my mouth", minLevel: "urgent", reason: "Not being able to swallow saliva or open the mouth with a sore throat can be a throat abscess and should be checked today." },
    ],
  },
  {
    id: "throat-tonsils",
    topic: "throat",
    text: "Do you have a fever with white patches on the tonsils or swollen glands in the neck?",
    options: [
      { value: "yes", label: "Yes", minLevel: "soon", reason: "A sore throat with fever, white patches or swollen glands can be a bacterial infection and should be checked by a doctor." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "ear-behind",
    topic: "ear",
    text: "Is the area behind the ear swollen, red or painful, or is the ear being pushed forward?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Swelling, redness or pain behind the ear can be a serious ear infection and should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "ear-hearing",
    topic: "ear",
    text: "Have you suddenly lost hearing in that ear, or is fluid or pus coming out of it?",
    options: [
      { value: "hearing", label: "Yes, my hearing suddenly dropped", minLevel: "urgent", reason: "Sudden hearing loss should be checked today: treatment works best when it starts early." },
      { value: "discharge", label: "Yes, fluid or pus is coming out", minLevel: "soon", reason: "Fluid or pus from the ear should be checked by a doctor." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "eye-vision-light",
    topic: "eye",
    text: "Is your vision blurred or reduced, or does light hurt the eye?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "An eye problem with blurred or reduced vision, or pain from light, should be checked today." },
      { value: "no", label: "No, I can see normally" },
    ],
  },
  {
    id: "eye-injury",
    topic: "eye",
    text: "Did something hit the eye or get into it, such as a chemical, metal or wood?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "An injury to the eye, or something in it, should be checked today. Rinse a chemical out with clean water for 15 minutes first." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "urinary-kidney",
    topic: "urinary",
    text: "Do you also have a fever, chills, or pain in your side or back?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "A urine infection with a fever, chills or pain in the side or back can be a kidney infection and needs treatment today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "urinary-who",
    topic: "urinary",
    text: "Is the person pregnant, a man, or a child?",
    options: [
      { value: "yes", label: "Yes", minLevel: "soon", reason: "Urine infection symptoms in pregnancy, in men or in children should be checked by a doctor." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "diarrhoea-blood",
    topic: "diarrhoea",
    text: "Is there blood in the stool, or is it black like tar?",
    options: [
      { value: "no", label: "No" },
      { value: "red", label: "Yes, red blood", minLevel: "urgent", reason: "Blood in the stool should be checked today." },
      { value: "black", label: "Yes, it is black or tar-like", minLevel: "emergency", reason: "Black or tar-like stools can be a sign of bleeding in the stomach or gut." },
    ],
  },
  {
    id: "diarrhoea-dehydration",
    topic: "diarrhoea",
    text: "Are you peeing much less than usual, very thirsty, or dizzy when you stand up?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Peeing much less, strong thirst or dizziness on standing can be signs of dehydration." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "back-nerves",
    topic: "back-pain",
    text: "With the back pain, is there numbness between the legs or around the bottom, new trouble controlling the bladder or bowels, or new weakness in the legs?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Back pain with numbness around the bottom, trouble controlling the bladder or bowels, or leg weakness can mean the nerves at the base of the spine are pressed." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "back-cause",
    topic: "back-pain",
    text: "Did the back pain start after a fall or injury, or do you also have a fever?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Back pain after a fall or injury, or with a fever, should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "leg-clot",
    topic: "leg-swelling",
    text: "Is only one leg swollen, warm, red or painful, especially the calf?",
    options: [
      { value: "yes", label: "Yes, just one leg", minLevel: "urgent", reason: "A swollen, warm or painful calf in one leg can be a blood clot and should be checked today." },
      { value: "no", label: "No, both legs, or neither" },
    ],
  },
  {
    id: "leg-breath",
    topic: "leg-swelling",
    text: "Are you short of breath, or do you have chest pain or cough up blood?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "A painful leg with breathlessness, chest pain or coughing up blood can be a blood clot in the lungs." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "tooth-swelling",
    topic: "tooth",
    text: "Is the face or jaw swelling, or is it hard to open your mouth or swallow?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Swelling of the face or jaw, or trouble opening the mouth or swallowing, with a toothache can be a spreading infection." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "mood-safety",
    topic: "mood",
    text: "Are you having thoughts of harming yourself, or that life isn't worth living?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Thoughts of harming yourself need support now. You can call Embrace Lifeline on 1564, or 140 in an emergency." },
      { value: "no", label: "No" },
      { value: "rather-not-say", label: "I'd rather not say" },
    ],
  },
  {
    id: "mood-coping",
    topic: "mood",
    text: "Is it stopping you from sleeping, eating, working or looking after yourself?",
    options: [
      { value: "yes", label: "Yes", minLevel: "soon", reason: "Feelings that stop you from sleeping, eating or getting through the day are worth talking to a doctor about." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "tired-sudden-one-side",
    topic: "tiredness",
    text: "Did the weakness come on suddenly, or is it on one side of the body only?",
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Sudden weakness, or weakness on one side of the body, can be a stroke." },
      { value: "no", label: "No, it is general tiredness" },
    ],
  },
  {
    id: "tired-weight-loss",
    topic: "tiredness",
    text: "Have you lost weight without trying, or had night sweats?",
    options: [
      { value: "yes", label: "Yes", minLevel: "soon", reason: "Tiredness with weight loss you didn't try for, or night sweats, should be checked by a doctor." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "infection-spreading",
    topic: "infection",
    text: "Is the redness or swelling spreading, or do you also have a fever or chills?",
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "An infection that is spreading, or that comes with a fever or chills, should be checked today." },
      { value: "no", label: "No" },
    ],
  },
];

const GENERAL = [
  {
    id: "risk-group",
    text: "Does any of these apply to the person with the symptoms: pregnant, younger than 3 months, older than 65, or a long-term illness or weak immune system?",
    options: [
      { value: "yes", label: "Yes", raiseOne: true, reason: "Pregnancy, a very young or older age, or a long-term illness means symptoms should be checked sooner." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "severity",
    text: "How bad are the symptoms right now?",
    options: [
      { value: "mild", label: "Mild: I can do my normal activities" },
      { value: "moderate", label: "Moderate: they get in the way of my day" },
      { value: "severe", label: "Severe: I can hardly function", minLevel: "urgent", reason: "You rated your symptoms as severe." },
    ],
  },
  {
    id: "duration",
    text: "How long have you had these symptoms?",
    options: [
      { value: "under-1-day", label: "Less than a day" },
      { value: "1-3-days", label: "1 to 3 days" },
      { value: "4-7-days", label: "4 to 7 days" },
      { value: "over-1-week", label: "More than a week", minLevel: "soon", reason: "Symptoms lasting more than a week should be checked by a doctor." },
    ],
  },
  {
    id: "trend",
    text: "Are the symptoms getting better, staying the same, or getting worse?",
    options: [
      { value: "better", label: "Getting better" },
      { value: "same", label: "Staying the same" },
      { value: "worse", label: "Getting worse", minLevel: "soon", reason: "Symptoms that are getting worse should be checked by a doctor." },
    ],
  },
];

// Level order from least to most serious, used to raise a level by one step.
const ORDER = ["routine", "soon", "urgent", "emergency"];
const moreSerious = (a, b) => (LEVELS[a].rank <= LEVELS[b].rank ? a : b);
// "raiseOne" stops at urgent: a risk factor alone never makes something an emergency.
const raiseOneStep = (level) => (level === "emergency" ? level : ORDER[Math.min(ORDER.indexOf(level) + 1, ORDER.indexOf("urgent"))]);

// A phrase counts if the person wrote it (whole words, not negated), or wrote everyday wording that means it.
const said = (text, phrase, understood) => containsPositive(text, phrase) || understood.some((item) => item.means === phrase);

function topicApplies(topic, text, matchedRuleIds, understood) {
  if (topic.unless?.some((id) => matchedRuleIds.includes(id))) return false;
  if (topic.unlessPhrases?.some((phrase) => containsPositive(text, phrase))) return false;
  const byRule = topic.rules?.some((id) => matchedRuleIds.includes(id));
  const byPhrase = topic.phrases?.some((phrase) => said(text, phrase, understood));
  return Boolean(byRule || byPhrase);
}

function matchingTopics(description, matchedRuleIds) {
  const text = normalise(description);
  const understood = findEverydayWording(text);
  return Object.entries(TOPICS).filter(([, topic]) => topicApplies(topic, text, matchedRuleIds, understood));
}

// The case-specific questions for this description: the topics it matches take turns (each topic's first question,
// then each one's second, ...) up to MAX_SPECIFIC. Deterministic, so refineUrgency accepts exactly what was asked.
function specificFor(description, matchedRuleIds) {
  const queues = matchingTopics(description, matchedRuleIds)
    .map(([name]) => SPECIFIC.filter((question) => question.topic === name));
  const picked = [];
  for (let turn = 0; picked.length < MAX_SPECIFIC && queues.some((queue) => queue.length > turn); turn += 1) {
    for (const queue of queues) {
      if (picked.length >= MAX_SPECIFIC) break;
      if (queue[turn]) picked.push(queue[turn]);
    }
  }
  return picked;
}

// SCRUM-279: the general questions for this person. The risk question keeps its id and answers but asks only
// what My health doesn't say, and is left out when My health already answers it. No profile: unchanged.
function generalFor(health) {
  if (!health) return GENERAL;
  const riskText = riskQuestionText(health);
  return GENERAL.flatMap((q) => {
    if (q.id !== "risk-group") return [q];
    return riskText ? [{ ...q, text: riskText }] : [];
  });
}

// The full question objects (with their escalation logic) that apply to this description.
// health: from healthContext.readHealth(), or null when there is no profile (SCRUM-279).
function selectQuestions(description, initial = classifyUrgency(description), health = null) {
  if (initial.level === "emergency") return [];
  const topics = matchingTopics(description, initial.matchedRuleIds);
  const moodOnly = topics.length === 1 && topics[0][0] === "mood";
  return [
    ...specificFor(description, initial.matchedRuleIds),
    ...(moodOnly ? [] : generalFor(health)),
  ];
}

// What the browser sees: the question and its choices, not the escalation rules behind them.
const toPublic = (question) => ({
  id: question.id,
  text: question.text,
  options: question.options.map(({ value, label }) => ({ value, label })),
});

function getFollowUpQuestions(description, initial, health = null) {
  return selectQuestions(description, initial, health).map(toPublic);
}

class AnswerError extends Error {}

// answers = { "<question id>": "<option value>", ... }. Unanswered questions are simply skipped.
// health (SCRUM-279): from healthContext.readHealth(); its risk factors count like a "Yes" to the risk question.
function refineUrgency(description, answers, { health = null } = {}) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new AnswerError("Answers must be an object of question ids and chosen options.");
  }
  const initial = classifyUrgency(description);
  // Checked against the full list (no profile), so an answer to the risk question is still accepted when
  // My health already answers it, for example from a page opened before My health was filled in.
  const questions = selectQuestions(description, initial);

  const chosen = Object.entries(answers).map(([id, value]) => {
    const question = questions.find((q) => q.id === id);
    if (!question) throw new AnswerError(`"${id}" is not a question for these symptoms.`);
    const option = question.options.find((o) => o.value === value);
    if (!option) throw new AnswerError(`"${value}" is not a valid answer to "${id}".`);
    return option;
  });

  // Start from the classifier's level and its reasons, then let answers raise it.
  const contributions = initial.reasons.map((reason) => ({ level: initial.level, reason }));
  let level = initial.level;
  for (const option of chosen) {
    if (option.minLevel) {
      level = moreSerious(level, option.minLevel);
      contributions.push({ level: option.minLevel, reason: option.reason });
    }
  }
  // Risk factors are applied last so they raise the level that the other answers produced.
  // SCRUM-279: a "Yes" answer and the risk factors My health shows raise it once together, not once each.
  const raise = chosen.find((option) => option.raiseOne);
  const fromHealth = riskFactors(health).map((factor) => factor.reason);
  let healthRaised = [];
  if (raise || fromHealth.length > 0) {
    const raised = raiseOneStep(level);
    if (raised !== level) {
      level = raised;
      healthRaised = fromHealth;
      for (const reason of [...fromHealth, ...(raise ? [raise.reason] : [])]) contributions.push({ level, reason });
    }
  }

  // As in SCRUM-128, only the reasons for the final level are shown, so the advice never contradicts itself.
  const reasons = [...new Set(contributions.filter((c) => c.level === level).map((c) => c.reason))];
  const { label, timeframe, action } = LEVELS[level];

  return {
    level,
    label,
    timeframe,
    action,
    confidence: chosen.length > 0 ? "refined" : initial.confidence,
    reasons: reasons.length > 0 ? reasons : initial.reasons,
    matchedRuleIds: initial.matchedRuleIds,
    initialLevel: initial.level,
    answeredQuestionIds: Object.keys(answers),
    // SCRUM-279: the My health reasons that made it one step more urgent (empty when they changed nothing).
    healthRaised,
    followUpQuestions: [],
  };
}

// selectQuestions and toPublic: also used by adaptiveFollowUps.js (SCRUM-280), which asks them one at a time.
module.exports = { getFollowUpQuestions, refineUrgency, selectQuestions, toPublic, AnswerError, SPECIFIC, GENERAL, TOPICS, MAX_SPECIFIC };

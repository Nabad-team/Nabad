// SCRUM-278: "As a user, I want triage to return a care-type ID so 'Find care' opens the directory
// filtered by the recommended specialty."
//
// Every triage result already has careType, but that is text written by the model in the user's
// language ("Emergency department", "قسم الطوارئ"), so it cannot be used to filter the directory.
// careTypeId is one fixed id from CARE_TYPES below. The server always picks it itself, never from
// the user's text directly, and the frontend turns it into directory filters through its own
// allow-list (frontend/lib/providerFilters.js). The ids for specialists are the directory's own
// specialty slugs (backend/data/providers.js), so the two can never drift apart (a test checks it).
//
// How the id is chosen (chooseCareTypeId), first match wins:
//   1. Emergency -> always "emergency-department". An emergency is never narrowed to a specialty:
//      the person needs the nearest emergency department, not a cardiologist's clinic.
//   2. The model's careTypeId, when the model's assessment was used, the id is on the list, and it
//      fits the final level (the model cannot send an urgent case to "self-care").
//   3. A specialty suggested by the user's own words (SPECIALTY_HINTS), e.g. "my ear hurts" -> ENT.
//      This is how the rules alone (AI off or rejected) still recommend a specialty.
//   4. The default for the level: urgent -> urgent-care, soon -> general-practitioner,
//      routine -> self-care.

const { normalise, findEverydayWording, mentions } = require("./urgency");

const SPECIALIST = ["urgent", "soon", "routine"];

// id -> what it means (also shown to the model) and the urgency levels it can be used for.
const CARE_TYPES = {
  "emergency-department": { label: "Emergency department", levels: ["emergency", "urgent"] },
  "urgent-care": { label: "Emergency department or urgent care clinic", levels: ["urgent"] },
  "general-practitioner": { label: "General practitioner / family doctor", levels: ["soon", "routine"] },
  "self-care": { label: "Self-care at home", levels: ["routine"] },
  cardiology: { label: "Cardiologist (heart)", levels: SPECIALIST },
  dermatology: { label: "Dermatologist (skin)", levels: SPECIALIST },
  ent: { label: "Ear, nose and throat doctor", levels: SPECIALIST },
  neurology: { label: "Neurologist (brain and nerves)", levels: SPECIALIST },
  "obstetrics-gynecology": { label: "Obstetrician-gynecologist (pregnancy, women's health)", levels: SPECIALIST },
  ophthalmology: { label: "Ophthalmologist (eyes)", levels: SPECIALIST },
  orthopedics: { label: "Orthopedic doctor (bones and joints)", levels: SPECIALIST },
  pediatrics: { label: "Pediatrician (babies and children)", levels: SPECIALIST },
  psychiatry: { label: "Psychiatrist (mental health)", levels: SPECIALIST },
  surgery: { label: "Surgeon", levels: SPECIALIST },
};

const DEFAULT_CARE_TYPE_ID = {
  emergency: "emergency-department",
  urgent: "urgent-care",
  soon: "general-practitioner",
  routine: "self-care",
};

// Words that point to one specialty, in priority order: the first group that matches wins.
// Pregnancy and young children come first because they change who should see the person whatever
// the symptom; mental health comes last because words like "anxiety" often sit next to a physical
// symptom ("anxiety about this rash") that should decide the specialty.
// Phrases are matched like the rules: whole words only, ignored when negated ("no rash"), and
// everyday wording counts ("my ear hurts" means "ear pain", see everydayWording.js).
const SPECIALTY_HINTS = [
  { id: "obstetrics-gynecology", phrases: ["pregnant", "pregnancy", "missed period", "missed my period", "period pain", "heavy period", "heavy periods", "vaginal bleeding", "vaginal discharge"] },
  { id: "pediatrics", phrases: ["my baby", "our baby", "my child", "our child", "my kid", "my toddler", "my infant", "newborn", "week old", "weeks old", "month old", "months old"] },
  { id: "ophthalmology", phrases: ["eye pain", "red eye", "red eyes", "pink eye", "conjunctivitis", "blurry vision", "blurred vision", "eye infection", "itchy eyes", "something in my eye", "severe eye pain", "eye injury", "chemical in my eye"] },
  { id: "ent", phrases: ["ear pain", "earache", "ear infection", "hearing loss", "ringing in my ears", "tinnitus", "sinus", "sinusitis", "nosebleed", "nosebleeds", "tonsils", "tonsillitis", "hoarse voice"] },
  { id: "dermatology", phrases: ["rash", "hives", "itchy skin", "acne", "eczema", "psoriasis", "mole", "skin infection"] },
  { id: "orthopedics", phrases: ["broken bone", "fracture", "fractured", "sprain", "sprained", "twisted my ankle", "back pain", "knee pain", "joint pain", "shoulder pain", "hip pain", "cannot put weight", "can't put weight"] },
  { id: "cardiology", phrases: ["palpitations", "heart racing", "racing heart", "irregular heartbeat", "heart is pounding", "high blood pressure", "blood pressure is high"] },
  { id: "neurology", phrases: ["migraine", "migraines", "tingling", "tremor", "memory problems"] },
  { id: "surgery", phrases: ["hernia", "testicle", "testicles", "testicular", "testicle pain", "appendicitis", "appendix"] },
  { id: "psychiatry", phrases: ["anxiety", "panic attack", "panic attacks", "depressed", "depression", "hearing voices", "insomnia"] },
];

const isCareTypeId = (id) => typeof id === "string" && Object.hasOwn(CARE_TYPES, id);
const fitsLevel = (id, level) => isCareTypeId(id) && CARE_TYPES[id].levels.includes(level);

// The specialty the user's own words point to, or null.
function hintedSpecialty(symptoms) {
  const text = normalise(symptoms);
  const understood = findEverydayWording(text);
  const hint = SPECIALTY_HINTS.find(({ phrases }) => phrases.some((phrase) => mentions(text, phrase, understood)));
  return hint ? hint.id : null;
}

// level: the final urgency level. modelCareTypeId: from the model's reply, only when its
// assessment was used (aiTriage.js passes nothing otherwise).
function chooseCareTypeId({ level, symptoms, modelCareTypeId = null }) {
  if (level === "emergency") return DEFAULT_CARE_TYPE_ID.emergency;
  if (fitsLevel(modelCareTypeId, level)) return modelCareTypeId;
  const hinted = hintedSpecialty(symptoms);
  if (fitsLevel(hinted, level)) return hinted;
  return DEFAULT_CARE_TYPE_ID[level];
}

module.exports = { CARE_TYPES, DEFAULT_CARE_TYPE_ID, SPECIALTY_HINTS, isCareTypeId, fitsLevel, hintedSpecialty, chooseCareTypeId };

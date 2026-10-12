const HealthFact = require("./models/HealthFact");
const { SINGLE_CATEGORIES } = HealthFact;
const Medication = require("./models/Medication");
const User = require("./models/User");
const LinkedProfile = require("./models/LinkedProfile");

// "My health": what each kind of health fact may hold, and the plain-text summary Nabad's guidance uses.

const SEXES = ["female", "male"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];
const PREGNANCY = ["pregnant", "not_pregnant", "not_applicable"];
const SMOKING = ["never", "former", "current"];
// The common long-term conditions offered as a checklist. "other" takes the user's own words.
const CONDITIONS = {
  diabetes: "diabetes", high_blood_pressure: "high blood pressure", asthma: "asthma", heart_disease: "heart disease",
  kidney_disease: "kidney disease", epilepsy: "epilepsy", thyroid_disease: "thyroid disease",
};
const ALLERGY_TYPES = ["medication", "food", "other"];
const LIMITS = { height: [30, 250], weight: [1, 400], text: 100, reaction: 200 };

// Optional text: missing, null or "" all mean "". Returns null when it isn't text or is too long.
function readText(value, max) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > max ? null : text;
}
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const choice = (options, message) => (value) => (options.includes(value) ? { value } : { error: message });

// Checks a fact's value for its category. Returns { value } cleaned, or { error } in plain words.
const READERS = {
  sex: choice(SEXES, "Choose female or male."),
  height(value) {
    const [min, max] = LIMITS.height;
    return Number.isInteger(value) && value >= min && value <= max ? { value } : { error: `Enter a height in whole centimetres, from ${min} to ${max}.` };
  },
  weight(value) {
    const [min, max] = LIMITS.weight;
    // At most one decimal place (72.5). 72.3 * 10 isn't exactly 723 in floating point, hence the tolerance.
    const oneDecimal = typeof value === "number" && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
    return oneDecimal && value >= min && value <= max ? { value } : { error: `Enter a weight in kilograms, from ${min} to ${max} (for example 72.5).` };
  },
  bloodType: choice(BLOOD_TYPES, "Choose a blood type, or \"I don't know\"."),
  pregnancy: choice(PREGNANCY, "Choose pregnant, not pregnant or not applicable."),
  smoking: choice(SMOKING, "Choose never, former or current."),
  condition(value) {
    if (!isObject(value) || !(value.code in CONDITIONS || value.code === "other")) return { error: "Choose a condition from the list, or Other." };
    if (value.code !== "other") return { value: { code: value.code } };
    const text = readText(value.text, LIMITS.text);
    if (text === null) return { error: `Keep the condition to ${LIMITS.text} characters or fewer.` };
    if (!text) return { error: "Enter the condition's name." };
    return { value: { code: "other", text } };
  },
  allergy(value) {
    if (!isObject(value) || !ALLERGY_TYPES.includes(value.type)) return { error: "Choose what the allergy is to: a medication, a food or something else." };
    const name = readText(value.name, LIMITS.text);
    if (name === null) return { error: `Keep the allergy's name to ${LIMITS.text} characters or fewer.` };
    if (!name) return { error: "Enter what you are allergic to." };
    const reaction = readText(value.reaction, LIMITS.reaction);
    if (reaction === null) return { error: `Keep the reaction note to ${LIMITS.reaction} characters or fewer.` };
    return { value: { type: value.type, name, reaction } };
  },
};
function readValue(category, value) {
  const reader = READERS[category];
  return reader ? reader(value) : { error: "Choose what kind of health information this is." };
}

// What may exist only once among a profile's confirmed facts (see slot in models/HealthFact.js).
function slotFor(category, value) {
  if (SINGLE_CATEGORIES.includes(category)) return category;
  if (category === "condition" && value.code !== "other") return `condition:${value.code}`;
  return undefined;
}

// Age on today's (UTC) date from a date of birth: { years, months }, or null when there is none.
function ageFrom(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null;
  let months = (now.getUTCFullYear() - dateOfBirth.getUTCFullYear()) * 12 + now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (now.getUTCDate() < dateOfBirth.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months };
}
// "34 years", "1 year", or in months under 2 years ("8 months"): a baby's age in months matters for guidance.
function ageText(age) {
  if (!age) return "";
  if (age.years < 2) return age.months === 1 ? "1 month" : `${age.months} months`;
  return `${age.years} years`;
}

// One line of the user's own words: no line breaks, so free text can never pose as another line of the summary.
const oneLine = (text) => String(text).replace(/\s+/g, " ").trim();
const conditionText = (value) => (value.code === "other" ? oneLine(value.text) : CONDITIONS[value.code]);
function allergyText(value) {
  const details = [value.type, value.reaction && `reaction: ${oneLine(value.reaction)}`].filter(Boolean).join(", ");
  return `${oneLine(value.name)} (${details})`;
}
function medicationText(medication) {
  const amount = [medication.dose, medication.unit].filter(Boolean).join(" ");
  const what = [oneLine(medication.name), amount && oneLine(amount)].filter(Boolean).join(" ");
  return [what, medication.frequency && oneLine(medication.frequency)].filter(Boolean).join(", ");
}
const PREGNANCY_TEXT = { pregnant: "pregnant", not_pregnant: "not pregnant" };

// The short, plain-text health summary given to Nabad's guidance (triage), and shown to the user on "My health"
// exactly as it is sent. Only confirmed facts count: a suggestion is never used until the user confirms it.
//   age: from ageFrom() or null. facts: HealthFact documents (or plain objects). medications: the active ones.
// Every line is always present ("not recorded", "none recorded") except pregnancy, which appears only when it is
// set to pregnant or not pregnant and the sex isn't male.
function buildHealthSummary({ age, facts = [], medications = [] }) {
  const confirmed = facts.filter((fact) => fact.status === "confirmed");
  const single = (category) => confirmed.find((fact) => fact.category === category)?.value;
  const list = (category, text) => confirmed.filter((fact) => fact.category === category).map((fact) => text(fact.value));
  const sex = single("sex");
  const pregnancy = PREGNANCY_TEXT[single("pregnancy")];
  const conditions = list("condition", conditionText);
  const allergies = list("allergy", allergyText);
  const current = medications.filter((medication) => medication.status === "active").map(medicationText);
  return [
    `Age: ${age ? ageText(age) : "not recorded"}`,
    `Sex assigned at birth: ${sex || "not recorded"}`,
    pregnancy && sex !== "male" && `Pregnancy: ${pregnancy}`,
    `Long-term conditions: ${conditions.length ? conditions.join("; ") : "none recorded"}`,
    `Allergies: ${allergies.length ? allergies.join("; ") : "none recorded"}`,
    `Current medications: ${current.length ? current.join("; ") : "none recorded"}`,
  ].filter(Boolean).join("\n");
}

// The date of birth of a profile: the account owner's own (on the user) or a linked profile's.
async function dateOfBirthOf(owner, profileId) {
  const profile = String(owner) === String(profileId)
    ? await User.findById(owner).select("dateOfBirth")
    : await LinkedProfile.findOne({ _id: profileId, owner }).select("dateOfBirth");
  return profile ? profile.dateOfBirth : null;
}

// Everything "My health" and the summary need for one profile. The caller has already checked that the
// profile belongs to owner (middleware/profileAccess.js).
async function loadHealthProfile(owner, profileId) {
  const scope = { owner, profileId };
  const [dateOfBirth, facts, medications] = await Promise.all([
    dateOfBirthOf(owner, profileId),
    HealthFact.find(scope).sort({ recordedAt: 1, _id: 1 }),
    Medication.find({ ...scope, status: "active" }).sort({ createdAt: -1, _id: -1 }),
  ]);
  const age = ageFrom(dateOfBirth);
  return { dateOfBirth, age, facts, medications, summary: buildHealthSummary({ age, facts, medications }) };
}

// The health summary for one profile, for triage (Sprint 3). Check the profile is the user's own first.
async function getHealthSummary(owner, profileId) {
  return (await loadHealthProfile(owner, profileId)).summary;
}

module.exports = {
  SEXES, BLOOD_TYPES, PREGNANCY, SMOKING, CONDITIONS, ALLERGY_TYPES, LIMITS,
  readValue, slotFor, ageFrom, ageText, buildHealthSummary, loadHealthProfile, getHealthSummary,
};

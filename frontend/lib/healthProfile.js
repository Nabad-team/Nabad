// Words and small rules for "My health" (pages/my-health.js), shared with the dashboard card.
// The values are the backend's (healthProfile.js); these are the labels people see.

export const SEX_OPTIONS = [["female", "Female"], ["male", "Male"]];
export const BLOOD_TYPE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((type) => [type, type]).concat([["unknown", "I don't know"]]);
export const PREGNANCY_OPTIONS = [["pregnant", "Pregnant"], ["not_pregnant", "Not pregnant"], ["not_applicable", "Not applicable"]];
export const SMOKING_OPTIONS = [["never", "Never smoked"], ["former", "Used to smoke"], ["current", "Smokes now"]];
export const CONDITION_OPTIONS = [
  ["diabetes", "Diabetes"], ["high_blood_pressure", "High blood pressure"], ["asthma", "Asthma"], ["heart_disease", "Heart disease"],
  ["kidney_disease", "Kidney disease"], ["epilepsy", "Epilepsy"], ["thyroid_disease", "Thyroid disease"],
];
export const ALLERGY_TYPE_OPTIONS = [["medication", "Medication"], ["food", "Food"], ["other", "Something else"]];
// Same limits as the backend.
export const LIMITS = { height: [30, 250], weight: [1, 400], text: 100, reaction: 200 };

const labelOf = (options, value) => (options.find(([key]) => key === value) || [value, String(value)])[1];

// How a fact's value reads on the page: "Female", "172 cm", "72.5 kg", "I don't know", "Migraine"...
export function factText(fact) {
  const { category, value } = fact;
  switch (category) {
    case "sex": return labelOf(SEX_OPTIONS, value);
    case "height": return `${value} cm`;
    case "weight": return `${value} kg`;
    case "bloodType": return labelOf(BLOOD_TYPE_OPTIONS, value);
    case "pregnancy": return labelOf(PREGNANCY_OPTIONS, value);
    case "smoking": return labelOf(SMOKING_OPTIONS, value);
    case "condition": return value.code === "other" ? value.text : labelOf(CONDITION_OPTIONS, value.code);
    case "allergy": return value.name;
    default: return "";
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "12 Oct" in the user's time zone, with the year when it isn't this year ("12 Oct 2025").
export function shortDate(iso, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const text = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? text : `${text} ${date.getFullYear()}`;
}
const SOURCES = { user: "You added this", lab_report: "From a lab report", symptom_check: "From a symptom check" };
const SUGGESTED_FROM = { lab_report: "Suggested from a lab report", symptom_check: "Suggested from a symptom check", user: "Suggested" };
// Where a fact came from and when: "You added this, 12 Oct", plus "updated 14 Oct" once changed on a later day.
export function sourceText(fact, now = new Date()) {
  const words = (fact.status === "suggested" ? SUGGESTED_FROM : SOURCES)[fact.source] || "Added";
  const recorded = shortDate(fact.recordedAt, now);
  const updated = shortDate(fact.updatedAt, now);
  return `${words}, ${recorded}` + (updated && updated !== recorded ? ` · updated ${updated}` : "");
}

// The basics behind "Nabad knows you better". "I don't know" for blood type counts: the question is answered.
export const BASICS = ["dateOfBirth", "sex", "height", "weight", "bloodType"];
export function basicsFilled(profile) {
  const has = (category) => profile.facts.some((fact) => fact.category === category);
  return BASICS.filter((basic) => (basic === "dateOfBirth" ? Boolean(profile.dateOfBirth) : has(basic))).length;
}
// "Nabad knows you better: 3 of 5 basics filled in." Never a warning: it only counts what is there.
export function knowsYouText(filled, who) {
  const name = who || "you";
  if (filled === BASICS.length) return `All ${BASICS.length} basics are filled in. Thank you: Nabad knows ${name} better.`;
  return `Nabad knows ${name} better: ${filled} of ${BASICS.length} basics filled in.`;
}

// Pregnancy is asked only when it can apply: sex female, and an age from 10 to 55 (or no age yet).
export function pregnancyRelevant(profile) {
  const sex = profile.facts.find((fact) => fact.category === "sex")?.value;
  if (sex !== "female") return false;
  return !profile.age || (profile.age.years >= 10 && profile.age.years <= 55);
}

// SCRUM-279: "As a user, Triage uses the My health summary (age, pregnancy, conditions, allergies)
// and never asks what Nabad already knows."
//
// Turns the person's "My health" profile (healthProfile.js) into what triage needs:
//   - readHealth(profile): the few facts triage reads, read once per check. Every other function here
//     takes its result ("health"), or null when there is no profile.
//   - riskFactors(health): the facts that mean symptoms should be checked sooner (a pregnancy, an age
//     under 3 months or over 65, a long-term condition). Together they raise the level by one step,
//     never past urgent: exactly what answering "Yes" to the risk question does (followUps.js).
//   - riskQuestionText(health): the risk question, asking only about what My health doesn't already say.
//     null when My health already shows a risk factor: the answer is known, so the question isn't asked.
//   - health.summary: the plain-text summary given to the AI as background (prompt.js). It is the exact
//     text the user sees under "What Nabad's guidance takes into account" on the My health page.
//
// Only confirmed facts count (suggestions are ignored). "Not recorded" or "none recorded" means Nabad
// doesn't know, never that the answer is no: no condition on file is not the same as having none, so the
// long-term illness part of the question is still asked unless a condition is on file.
//
// Allergies go to the AI, not into a rule: matching an allergy's name in the text can't tell "I ate peanuts"
// from "I'm allergic to peanuts so I avoided them". The rules already treat the signs of a severe allergic
// reaction (swelling of the face or throat, trouble breathing) as an emergency.

const AGE = { babyUnderMonths: 3, olderThanYears: 65 };

// The checklist names (diabetes, asthma...). Loaded only when a profile is read, so the triage logic and its
// unit tests don't load the database models that healthProfile.js needs.
const conditionNames = () => require("../healthProfile").CONDITIONS;

// profile: { age, facts, medications, summary } from loadHealthProfile(), or null/undefined when there isn't one.
// null too when nothing is recorded (no age, no confirmed fact, no medication): then there is nothing to use,
// the summary would only say "not recorded", and the result must not claim My health was taken into account.
function readHealth(profile) {
  if (!profile) return null;
  const confirmed = (profile.facts || []).filter((fact) => fact.status === "confirmed");
  if (!profile.age && confirmed.length === 0 && !(profile.medications || []).length) return null;
  const single = (category) => confirmed.find((fact) => fact.category === category)?.value ?? null;
  const names = conditionNames();
  return {
    ageMonths: profile.age ? profile.age.months : null,
    sex: single("sex"),
    pregnancy: single("pregnancy"),
    // Only checklist names are ever shown back; a condition typed under "Other" becomes "a long-term condition".
    conditions: confirmed.filter((fact) => fact.category === "condition").map((fact) => names[fact.value?.code] || null),
    summary: typeof profile.summary === "string" ? profile.summary : "",
  };
}

// Pregnancy is known when My health says pregnant, not pregnant or not applicable, or the sex is male.
const pregnancyKnown = (h) => h.sex === "male" || ["pregnant", "not_pregnant", "not_applicable"].includes(h.pregnancy);
const isPregnant = (h) => h.sex !== "male" && h.pregnancy === "pregnant";

function joinList(items) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// The facts in My health that mean symptoms should be checked sooner: [{ id, reason }].
function riskFactors(h) {
  if (!h) return [];
  const factors = [];
  if (isPregnant(h)) factors.push({ id: "pregnant", reason: "My health shows a pregnancy, so symptoms should be checked sooner." });
  if (h.ageMonths !== null && h.ageMonths < AGE.babyUnderMonths) {
    factors.push({ id: "young-baby", reason: "My health shows an age under 3 months, so symptoms should be checked sooner." });
  }
  if (h.ageMonths !== null && h.ageMonths > AGE.olderThanYears * 12) {
    factors.push({ id: "older-age", reason: "My health shows an age over 65, so symptoms should be checked sooner." });
  }
  if (h.conditions.length > 0) {
    const named = [...new Set(h.conditions.filter(Boolean))];
    factors.push({ id: "long-term-condition", reason: `My health lists ${named.length ? joinList(named) : "a long-term condition"}, so symptoms should be checked sooner.` });
  }
  return factors;
}

const ILLNESS = "a long-term illness or weak immune system";
const ORIGINAL_ITEMS = ["pregnant", "younger than 3 months", "older than 65", ILLNESS];
const anyOf = (items) => `Does any of these apply to the person with the symptoms: ${items.slice(0, -1).join(", ")}, or ${items.at(-1)}?`;
// The question as written for SCRUM-126, used when there is no profile.
const ORIGINAL_RISK_QUESTION = anyOf(ORIGINAL_ITEMS);

// The risk question for this person: only the parts My health doesn't answer, or null when it isn't needed.
function riskQuestionText(h) {
  if (!h) return ORIGINAL_RISK_QUESTION;
  if (riskFactors(h).length > 0) return null;
  const items = [];
  if (!pregnancyKnown(h)) items.push("pregnant");
  if (h.ageMonths === null) items.push("younger than 3 months", "older than 65");
  // Never known to be "no": a weak immune system isn't recorded, and no condition on file isn't "none".
  items.push(ILLNESS);
  if (items.length === 1) return "Does the person with the symptoms have a long-term illness or a weak immune system?";
  return anyOf(items);
}

module.exports = { readHealth, riskFactors, riskQuestionText, ORIGINAL_RISK_QUESTION, AGE };

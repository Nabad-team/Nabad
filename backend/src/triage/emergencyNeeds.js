// Directory capability requirements, not diagnoses or a guarantee of live capacity.
// Keep emergency careTypeId as emergency-department: these requirements select a
// hospital ER, never an outpatient specialist. Multiple needs must ALL be met.
const { normalise, mentions, findEverydayWording } = require("./urgency");

const EMERGENCY_NEEDS = {
  cardiac: { specialties: ["cardiology"], services: ["cath-lab"] },
  stroke: { specialties: ["neurology"], services: ["ct"] },
  trauma: { specialties: ["surgery"], services: ["ct", "icu"] },
  burns: { specialties: [], services: ["burn-unit", "icu"] },
  surgical: { specialties: ["surgery"], services: [] },
  maternity: { specialties: ["obstetrics-gynecology"], services: ["maternity"] },
  pediatric: { specialties: ["pediatrics"], services: [] },
};
const RULE_NEEDS = {
  "chest-pain": "cardiac", "suspected-heart-attack": "cardiac",
  stroke: "stroke", "suspected-stroke": "stroke", "worst-headache": "stroke",
  "testicle-sudden": "surgical", "swallowed-object": "surgical",
};

function emergencyNeeds({ level, matchedRuleIds = [] }, symptoms = "") {
  if (level !== "emergency") return [];
  const needs = new Set(matchedRuleIds.map(id => Object.hasOwn(RULE_NEEDS, id) ? RULE_NEEDS[id] : null).filter(Boolean));
  const text = normalise(symptoms);
  const wording = findEverydayWording(text);
  const has = phrase => mentions(text, phrase, wording);
  if (matchedRuleIds.includes("major-injury")) {
    const burns = ["severe burn", "serious burn", "chemical burn"].some(has);
    if (burns) needs.add("burns");
    // Retain both requirements for a crash with burns, rather than choosing one.
    const otherInjury = ["car accident", "car crash", "hit by a car", "motorcycle accident", "stabbed", "stab wound", "gunshot", "been shot", "was shot", "fell from a height", "fall from a height", "fell off a roof", "fell from the roof", "electric shock", "electrocuted", "can't feel my legs", "cannot feel my legs", "can't move my legs", "cannot move my legs"].some(has);
    if (!burns || otherInjury) needs.add("trauma");
  }
  if (matchedRuleIds.includes("baby-not-moving")) {
    if (["pregnant", "pregnancy", "fetal", "foetal"].some(has)) needs.add("maternity");
    else if (["newborn", "after birth", "week old", "weeks old", "month old", "months old"].some(has)) needs.add("pediatric");
    // "My baby isn't moving" alone is ambiguous; do not guess an incompatible destination.
  }
  return [...needs].sort();
}

function parseEmergencyNeeds(value) {
  if (value === undefined || value === "") return [];
  if (typeof value !== "string" || value.length > 100) throw new Error("Invalid emergency treatment requirements.");
  const ids = value.split(",");
  if (!ids.every(id => Object.hasOwn(EMERGENCY_NEEDS, id))) throw new Error("Invalid emergency treatment requirements.");
  return [...new Set(ids)].sort();
}

module.exports = { EMERGENCY_NEEDS, emergencyNeeds, parseEmergencyNeeds };

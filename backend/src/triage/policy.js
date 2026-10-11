const LEVELS = ["emergency", "urgent", "routine"];

function loadApprovedRules(env = process.env) {
  try {
    const rules = JSON.parse(env.TRIAGE_RULES_JSON || "[]");
    if (!Array.isArray(rules)) return [];

    return rules.filter((rule) => {
      if (!rule || typeof rule.pattern !== "string" || !rule.pattern.trim()) return false;
      if (!LEVELS.includes(rule.level)) return false;
      try {
        new RegExp(rule.pattern, "i");
        return true;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function emergencyRoute(location = {}) {
  const country = String(location.country || "LB").trim().toUpperCase();

  if (country === "LB" || country === "LEBANON") {
    return {
      emergency: true,
      contactName: "Lebanese Red Cross",
      contactNumber: "140",
      instructions: "If this may be an emergency, call 140 or go to the nearest emergency department now.",
      mapQuery: "emergency department near me",
    };
  }

  return {
    emergency: true,
    contactName: "Local emergency services",
    contactNumber: null,
    instructions: "If this may be an emergency, call your local emergency number or go to the nearest emergency department now.",
    mapQuery: "emergency department near me",
  };
}

function assessSymptoms(symptoms, location, env = process.env) {
  const matches = loadApprovedRules(env)
    .filter((rule) => new RegExp(rule.pattern, "i").test(symptoms))
    .sort((left, right) => LEVELS.indexOf(left.level) - LEVELS.indexOf(right.level));
  const level = matches[0]?.level || "needs_clinical_review";

  return {
    level,
    disclaimer: "This is guidance, not a diagnosis.",
    matchedRuleIds: matches.map((rule) => rule.id).filter(Boolean),
    ...(level === "emergency"
      ? { routing: emergencyRoute(location) }
      : {
          guidance:
            level === "needs_clinical_review"
              ? "No approved clinical rule matched this description. Seek advice from a qualified healthcare professional."
              : "An approved care rule matched. Follow the care guidance configured for this release.",
        }),
  };
}

module.exports = { loadApprovedRules, assessSymptoms, emergencyRoute };

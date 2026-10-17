// What the user is told to do next, once the triage engine (urgency.js + ai/aiTriage.js) has
// chosen a level. Kept from the Sprint 1 safety check (Karim's emergency routing and self-care),
// which used to live in policy.js next to a second, separate rule engine. That engine is retired:
// urgency.js is the only place that decides how urgent symptoms are, so the same symptoms always
// get the same level.

// The emergency number and what to do, shown with every emergency result.
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
    instructions:
      "If this may be an emergency, call your local emergency number or go to the nearest emergency department now.",
    mapQuery: "emergency department near me",
  };
}

// General, safe self-care steps, sent with every "routine" result (routes/triage.js).
function routineSelfCare() {
  return [
    "Rest and avoid strenuous activity while you are feeling unwell.",
    "Drink enough fluids unless a healthcare professional has told you to limit fluids.",
    "Monitor your symptoms and how you are feeling.",
    "Seek medical advice if your symptoms worsen, do not improve, or you become concerned.",
  ];
}

module.exports = { emergencyRoute, routineSelfCare };

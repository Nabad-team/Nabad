const { classifyUrgency } = require("../triage/urgency");

// Reuse the existing triage engine, but only for a current/recent symptom
// narrative. Educational questions and old family history must not be diagnosed.
// This English-language gate is deliberately limited; absence of a match does
// not mean that symptoms are safe or that an emergency has been ruled out.
function getChatSafetyReply(question) {
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 1200) return null;
  const text = question.normalize("NFKC").replace(/\u2019/g, "'").trim();
  if (/^(?:what (?:is|are|does)|explain|define|hypothetically|for (?:a|my) (?:class|exam|assignment))\b/i.test(text)) return null;
  if (/\b(?:years ago|last year|in the past|previously|recovered from)\b/i.test(text) && !/\b(?:now|today|currently|just|again)\b/i.test(text)) return null;
  const narrative = /\b(?:i (?:have (?!a (?:question|report|test|history)\b)|am (?:having|experiencing)|feel|can't|cannot)|my (?:face|arm|speech|chest|tongue|throat|lips|mother|father|child|baby)|earlier today|right now)\b/i;
  if (!narrative.test(text)) return null;
  if (classifyUrgency(text).level !== "emergency") return null;
  return {
    answer: "Seek emergency medical help now: contact your local emergency services or get help reaching the nearest emergency department. Do not drive yourself. Do not wait for this chat, a routine appointment, or for symptoms to get worse. If the warning symptoms have stopped, you still need urgent assessment. You did the right thing by asking for help; please act now. This is safety guidance, not a diagnosis.",
    evidence: [],
    disclaimer: "Automated safety guidance based on Nabad's symptom rules. These rules can miss emergencies and cannot diagnose a condition.",
    responseSource: "safety_rules",
  };
}

module.exports = { getChatSafetyReply };

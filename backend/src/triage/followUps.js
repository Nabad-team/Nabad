// SCRUM-126 (backlog #26): "As a user, I want the AI to ask relevant follow-up questions
// so that the urgency assessment is accurate."
//
// Builds on the SCRUM-128 classifier (urgency.js):
//   1. getFollowUpQuestions(description) picks the questions that fit what the user wrote.
//   2. refineUrgency(description, answers) re-runs the classifier and applies the answers.
//
// Safety rules:
//   - Emergencies get NO questions: the user is sent to care immediately, never slowed down.
//   - Answers can only RAISE the level, never lower it. A wrong or careless answer can then
//     only make the advice more cautious, never hide a red flag found in the description.
//   - The server always re-classifies from the description itself, so a client cannot send
//     a fake starting level.

const { classifyUrgency, LEVELS, normalise, containsPositive } = require("./urgency");

const MAX_SPECIFIC = 2; // symptom-specific questions asked at most
// The 4 general questions are always added after them, so a user sees at most 6.

// An option may set a minimum level ("minLevel") or raise the level by one step ("raiseOne").
// Each question says when it applies: "rules" = classifier rule ids, "phrases" = words in the
// description, "unless" = rule ids that make the question pointless (already answered).
const SPECIFIC = [
  {
    id: "breath-at-rest",
    text: "Are you short of breath even while resting or talking?",
    phrases: ["short of breath", "shortness of breath", "breathless", "out of breath", "wheezing"],
    unless: ["breathing"],
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "Being short of breath at rest needs immediate care." },
      { value: "no", label: "No, only when I am active", minLevel: "soon", reason: "Getting breathless with activity should be checked by a doctor." },
    ],
  },
  {
    id: "headache-sudden",
    text: "Did the headache start suddenly (within a minute) and is it the worst you have ever had?",
    phrases: ["headache", "migraine"],
    unless: ["worst-headache"],
    options: [
      { value: "yes", label: "Yes", minLevel: "emergency", reason: "A sudden, very severe headache can signal bleeding in the brain." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "rash-glass",
    text: "If you press a clear glass on the rash, does the rash stay visible?",
    rules: ["rash"],
    options: [
      { value: "yes", label: "Yes, it does not fade", minLevel: "emergency", reason: "A rash that does not fade under pressure can be a sign of a serious infection such as meningitis." },
      { value: "no", label: "No, it fades" },
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "fever-temperature",
    text: "What is the highest temperature you measured?",
    rules: ["fever"],
    unless: ["high-fever"],
    options: [
      { value: "under-38", label: "Below 38°C" },
      { value: "38-39", label: "38 to 39.4°C" },
      { value: "39.5-plus", label: "39.5°C or higher", minLevel: "urgent", reason: "A temperature of 39.5°C or higher should be checked today." },
      { value: "not-measured", label: "I have not measured it" },
    ],
  },
  {
    id: "abdominal-severe",
    text: "Is the stomach pain severe and constant, or is your belly hard or swollen?",
    phrases: ["stomach pain", "abdominal pain", "belly pain", "stomach ache", "stomachache", "tummy pain", "stomach hurts"],
    unless: ["severe-abdominal"],
    options: [
      { value: "yes", label: "Yes", minLevel: "urgent", reason: "Severe, constant stomach pain or a hard, swollen belly should be checked today." },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "keep-fluids",
    text: "Can you keep water or other drinks down?",
    rules: ["vomiting"],
    unless: ["dehydration"],
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No, I bring everything back up", minLevel: "urgent", reason: "Not being able to keep fluids down can lead to dehydration." },
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

function applies(question, text, matchedRuleIds) {
  if (question.unless?.some((id) => matchedRuleIds.includes(id))) return false;
  const byRule = question.rules?.some((id) => matchedRuleIds.includes(id));
  const byPhrase = question.phrases?.some((phrase) => containsPositive(text, phrase));
  return Boolean(byRule || byPhrase);
}

// The full question objects (with their escalation logic) that apply to this description.
function selectQuestions(description, initial = classifyUrgency(description)) {
  if (initial.level === "emergency") return [];
  const text = normalise(description);
  const specific = SPECIFIC.filter((q) => applies(q, text, initial.matchedRuleIds)).slice(0, MAX_SPECIFIC);
  return [...specific, ...GENERAL];
}

// What the browser sees: the question and its choices, not the escalation rules behind them.
const toPublic = (question) => ({
  id: question.id,
  text: question.text,
  options: question.options.map(({ value, label }) => ({ value, label })),
});

function getFollowUpQuestions(description, initial) {
  return selectQuestions(description, initial).map(toPublic);
}

class AnswerError extends Error {}

// answers = { "<question id>": "<option value>", ... }. Unanswered questions are simply skipped.
function refineUrgency(description, answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new AnswerError("Answers must be an object of question ids and chosen options.");
  }
  const initial = classifyUrgency(description);
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
  const raise = chosen.find((option) => option.raiseOne);
  if (raise) {
    const raised = raiseOneStep(level);
    if (raised !== level) {
      level = raised;
      contributions.push({ level, reason: raise.reason });
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
    followUpQuestions: [],
  };
}

module.exports = { getFollowUpQuestions, refineUrgency, AnswerError, SPECIFIC, GENERAL, MAX_SPECIFIC };

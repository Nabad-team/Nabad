// SCRUM-180: AI triage. Combines the rule classifier (SCRUM-128), the follow-up answers
// (SCRUM-126) and a language model, with the rules always keeping the final say on safety.
//
//   1. The rules run first and set a minimum level (the "safety floor").
//   2. Emergency by the rules -> answer straight away. A person with chest pain is never
//      kept waiting for a model.
//   3. Model off, unreachable, slow, or its reply fails the guardrails -> the rules answer alone.
//      The user always gets an answer; ai.reason says why the model was not used.
//   4. Otherwise the model's level is combined with the floor: the more serious one wins.
//
// SCRUM-279: with the person's My health profile ("health", from healthContext.readHealth()), the safety
// floor counts its risk factors (followUps.js), the risk question asks only what it doesn't say, and the
// model gets the same summary the user sees on My health as background. If that summary looks like it is
// trying to give the model orders, it is left out of the prompt; the rules still use the facts.
//
// The function never throws because of the model. It only throws AnswerError (from followUps.js)
// when the follow-up answers themselves are invalid, which the route turns into a 400.

const { classifyUrgency, LEVELS } = require("../urgency");
const { getFollowUpQuestions, refineUrgency, SPECIFIC, GENERAL } = require("../followUps");
const { emergencyRoute } = require("../careGuidance");
const { chooseCareTypeId } = require("../careTypes");
const { buildMessages } = require("./prompt");
const { LlmError } = require("./llmClient");
const { GuardrailError, cleanSymptoms, detectPromptInjection, parseModelReply, applySafetyFloor } = require("./guardrails");
const { riskQuestionText } = require("../healthContext");

// Shown when the model is not used or its care type does not fit the final level.
const DEFAULT_CARE_TYPE = {
  emergency: "Emergency department",
  urgent: "Emergency department or urgent care clinic",
  soon: "General practitioner",
  routine: "Self-care at home",
};

// The follow-up questions and answer labels the user chose, in words the model understands.
// SCRUM-279: the risk question is described as the user saw it (only what My health doesn't say).
function describeAnswers(answers, health = null) {
  if (!answers) return [];
  return Object.entries(answers).flatMap(([id, value]) => {
    const question = [...SPECIFIC, ...GENERAL].find((q) => q.id === id);
    const option = question?.options.find((o) => o.value === value);
    const text = id === "risk-group" && health ? riskQuestionText(health) || question?.text : question?.text;
    return question && option ? [{ question: text, answer: option.label }] : [];
  });
}

// client: from llmClient.getLlmClient(), or null when AI triage is off.
// answers: optional follow-up answers, as for POST /api/triage/refine.
// health: from healthContext.readHealth(), or null when there is no profile or it couldn't be loaded.
async function assessWithAi(symptoms, { client = null, answers, location, priorConversations = [], health = null } = {}) {
  const hasAnswers = answers !== undefined && answers !== null;
  // The safety floor. refineUrgency validates the answers and throws AnswerError if they are wrong.
  // With a profile, refineUrgency also counts the risk factors My health shows, even before any answer.
  const floor = hasAnswers || health ? refineUrgency(symptoms, hasAnswers ? answers : {}, { health }) : classifyUrgency(symptoms);
  // SCRUM-279: what the page says about My health. raisedBy: the reasons it made the result more urgent.
  const healthProfile = { used: Boolean(health), raisedBy: floor.healthRaised || [] };

  const result = (level, { reasons, careType, careTypeId, selfCare = [], ai }) => {
    const { label, timeframe, action } = LEVELS[level];
    return {
      level,
      label,
      timeframe,
      action,
      reasons,
      careType: careType || DEFAULT_CARE_TYPE[level],
      // SCRUM-278: a fixed id the "Find care" button turns into directory filters (careTypes.js).
      careTypeId: chooseCareTypeId({ level, symptoms, modelCareTypeId: careTypeId }),
      // Self-care is only offered when home care is the advice; for anything more serious it could delay care.
      selfCare: level === "routine" ? selfCare : [],
      confidence: ai.used ? "ai+rules" : floor.confidence,
      matchedRuleIds: floor.matchedRuleIds,
      ruleLevel: floor.level,
      ai,
      healthProfile,
      // Questions are only offered before the user has answered, and never in an emergency.
      followUpQuestions: hasAnswers ? [] : getFollowUpQuestions(symptoms, { level, matchedRuleIds: floor.matchedRuleIds }, health),
      ...(level === "emergency" ? { emergency: emergencyRoute(location || {}) } : {}),
    };
  };
  const rulesOnly = (reason) => result(floor.level, { reasons: floor.reasons, ai: { used: false, reason } });

  if (floor.level === "emergency") return rulesOnly("emergency_rule");
  if (!client) return rulesOnly("not_configured");
  const injection = detectPromptInjection(symptoms);
  if (injection.length > 0) return rulesOnly("prompt_injection");

  // SCRUM-279: the My health summary goes to the model as background, unless it looks like orders.
  const summary = health?.summary || "";
  const summaryHasOrders = summary && detectPromptInjection(summary).length > 0;
  const healthSummary = summaryHasOrders ? "" : summary;

  let reply;
  try {
    const messages = buildMessages({
      symptoms: cleanSymptoms(symptoms),
      minimumLevel: floor.level,
      answered: describeAnswers(answers, health),
      priorConversations,
      healthSummary,
    });
    reply = parseModelReply(await client.complete(messages));
  } catch (error) {
    if (error instanceof LlmError || error instanceof GuardrailError) return rulesOnly(error.code);
    throw error;
  }

  const { level, applied } = applySafetyFloor(floor.level, reply.level);
  const ai = { used: true, level: reply.level, guardrails: [applied, ...new Set(reply.removed)] };
  if (summaryHasOrders) ai.guardrails.push("health_summary_omitted");
  // SCRUM-281: the model found an emergency that the rules did not. The rules are the safety net
  // when the model is off or fails, so each of these is a possible missing rule. The route logs
  // this flag (never the symptoms), so the team can audit the rules against the AI's findings.
  if (level === "emergency" && floor.level !== "emergency") ai.ruleGap = true;

  // The model said less serious than the rules: its explanation describes a milder situation and
  // would contradict the level shown, so the rules' reasons are used instead.
  if (applied === "model_lower_ignored") return result(level, { reasons: floor.reasons, ai });

  // Same level: the model's explanation first, then the rules' (unless the rules matched nothing).
  // Model raised the level: only its reasons, as the rules' reasons are for a lower level.
  const ruleReasons = applied === "agreed" && floor.confidence !== "low" ? floor.reasons : [];
  return result(level, {
    reasons: [...new Set([...reply.reasons, ...ruleReasons])],
    careType: reply.careType,
    // Only offered when the model's assessment is used; chooseCareTypeId still checks it fits the level.
    careTypeId: reply.careTypeId,
    selfCare: reply.selfCare,
    ai,
  });
}

module.exports = { assessWithAi, DEFAULT_CARE_TYPE, describeAnswers };

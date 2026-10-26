// SCRUM-280: "As a user, I want adaptive follow-up questions: the AI picks the next most useful question
// from an approved question bank, up to 3 rounds, and stops once it is confident."
//
// The approved question bank is followUps.js (SCRUM-126): the reviewed questions, their answers, and what each
// answer does to the urgency. The AI never writes a question and never decides what an answer means. It only
// chooses which approved question to ask next, by id, or says it is confident (null). This file checks that choice.
//
// One check, round by round:
//   1. The first result comes with one question (round 1). The user answers it.
//   2. The answers so far go back with the same description; the level is worked out again from scratch
//      (answers can still only raise it), and the AI picks the next question, or none.
//   3. At most 3 rounds. It stops earlier when the AI is confident, when no approved question is left, or
//      when the result is an emergency (no questions then, ever: the user is sent to care at once).
//
// Safety rules on top of the AI's choice:
//   - "Must-ask" questions are the ones whose answer can reveal an emergency (breathless at rest, a sudden worst
//     headache, a rash that doesn't fade under a glass). The AI can choose their order, but can't skip them: if it
//     says it is confident while one is still unasked, or if waiting any longer would leave no round for one,
//     that question is asked instead.
//   - An id that isn't one of the questions offered is ignored; the next question in the bank's order is asked.
//   - When the model rated the symptoms less serious than the rules (and was overruled), its "confident" isn't
//     trusted: the next question is asked anyway.
//   - When the AI isn't used for a round (off, unavailable, its reply rejected), every remaining approved
//     question is shown at once in one last round, as before SCRUM-280. Nothing is lost when the AI drops out.
//
// The server keeps no state between rounds. The page sends back followUpState ({ round, asked }) with the answers.
// It only decides which questions are offered, never the urgency: the level always comes from the description,
// the answers and My health. So a changed or missing state can't make the advice less safe.

const { selectQuestions, toPublic } = require("./followUps");

const MAX_ROUNDS = 3;
const MAX_ASKED = 20; // more than the bank holds; just a bound on what the page may send back

// True when one of the question's answers makes the result an emergency.
const canRevealEmergency = (question) => question.options.some((option) => option.minLevel === "emergency");

// The round and the ids already asked, from what the page sent back. null when there is none.
function readFollowUpState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const round = Number.isInteger(raw.round) ? Math.min(Math.max(raw.round, 0), MAX_ROUNDS) : 0;
  const asked = Array.isArray(raw.asked)
    ? [...new Set(raw.asked.filter((id) => typeof id === "string" && id.length <= 40))].slice(0, MAX_ASKED)
    : [];
  return { round, asked };
}

// Where this check stands: { round, asked, eligible, stop }. eligible: the approved questions still unasked
// (full objects). stop: why nothing more may be asked, or null.
//   level: the level the questions are for. matchedRuleIds: from the rules. health: healthContext.readHealth().
//   answers: every answer so far. state: from readFollowUpState().
function followUpStatus({ symptoms, level, matchedRuleIds, health, answers = {}, state }) {
  const answered = Object.keys(answers || {});
  const round = state ? state.round : 0;
  const asked = new Set([...(state ? state.asked : []), ...answered]);
  const base = { round, asked: [...asked], eligible: [] };
  // A page from before SCRUM-280 sends all its answers at once with no state: that was its only round.
  if (answered.length > 0 && !state) return { ...base, stop: "one_round" };
  if (level === "emergency") return { ...base, stop: "emergency" };
  if (round >= MAX_ROUNDS) return { ...base, stop: "max_rounds" };
  const eligible = selectQuestions(symptoms, { level, matchedRuleIds }, health).filter((q) => !asked.has(q.id));
  if (eligible.length === 0) return { ...base, stop: "none_left" };
  return { ...base, eligible, stop: null };
}

// The questions to show now and the state the page sends back next time.
//   modelChoice: undefined when the AI wasn't used for this round; otherwise { nextQuestionId, trustConfident }.
//   nextQuestionId from the model's reply: an id, null (it is confident), or undefined (missing or not an id).
//   trustConfident: false when the model was overruled for rating it less serious than the rules.
// Returns { questions (what the browser sees), state: { round, maxRounds, asked, oneAtATime, done, decision } }.
// decision says why, for the log and the tests (never any health data).
function planFollowUps({ modelChoice, ...input }) {
  const status = followUpStatus(input);
  const finish = (decision) => ({
    questions: [],
    state: { round: status.round, maxRounds: MAX_ROUNDS, asked: status.asked, oneAtATime: false, done: true, decision },
  });
  const ask = (questions, decision, { round, oneAtATime }) => ({
    questions: questions.map(toPublic),
    state: {
      round,
      maxRounds: MAX_ROUNDS,
      asked: [...status.asked, ...questions.map((q) => q.id)],
      oneAtATime,
      done: false,
      decision,
    },
  });

  if (status.stop) return finish(status.stop);
  const { eligible, round } = status;

  // No AI for this round: everything left at once, as the last round.
  if (!modelChoice) return ask(eligible, "rules_all", { round: MAX_ROUNDS, oneAtATime: false });

  const mustAsk = eligible.filter(canRevealEmergency);
  const roundsLeft = MAX_ROUNDS - round;
  const next = (question, decision) => ask([question], decision, { round: round + 1, oneAtATime: true });

  const { nextQuestionId, trustConfident = true } = modelChoice;
  if (nextQuestionId === null && !trustConfident) return next(mustAsk[0] || eligible[0], "model_confidence_ignored");
  if (nextQuestionId === null) {
    // Confident: stop, unless a question that could reveal an emergency hasn't been asked yet.
    return mustAsk.length ? next(mustAsk[0], "safety_question_kept") : finish("model_confident");
  }
  const picked = eligible.find((q) => q.id === nextQuestionId);
  if (!picked) return next(mustAsk[0] || eligible[0], "model_pick_invalid");
  // A non-must-ask pick is fine only while the rounds after this one still fit every must-ask question.
  if (!mustAsk.includes(picked) && mustAsk.length > roundsLeft - 1) return next(mustAsk[0], "safety_question_kept");
  return next(picked, "model_pick");
}

// The approved questions the model may choose from this round, for the prompt: [{ id, text, answers }].
// Empty when nothing more may be asked.
function questionsForModel(input) {
  const status = followUpStatus(input);
  if (status.stop) return { round: status.round, choices: [] };
  return {
    round: status.round,
    choices: status.eligible.map((q) => ({ id: q.id, text: q.text, answers: q.options.map((o) => o.label) })),
  };
}

module.exports = { planFollowUps, questionsForModel, readFollowUpState, followUpStatus, canRevealEmergency, MAX_ROUNDS };

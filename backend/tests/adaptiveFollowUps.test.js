// SCRUM-280: "As a user, I want adaptive follow-up questions: the AI picks the next most useful question from an
// approved question bank, up to 3 rounds, and stops once it is confident."
//
// Unit tests (no database, no network, fake model): the planner in adaptiveFollowUps.js, the model's pick in the
// guardrails and the prompt, and whole checks round by round through assessWithAi. The endpoint test
// (adaptiveFollowUpsEndpoint.test.js) runs the same over HTTP.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { planFollowUps, questionsForModel, readFollowUpState, canRevealEmergency, MAX_ROUNDS } = require("../src/triage/adaptiveFollowUps");
const { SPECIFIC, GENERAL, refineUrgency } = require("../src/triage/followUps");
const { classifyUrgency } = require("../src/triage/urgency");
const { parseModelReply } = require("../src/triage/ai/guardrails");
const { SYSTEM_PROMPT, buildMessages } = require("../src/triage/ai/prompt");
const { assessWithAi } = require("../src/triage/ai/aiTriage");
const { LlmError } = require("../src/triage/ai/llmClient");
const { readHealth } = require("../src/triage/healthContext");
const { buildHealthSummary } = require("../src/healthProfile");

const BANK = [...SPECIFIC, ...GENERAL];
const TWO_SAFETY = "headache and I am short of breath"; // breath-at-rest and headache-sudden can each reveal an emergency
const plan = (symptoms, extra = {}) => {
  const initial = classifyUrgency(symptoms);
  return planFollowUps({ symptoms, level: initial.level, matchedRuleIds: initial.matchedRuleIds, ...extra });
};
const ids = (result) => result.questions.map((q) => q.id);
// An answer that never makes it more urgent, for walking through rounds.
const calmAnswer = (id) => BANK.find((q) => q.id === id).options.find((o) => !o.minLevel && !o.raiseOne)?.value
  ?? BANK.find((q) => q.id === id).options.at(-1).value;
const pick = (nextQuestionId) => ({ nextQuestionId });

function fakeModel(replyFor) {
  const calls = [];
  return {
    calls,
    async complete(messages) {
      calls.push(messages);
      const body = typeof replyFor === "function" ? replyFor(messages, calls.length) : replyFor;
      if (body instanceof Error) throw body;
      return JSON.stringify({ level: "routine", reasons: ["Mild symptoms like these usually pass."], careType: "Self-care at home", selfCare: [], ...body });
    },
  };
}

// ---------------------------------------------------------------------------------------------
describe("the approved question bank", () => {
  test("the must-ask questions are exactly the ones an answer can turn into an emergency", () => {
    assert.deepEqual(BANK.filter(canRevealEmergency).map((q) => q.id), ["breath-at-rest", "headache-sudden", "rash-glass"]);
  });

  test("the model is offered the bank's own questions and answers, never anything else", () => {
    const initial = classifyUrgency("I have a fever");
    const { round, choices } = questionsForModel({ symptoms: "I have a fever", level: initial.level, matchedRuleIds: initial.matchedRuleIds });
    assert.equal(round, 0);
    assert.deepEqual(choices.map((c) => c.id), ["fever-temperature", "risk-group", "severity", "duration", "trend"]);
    for (const choice of choices) {
      const question = BANK.find((q) => q.id === choice.id);
      assert.equal(choice.text, question.text);
      assert.deepEqual(choice.answers, question.options.map((o) => o.label));
    }
  });
});

describe("one round at a time, chosen by the model", () => {
  test("round 1: the model's pick is the one question shown", () => {
    const result = plan("I have a fever", { modelChoice: pick("fever-temperature") });
    assert.deepEqual(ids(result), ["fever-temperature"]);
    assert.deepEqual(result.state, { round: 1, maxRounds: 3, asked: ["fever-temperature"], oneAtATime: true, done: false, decision: "model_pick" });
    assert.deepEqual(Object.keys(result.questions[0]).sort(), ["id", "options", "text"], "the browser never sees what an answer does");
  });

  test("the model is confident and nothing could reveal an emergency: no questions", () => {
    const result = plan("runny nose and sneezing", { modelChoice: pick(null) });
    assert.deepEqual(ids(result), []);
    assert.equal(result.state.done, true);
    assert.equal(result.state.decision, "model_confident");
  });

  test("the model is confident but a safety question is unasked: it is asked anyway", () => {
    const result = plan("headache", { modelChoice: pick(null) });
    assert.deepEqual(ids(result), ["headache-sudden"]);
    assert.equal(result.state.decision, "safety_question_kept");
  });

  test("an id that isn't offered (made up, already asked, or not for these symptoms) is ignored", () => {
    for (const bad of ["what-is-your-name", "rash-glass", undefined]) {
      const result = plan("I have a fever", { modelChoice: pick(bad) });
      assert.deepEqual(ids(result), ["fever-temperature"], String(bad));
      assert.equal(result.state.decision, "model_pick_invalid");
    }
    const later = plan("I have a fever", { answers: { "fever-temperature": "38-39" }, state: { round: 1, asked: ["fever-temperature"] }, modelChoice: pick("fever-temperature") });
    assert.deepEqual(ids(later), ["risk-group"], "an asked question is never asked again");
  });

  test("the model may put a general question before a safety one while the rounds still allow it", () => {
    const result = plan(TWO_SAFETY, { modelChoice: pick("severity") });
    assert.deepEqual(ids(result), ["severity"]);
    assert.equal(result.state.decision, "model_pick");
  });

  test("but not once waiting would leave no round for a safety question", () => {
    const state = { round: 1, asked: ["severity"] };
    const result = plan(TWO_SAFETY, { answers: { severity: "mild" }, state, modelChoice: pick("trend") });
    assert.equal(canRevealEmergency(BANK.find((q) => q.id === ids(result)[0])), true);
    assert.equal(result.state.decision, "safety_question_kept");
  });

  test("whatever the model picks, every safety question is asked within the 3 rounds", () => {
    // Every possible model: at each round it picks one of the offered ids, or says it is confident.
    let paths = 0;
    function walk(answers, state, depth) {
      const initial = classifyUrgency(TWO_SAFETY);
      const input = { symptoms: TWO_SAFETY, level: "routine", matchedRuleIds: initial.matchedRuleIds, answers, state: readFollowUpState(state) };
      const { choices } = questionsForModel(input);
      const options = [...choices.map((c) => c.id), null];
      for (const choice of options) {
        const result = planFollowUps({ ...input, modelChoice: pick(choice) });
        if (result.questions.length === 0) {
          paths += 1;
          assert.ok(["breath-at-rest", "headache-sudden"].every((id) => id in answers), `stopped early: ${JSON.stringify(answers)}`);
          continue;
        }
        assert.equal(result.questions.length, 1);
        assert.ok(depth < MAX_ROUNDS, "never more than 3 rounds");
        const [{ id }] = result.questions;
        walk({ ...answers, [id]: calmAnswer(id) }, result.state, depth + 1);
      }
    }
    walk({}, undefined, 0);
    assert.ok(paths > 100, `checked ${paths} paths`);
  });

  test("never more than 3 rounds, however many questions are left", () => {
    const state = { round: 3, asked: ["fever-temperature", "severity", "trend"] };
    const result = plan("I have a fever", { answers: { "fever-temperature": "38-39", severity: "mild", trend: "same" }, state, modelChoice: pick("duration") });
    assert.deepEqual(ids(result), []);
    assert.equal(result.state.decision, "max_rounds");
  });

  test("no questions once the result is an emergency", () => {
    const result = planFollowUps({ symptoms: "headache", level: "emergency", matchedRuleIds: [], modelChoice: pick("severity") });
    assert.deepEqual(ids(result), []);
    assert.equal(result.state.decision, "emergency");
  });

  test("a model that rated it less serious than the rules isn't trusted to stop", () => {
    const result = plan("I have a fever", { modelChoice: { nextQuestionId: null, trustConfident: false } });
    assert.deepEqual(ids(result), ["fever-temperature"]);
    assert.equal(result.state.decision, "model_confidence_ignored");
  });

  test("a question My health already answers is never offered, even if the model asks for it (SCRUM-279)", () => {
    const facts = [{ category: "pregnancy", value: "pregnant", status: "confirmed" }];
    const age = { years: 29, months: 348 };
    const health = readHealth({ age, facts, medications: [], summary: buildHealthSummary({ age, facts }) });
    const initial = classifyUrgency("I have a fever");
    const input = { symptoms: "I have a fever", level: initial.level, matchedRuleIds: initial.matchedRuleIds, health };
    assert.equal(questionsForModel(input).choices.some((c) => c.id === "risk-group"), false);
    assert.equal(planFollowUps({ ...input, modelChoice: pick("risk-group") }).state.decision, "model_pick_invalid");
  });
});

describe("without the model", () => {
  test("every approved question at once, as the last round, exactly as before SCRUM-280", () => {
    const result = plan("I have a fever");
    assert.deepEqual(ids(result), ["fever-temperature", "risk-group", "severity", "duration", "trend"]);
    assert.equal(result.state.round, MAX_ROUNDS);
    assert.equal(result.state.oneAtATime, false);
    assert.equal(result.state.decision, "rules_all");
    const after = plan("I have a fever", { answers: { severity: "mild" }, state: result.state });
    assert.deepEqual(ids(after), [], "nothing more after that round");
  });

  test("if the model drops out in round 2, the questions left are all shown together", () => {
    const state = { round: 1, asked: ["fever-temperature"] };
    const result = plan("I have a fever", { answers: { "fever-temperature": "38-39" }, state });
    assert.deepEqual(ids(result), ["risk-group", "severity", "duration", "trend"]);
    assert.equal(result.state.decision, "rules_all");
  });

  test("a page from before SCRUM-280 (answers but no state) gets no more questions, as before", () => {
    const result = plan("I have a fever", { answers: { severity: "mild" }, modelChoice: pick("trend") });
    assert.deepEqual(ids(result), []);
    assert.equal(result.state.decision, "one_round");
  });
});

describe("the state the page sends back", () => {
  test("is cleaned: the round is kept between 0 and 3, asked holds short strings only", () => {
    assert.equal(readFollowUpState(null), null);
    assert.equal(readFollowUpState([1]), null);
    assert.deepEqual(readFollowUpState({ round: -5, asked: "x" }), { round: 0, asked: [] });
    assert.deepEqual(readFollowUpState({ round: 99, asked: ["a", "a", 7, "b".repeat(41)] }), { round: 3, asked: ["a"] });
    assert.deepEqual(readFollowUpState({ round: 1.5, asked: ["severity"] }), { round: 0, asked: ["severity"] });
  });

  test("can change which questions are offered, but never the urgency", async () => {
    const answers = { "fever-temperature": "39.5-plus" };
    const levels = [];
    for (const followUpState of [undefined, { round: 0 }, { round: 3, asked: [] }, { round: 1, asked: ["every", "id"] }, "junk"]) {
      levels.push((await assessWithAi("I have a fever", { client: null, answers, followUpState })).level);
    }
    assert.deepEqual(new Set(levels), new Set(["urgent"]));
  });
});

describe("the model's pick in its reply", () => {
  const raw = (nextQuestionId) => JSON.stringify({ level: "routine", reasons: ["Fine."], nextQuestionId });
  test("an id, or null when it is confident", () => {
    assert.equal(parseModelReply(raw("severity")).nextQuestionId, "severity");
    assert.equal(parseModelReply(raw(" Severity ")).nextQuestionId, "severity");
    for (const confident of [null, "null", "none", "NONE"]) assert.equal(parseModelReply(raw(confident)).nextQuestionId, null, String(confident));
  });

  test("anything else is dropped without rejecting the reply, so the planner asks by its own order", () => {
    for (const odd of [42, ["severity"], { id: "severity" }, "how bad is it?", "", "x".repeat(41)]) {
      const reply = parseModelReply(raw(odd));
      assert.equal(reply.nextQuestionId, undefined, JSON.stringify(odd));
      assert.equal(reply.level, "routine");
    }
    assert.equal("nextQuestionId" in parseModelReply(JSON.stringify({ level: "routine", reasons: ["Fine."] })), false, "a reply without it looks as before");
  });
});

describe("the prompt", () => {
  test("the model is told to pick one approved id or null, never to invent a question", () => {
    assert.match(SYSTEM_PROMPT, /11\. "nextQuestionId"/);
    assert.match(SYSTEM_PROMPT, /Never invent a question or an id/);
    assert.match(SYSTEM_PROMPT, /"nextQuestionId": "one id from the approved follow-up questions listed, or null"/);
  });

  test("lists this round's approved questions with their ids, or says none are left", () => {
    const [, withChoices] = buildMessages({
      symptoms: "a cough", minimumLevel: "routine",
      followUp: { round: 1, maxRounds: 3, choices: [{ id: "severity", text: "How bad are the symptoms right now?", answers: ["Mild", "Severe"] }] },
    });
    assert.match(withChoices.content, /Follow-up round 2 of at most 3\. Approved questions you may ask next/);
    assert.match(withChoices.content, /- "severity": How bad are the symptoms right now\? \(answers: Mild; Severe\)/);
    const [, none] = buildMessages({ symptoms: "a cough", minimumLevel: "routine", followUp: { round: 3, maxRounds: 3, choices: [] } });
    assert.match(none.content, /No follow-up questions are left to ask: set nextQuestionId to null\./);
    assert.ok(withChoices.content.indexOf("Follow-up round") < withChoices.content.indexOf("<symptoms>"), "before the user's text");
  });
});

describe("a whole check, round by round (fake model)", () => {
  test("asks one question per round, sends every answer so far, and stops at 3 rounds", async () => {
    // A model that always asks for one more question, in the order it is offered.
    const model = fakeModel((messages) => {
      const offered = [...messages[1].content.matchAll(/^- "([a-z0-9-]+)":/gm)].map((m) => m[1]);
      return { level: "soon", reasons: ["A fever should be checked."], nextQuestionId: offered[0] ?? null };
    });
    const symptoms = "I have a fever";
    let result = await assessWithAi(symptoms, { client: model });
    const answers = {};
    const shown = [];
    while (result.followUpQuestions.length > 0) {
      assert.equal(result.followUpQuestions.length, 1);
      const [{ id }] = result.followUpQuestions;
      shown.push(id);
      answers[id] = calmAnswer(id);
      result = await assessWithAi(symptoms, { client: model, answers: { ...answers }, followUpState: result.followUpState });
    }
    assert.deepEqual(shown, ["fever-temperature", "risk-group", "severity"]);
    assert.equal(result.followUpState.decision, "max_rounds");
    assert.match(model.calls[1][1].content, /Follow-up round 2 of at most 3/);
    assert.doesNotMatch(model.calls[1][1].content, /- "fever-temperature":/, "an answered question isn't offered again");
    assert.match(model.calls[1][1].content, /Follow-up answers chosen by the user:\n- What is the highest temperature you measured\? -> /);
  });

  test("stops as soon as the model is confident", async () => {
    const model = fakeModel((messages, n) => ({ level: "soon", reasons: ["A fever should be checked."], nextQuestionId: n === 1 ? "fever-temperature" : null }));
    const first = await assessWithAi("I have a fever", { client: model });
    const second = await assessWithAi("I have a fever", { client: model, answers: { "fever-temperature": "38-39" }, followUpState: first.followUpState });
    assert.deepEqual(second.followUpQuestions, []);
    assert.equal(second.followUpState.decision, "model_confident");
  });

  test("an answer that reveals an emergency ends the questions at once", async () => {
    const model = fakeModel({ level: "soon", reasons: ["Breathlessness should be checked."], nextQuestionId: "breath-at-rest" });
    const first = await assessWithAi(TWO_SAFETY, { client: model });
    assert.deepEqual(first.followUpQuestions.map((q) => q.id), ["breath-at-rest"]);
    const calls = model.calls.length;
    const second = await assessWithAi(TWO_SAFETY, { client: model, answers: { "breath-at-rest": "yes" }, followUpState: first.followUpState });
    assert.equal(second.level, "emergency");
    assert.deepEqual(second.followUpQuestions, []);
    assert.equal(model.calls.length, calls, "and the model isn't even asked");
  });

  test("answers still only ever raise the level, round by round", async () => {
    const model = fakeModel({ level: "routine", reasons: ["Fine."], nextQuestionId: "severity" });
    const first = await assessWithAi("I have a fever", { client: model });
    const second = await assessWithAi("I have a fever", { client: model, answers: { severity: "mild" }, followUpState: first.followUpState });
    assert.equal(second.level, refineUrgency("I have a fever", { severity: "mild" }).level);
    assert.equal(second.level, "soon", "the rules' soon, not the model's routine");
  });

  test("if the model fails in round 2, the rest of the approved questions come together", async () => {
    const model = fakeModel((messages, n) => (n === 1 ? { level: "soon", reasons: ["A fever should be checked."], nextQuestionId: "fever-temperature" } : new LlmError("timeout")));
    const first = await assessWithAi("I have a fever", { client: model });
    const second = await assessWithAi("I have a fever", { client: model, answers: { "fever-temperature": "38-39" }, followUpState: first.followUpState });
    assert.equal(second.ai.used, false);
    assert.deepEqual(second.followUpQuestions.map((q) => q.id), ["risk-group", "severity", "duration", "trend"]);
  });
});

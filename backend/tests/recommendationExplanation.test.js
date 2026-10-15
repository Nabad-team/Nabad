// SCRUM-130 (backlog #29): "As a user, I want a plain-language explanation of why a recommendation
// was given so that I trust the result."
// Part 1 tests explainUrgency directly. Part 2 checks that /classify, /refine and /ai-assess return it.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");
const { explainUrgency, WATCH_FOR, MAX_TRIGGERS, MAX_NOT_COUNTED } = require("../src/triage/explanation");
const { classifyUrgency, LEVELS, RULES } = require("../src/triage/urgency");
const { refineUrgency } = require("../src/triage/followUps");
const { assessWithAi } = require("../src/triage/ai/aiTriage");

const explain = (symptoms, answers) => {
  const result = answers ? refineUrgency(symptoms, answers) : classifyUrgency(symptoms);
  return explainUrgency({ symptoms, result, answers });
};
const fakeModel = (reply) => ({ complete: async () => JSON.stringify({ careType: "General practitioner", selfCare: [], ...reply }) });
// Everything the user reads, as one string.
const allText = (e) => [e.summary, e.basedOn, ...e.watchFor, ...e.triggers.flatMap((t) => [...t.words, t.meaning]),
  ...e.changedBy.flatMap((c) => [c.question, c.answer, c.effect]), ...e.notCounted].join(" ");

describe("the summary sentence", () => {
  test("says what we suggest, in everyday words, for every level", () => {
    const cases = {
      emergency: ["I have chest pain", /^We suggest getting emergency care now because/],
      urgent: ["I fell and hit my head", /^We suggest getting seen by a doctor today because/],
      soon: ["a rash on my arm", /^We suggest seeing a doctor in the next day or two because/],
      routine: ["runny nose", /^We suggest looking after yourself at home for now because/],
    };
    for (const [level, [symptoms, pattern]] of Object.entries(cases)) {
      assert.equal(classifyUrgency(symptoms).level, level);
      assert.match(explain(symptoms).summary, pattern, level);
    }
  });

  test("quotes the user's own words that led to the result", () => {
    assert.equal(explain("I have crushing chest pain and sweating").summary,
      "We suggest getting emergency care now because you mentioned “chest pain”.");
    assert.equal(explain("runny nose and sneezing").summary,
      "We suggest looking after yourself at home for now because you mentioned “runny nose” and “sneezing”.");
  });

  test("a combination rule quotes both parts", () => {
    assert.match(explain("Fever and a stiff neck since this morning").summary, /“fever” and “stiff neck”/);
  });

  test("keeps the sentence short when many things matched", () => {
    // Five phrases match (fever, temperature, ear pain, earache, for a week): three are quoted.
    const summary = explain("fever and a high temperature, ear pain and earache for a week").summary;
    assert.equal((summary.match(/“/g) || []).length, 3);
    assert.match(summary, /and more\.$/);
  });

  test("is honest when nothing matched a warning sign", () => {
    assert.equal(explain("something feels off with my elbow").summary,
      "We suggest looking after yourself at home for now because nothing you described matched a known warning sign.");
  });

  test("names the follow-up answers that made it more urgent", () => {
    assert.equal(explain("I have a fever", { "fever-temperature": "39.5-plus" }).summary,
      "We suggest getting seen by a doctor today because of your answer “39.5°C or higher”.");
  });

  test("is one sentence of at most 30 words, with no technical terms or rule ids", () => {
    for (const symptoms of ["I have chest pain", "high fever and shivering", "rash", "sneezing", "xyz", "fever and stiff neck"]) {
      const e = explain(symptoms);
      assert.equal((e.summary.match(/\./g) || []).length, 1, e.summary);
      assert.ok(e.summary.split(/\s+/).length <= 30, e.summary);
      assert.doesNotMatch(allText(e), /\b(triage|classif\w*|confidence|rule[- ]?id|matchedRuleIds|routine|soon|urgent|emergency_rule)\b/i, symptoms);
    }
  });
});

describe("what you told us (triggers)", () => {
  test("lists the matched words with what they can mean", () => {
    const { triggers } = explain("I have chest pain");
    assert.deepEqual(triggers, [{ words: ["chest pain"], meaning: "Chest pain or pressure can be a sign of a heart attack." }]);
  });

  test("only shows triggers for the result's level, so a runny nose is not listed next to chest pain", () => {
    const { triggers } = explain("runny nose, fever and now chest pain");
    assert.deepEqual(triggers.map((t) => t.words), [["chest pain"]]);
  });

  test("does not list a phrase already inside a longer one", () => {
    const words = explain("my dad cannot breathe and is gasping").triggers.flatMap((t) => t.words);
    assert.deepEqual(words, ["cannot breathe", "gasping"]);
  });

  test("is limited in number", () => {
    const { triggers } = explain("chest pain, can't breathe, slurred speech, seizure, heavy bleeding, overdose");
    assert.equal(triggers.length, MAX_TRIGGERS);
  });

  test("is empty when nothing matched", () => {
    assert.deepEqual(explain("something feels off").triggers, []);
  });
});

describe("what was not counted", () => {
  test("shows warning signs the user said they do not have", () => {
    assert.deepEqual(explain("runny nose, no chest pain and no trouble breathing").notCounted, ["chest pain", "trouble breathing"]);
    assert.deepEqual(explain("sore throat without a high fever").notCounted, ["high fever"]);
  });

  test("never lists a warning sign that was counted", () => {
    const e = explain("I'm not sure but I have chest pain");
    assert.deepEqual(e.notCounted, []);
    assert.deepEqual(e.triggers[0].words, ["chest pain"]);
  });

  test("ignores mild symptoms said in the negative and is limited in number", () => {
    assert.deepEqual(explain("fever but no cough").notCounted, []);
    const many = explain("no chest pain, no seizure, no overdose, no head injury, no high fever").notCounted;
    assert.equal(many.length, MAX_NOT_COUNTED);
  });
});

describe("follow-up answers that changed the result", () => {
  test("lists each answer that raised the level, with the question and why", () => {
    const { changedBy } = explain("I have a fever", { "fever-temperature": "39.5-plus", severity: "mild" });
    assert.deepEqual(changedBy, [{
      question: "What is the highest temperature you measured?",
      answer: "39.5°C or higher",
      effect: "A temperature of 39.5°C or higher should be checked today.",
    }]);
  });

  test("lists nothing when the answers did not change the level", () => {
    assert.deepEqual(explain("I have a fever", { "fever-temperature": "under-38", severity: "mild" }).changedBy, []);
  });

  test("includes a risk factor that raised the level by one step", () => {
    const { changedBy } = explain("runny nose", { "risk-group": "yes" });
    assert.equal(changedBy.length, 1);
    assert.equal(changedBy[0].question.startsWith("Does any of these apply"), true);
  });

  test("lists nothing without answers", () => {
    assert.deepEqual(explain("I have a fever").changedBy, []);
  });
});

describe("what to watch for", () => {
  test("every non-emergency result says when to call 140", () => {
    for (const symptoms of ["I fell and hit my head", "a rash", "runny nose", "xyz"]) {
      const { watchFor } = explain(symptoms);
      assert.match(watchFor[0], /^Call 140 straight away if you get chest pain, trouble breathing/, symptoms);
      assert.equal(watchFor.length, 2);
    }
  });

  test("an emergency says not to wait", () => {
    assert.deepEqual(explain("I have chest pain").watchFor, WATCH_FOR.emergency);
    assert.match(WATCH_FOR.emergency[0], /Don't wait/);
  });

  test("each level has its own advice on when to get help sooner", () => {
    const seconds = Object.keys(LEVELS).filter((l) => l !== "emergency").map((l) => WATCH_FOR[l][1]);
    assert.equal(new Set(seconds).size, seconds.length);
  });
});

describe("what it was based on", () => {
  test("rules only, or rules and answers", () => {
    assert.match(explain("a rash").basedOn, /^Nabad's safety rules, which look for known warning signs in what you wrote\.$/);
    assert.match(explain("I have a fever", { severity: "mild" }).basedOn, /and your answers to the follow-up questions/);
  });

  test("an AI check that raised the level is named in the summary and the basis", async () => {
    const symptoms = "sore throat and I can barely swallow my saliva";
    const result = await assessWithAi(symptoms, { client: fakeModel({ level: "urgent", reasons: ["Trouble swallowing saliva should be checked today."] }) });
    const e = explainUrgency({ symptoms, result });
    assert.equal(e.summary, "We suggest getting seen by a doctor today because an AI check of your description found signs that need quicker care.");
    assert.match(e.basedOn, /AI can only make the advice more cautious, never less/);
  });

  test("an AI check that was overruled says the safety rules come first", async () => {
    const symptoms = "I fell and hit my head";
    const result = await assessWithAi(symptoms, { client: fakeModel({ level: "routine", reasons: ["Nothing serious."] }) });
    const e = explainUrgency({ symptoms, result });
    assert.match(e.summary, /getting seen by a doctor today because you mentioned “hit my head”/);
    assert.match(e.basedOn, /AI suggested something less urgent, but the safety rules come first/);
  });

  test("says when the AI check was skipped for an emergency or unavailable, and says nothing when it is off", async () => {
    const emergency = await assessWithAi("I have chest pain", { client: fakeModel({ level: "routine", reasons: ["x"] }) });
    assert.match(explainUrgency({ symptoms: "I have chest pain", result: emergency }).basedOn, /didn't wait for an AI check/);
    const failed = await assessWithAi("a rash", { client: { complete: async () => "not json" } });
    assert.match(explainUrgency({ symptoms: "a rash", result: failed }).basedOn, /AI check wasn't available this time/);
    const off = await assessWithAi("a rash");
    assert.doesNotMatch(explainUrgency({ symptoms: "a rash", result: off }).basedOn, /AI/);
  });
});

describe("safety of the explanation", () => {
  test("never quotes anything the user typed beyond the app's own phrase list", () => {
    const e = explain("<script>alert(1)</script> chest pain and SECRET-WORDS");
    assert.doesNotMatch(allText(e), /script|alert|SECRET-WORDS/i);
  });

  test("an unknown level falls back to the home-care wording instead of failing", () => {
    const e = explainUrgency({ symptoms: "xyz", result: { level: "nonsense" } });
    assert.match(e.summary, /^We suggest looking after yourself at home/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("the endpoints return the explanation", () => {
  let mongod, server, base, cookie;
  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    await User.init();
    const { createApp } = require("../src/app");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/triage`;
    const account = await User.create({ name: "Rana", email: "rana-explain@example.test", passwordHash: "x" });
    cookie = jwt.sign({ sub: String(account._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  }, { timeout: 240000 });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });
  beforeEach(() => { delete process.env.LLM_API_URL; });

  async function call(path, body) {
    const response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${cookie}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  test("POST /classify", async () => {
    const res = await call("classify", { symptoms: "runny nose, no chest pain" });
    assert.equal(res.status, 200);
    assert.match(res.body.explanation.summary, /you mentioned “runny nose”/);
    assert.deepEqual(res.body.explanation.notCounted, ["chest pain"]);
    assert.ok(res.body.followUpQuestions.length > 0); // existing fields unchanged
  });

  test("POST /refine", async () => {
    const res = await call("refine", { symptoms: "I have a fever", answers: { "fever-temperature": "39.5-plus" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "urgent");
    assert.equal(res.body.explanation.changedBy[0].answer, "39.5°C or higher");
  });

  test("POST /ai-assess (AI off)", async () => {
    const res = await call("ai-assess", { symptoms: "a rash on my arm" });
    assert.equal(res.status, 200);
    assert.match(res.body.explanation.summary, /seeing a doctor in the next day or two because you mentioned “rash”/);
  });

  test("invalid answers are still refused before any explanation is built", async () => {
    assert.equal((await call("refine", { symptoms: "I have a fever", answers: { nope: "x" } })).status, 400);
  });
});

// SCRUM-125 (backlog #24): "As a user, I want to describe my symptoms in natural language, by text
// or voice, so that the AI understands my situation."
// Part 1: everyday wording reaches the right urgency. Part 2: what must NOT change it.
// Part 3: the explanation and follow-ups. Part 4: the AI endpoint over HTTP.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { createTestMongo } = require("./helpers/testMongo");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../src/models/User");
const { classifyUrgency, normalise, RULES } = require("../src/triage/urgency");
const { EVERYDAY_WORDING } = require("../src/triage/everydayWording");
const { getFollowUpQuestions } = require("../src/triage/followUps");
const { explainUrgency } = require("../src/triage/explanation");

const levelOf = (text) => classifyUrgency(text).level;
const expectLevel = (level, sentences) => {
  for (const text of sentences) assert.equal(levelOf(text), level, text);
};

describe("everyday wording reaches the right urgency", () => {
  test("emergencies described in everyday words", () => {
    expectLevel("emergency", [
      "my chest hurts really bad",
      "my chest is hurting and my left arm feels weird",
      "there's a lot of pressure in my chest",
      "it feels like an elephant is sitting on my chest",
      "I cant catch my breath",
      "im having a hard time breathing",
      "he collapsed and wont wake up",
      "my dad isn't breathing",
      "she is having a fit",
      "my face feels numb on one side",
      "he cant talk properly all of a sudden",
      "her speech is slurred",
      "one side of his face is drooping",
      "im bleeding a lot and it wont stop",
      "i dont want to live anymore",
      "i keep thinking about hurting myself",
      "my throat feels like its closing",
      "my lips are swelling up after eating nuts",
      "my baby is turning blue",
      "she took too many pills",
      "worst headache of my life came on suddenly",
    ]);
  });

  test("urgent problems described in everyday words", () => {
    expectLevel("urgent", [
      "i have a really high temperature of 40",
      "temp is 39.8",
      "my stomach hurts so much i cant stand up",
      "terrible stomach pain on the right",
      "i cant keep anything down",
      "throwing up everything i drink",
      "i think i broke my arm",
      "my wrist might be broken",
      "i banged my head on the door",
      "he fell on his head",
    ]);
  });

  test("things to see a doctor about soon, in everyday words", () => {
    expectLevel("soon", [
      "im burning up",
      "i feel feverish",
      "i threw up twice this morning",
      "my ear hurts",
      "it burns when i pee",
      "ive had a cough for 2 weeks",
      "my knee has been sore for 5 days",
    ]);
  });

  test("mild things stay routine", () => {
    expectLevel("routine", ["i have a stuffy nose", "my throat is a bit sore", "i feel a bit tired", "im sneezing a lot"]);
  });

  test("voice-style transcripts with no punctuation or apostrophes are understood", () => {
    assert.equal(levelOf("um so my chest is really hurting and i cant catch my breath"), "emergency");
    assert.equal(levelOf("i dont know its like my stomach is killing me"), "urgent");
  });

  test("everyday wording counts in combination rules too (fever + stiff neck)", () => {
    assert.equal(levelOf("im burning up and i have a stiff neck"), "emergency");
  });
});

describe("what must not change the urgency", () => {
  test("harmless sentences that look similar are not over-triaged", () => {
    expectLevel("routine", [
      "my bruise turned blue",
      "i hurt myself playing football, just a small graze",
      "my stomach pain is much better now",
      "my dad had a heart attack years ago, i have a cold",
      "my car is blue and i have a runny nose",
    ]);
  });

  test("negated everyday wording does not count", () => {
    expectLevel("routine", [
      "my chest doesnt hurt anymore, just a runny nose",
      "im not bleeding a lot, just a small cut",
      "not having a hard time breathing, only sneezing",
    ]);
  });

  test("a negation does not cross a comma: in 'no cough, chest pain' the chest pain counts", () => {
    assert.equal(levelOf("no cough, chest pain"), "emergency");
    assert.equal(levelOf("no fever, no chest pain, just tired"), "routine");
  });

  test("contractions typed without apostrophes still work as negations", () => {
    assert.equal(levelOf("i dont have a fever, just a sore throat"), "routine");
    assert.equal(classifyUrgency("i dont have a fever").matchedRuleIds.includes("fever"), false);
  });

  test("normalise adds the apostrophes and turns punctuation into clause breaks", () => {
    assert.equal(normalise("I CANT breathe, it WONT stop!"), "i can't breathe . it won't stop .");
    assert.equal(normalise("im ok ive been fine"), "i'm ok i've been fine");
    assert.equal(normalise("fever of 39.5"), "fever of 39.5"); // decimals are kept
  });

  test("every everyday-wording entry means a phrase the rules know", () => {
    const known = new Set(RULES.flatMap((rule) => rule.any || rule.all));
    for (const { means, patterns } of EVERYDAY_WORDING) {
      assert.ok(known.has(means), `"${means}" is not a rule phrase`);
      assert.ok(patterns.length > 0, means);
    }
  });
});

// SCRUM-282: wording added after the triage quality test set (tests/triage-quality) found it was missed.
describe("wording found by the triage quality test set", () => {
  test("now reaches the right level", () => {
    expectLevel("emergency", [
      "he swallowed a tiny round battery",
      "my toddler ate one of those small round batteries",
      "my neck is so stiff and i have a fever",
      "fever and i cant bend my neck forward",
      "her skin looks blotchy and bluish",
      "sudden sharp pain in his right testicle",
      "i was in a car accident this morning and my neck hurts",
      "car crash last year, and today i was hit by a car",
    ]);
    expectLevel("urgent", [
      "my 3 week old baby has a temperature of 38.5",
      "my 2 month old feels hot, temperature 100.6",
      "my baby is 7 weeks old and her temperature is 38.3",
      "severe pain in my upper left abdomen",
      "really bad pain in the lower right side of my belly",
      "i cant keep even water down",
      "my wrist is swollen and looks bent",
      "my arm is at a weird angle after i fell",
      "cut my hand on glass, it's deep",
      "i can see the bone in my finger",
      "my son hit his head an hour ago and threw up",
    ]);
    expectLevel("soon", [
      "my ears have been aching all week",
      "my ear has been hurting since yesterday",
      "cough for more than a week",
      "sore throat for over a week now",
      "back pain for months",
      "headaches since my car accident last year",
    ]);
  });

  test("harmless sentences that look similar are not raised", () => {
    expectLevel("routine", [
      "my skin looks a bit blotchy after the shower",
      "i can see white spots on my tonsils",
      "my 6 week old has no fever but is a bit fussy",
      "my neck is stiff from sleeping in a weird position",
      "i swallowed my pills before charging the batteries",
      "small cut on my finger, it is not very deep",
      "the cut isnt deep",
      "my toenail is deformed",
    ]);
  });

  test("an injury from long ago is history, not an emergency now", () => {
    expectLevel("routine", [
      "i fell off a ladder 2 years ago and now my knee hurts sometimes",
      "i hit my head last year and want to know about my cold",
    ]);
    // Only within its own clause: a new injury in another clause still counts.
    assert.equal(levelOf("headaches since my car accident last year. today i was stabbed"), "emergency");
  });
});

describe("what was understood, and the explanation", () => {
  test("the result lists the everyday wording and what it was taken to mean", () => {
    const { understood } = classifyUrgency("my chest hurts and i cant catch my breath");
    assert.deepEqual(understood, [
      { said: "chest hurts", means: "chest pain" },
      { said: "can't catch my breath", means: "can't breathe" },
    ]);
    assert.deepEqual(classifyUrgency("a runny nose").understood, []);
  });

  test("the explanation quotes the user's own words", () => {
    const symptoms = "my chest hurts really bad";
    const e = explainUrgency({ symptoms, result: classifyUrgency(symptoms) });
    assert.equal(e.summary, "We suggest getting emergency care now because you mentioned “chest hurts”.");
  });

  test("a warning sign counted through everyday wording is never listed as 'not counted'", () => {
    const symptoms = "no chest pain earlier, but now my chest hurts";
    const e = explainUrgency({ symptoms, result: classifyUrgency(symptoms) });
    assert.deepEqual(e.notCounted, []);
  });

  test("an emergency in everyday words gets no follow-up questions", () => {
    const result = classifyUrgency("i cant catch my breath");
    assert.deepEqual(getFollowUpQuestions("i cant catch my breath", result), []);
  });
});

// ---------------------------------------------------------------------------------------------
describe("POST /api/triage/ai-assess with everyday wording (AI off)", () => {
  let mongod, server, base, cookie;
  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.CLIENT_ORIGIN = "http://localhost:3000";
    delete process.env.LLM_API_URL;
    mongod = await createTestMongo();
    process.env.MONGO_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    await User.init();
    const { createApp } = require("../src/app");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/triage/ai-assess`;
    const account = await User.create({ name: "Rana", email: "rana-natural@example.test", passwordHash: "x" });
    cookie = jwt.sign({ sub: String(account._id), ver: 0 }, process.env.JWT_SECRET, { expiresIn: "15m" });
  }, { timeout: 240000 });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test("an emergency in everyday words gets the call-140 result straight away", async () => {
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${cookie}` },
      body: JSON.stringify({ symptoms: "my chest hurts really bad", location: { country: "LB" } }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.level, "emergency");
    assert.equal(body.emergency.contactNumber, "140");
    assert.match(body.explanation.summary, /“chest hurts”/);
  });
});

// SCRUM-309: wording added after the triage clinical safety set (tests/triage-safety) found it was missed.
// One sentence per new pattern in everydayWording.js, and sentences that must stay as they were.
describe("wording found by the triage clinical safety set", () => {
  test("emergencies", () => {
    expectLevel("emergency", [
      "pain in the middle of my chest",
      "my chest feels heavy",
      "my chest has been really tight since this morning",
      "out of breath even when sitting down",
      "i cant finish a sentence without stopping for breath",
      "too breathless to talk",
      "the skin under her ribs is sucking in",
      "her ribs are pulling in when she breathes",
      "my baby is breathing really fast and grunting",
      "my words are coming out wrong",
      "his speech was slurred for a few minutes",
      "my right hand suddenly went numb",
      "his arm went weak",
      "she still isnt waking up",
      "he was knocked out playing rugby",
      "my baby is very floppy",
      "my grandad fell down the stairs",
      "my dad hit his head and now hes confused",
      "i threw up blood",
      "theres blood in my vomit",
      "my tongue feels swollen",
      "my face is swelling up after a bee sting",
      "spots that dont fade when i press a glass on them",
      "my son wants to die",
      "she said she wants to kill herself",
      "he is talking about hurting himself",
      "she took a whole pack of paracetamol",
      "he swallowed a handful of sleeping pills",
      "my toddler drank some bleach",
      "my son feels cold to the touch and his skin is mottled",
      "he spilled boiling water over himself",
      "she burned her arm on the stove and the skin is peeling off",
      "numbness around my bottom",
      "back pain and now i cant control my bladder",
      "im pregnant with pain in the tip of my shoulder",
      "sudden terrible pain in his testicle",
    ]);
  });

  test("urgent problems", () => {
    expectLevel("urgent", [
      "the pain moved to the lower right of my belly",
      "my toddler hasnt had a wet nappy since this morning",
      "his nappies are dry",
      "she hasnt peed all day",
      "i cant put any weight on my ankle",
      "cant walk on my ankle after twisting it",
      "got oven cleaner in my eye",
      "im pregnant and spotting",
      "my testicle has been swollen since yesterday",
      "an ache in my left testicle",
      "im pregnant with a sharp pain on my right side",
      "pregnant and seeing flashing lights",
      "pregnant and my vision is blurry",
      "pregnant and my feet suddenly swelled up",
      "pregnant with a headache that paracetamol doesnt help",
      "pregnant with pain under my ribs",
      "fever and pain in my back on the right side",
      "fever and right sided back pain",
      "fever and kidney pain",
      "using my blue inhaler every 2 hours",
      "my inhaler isnt helping",
      "fever and short of breath",
      "temp is 39 and im out of breath",
    ]);
  });

  test("a measured temperature of 38 or more counts as a fever", () => {
    expectLevel("soon", ["temp is 38.4", "temperature of 39"]);
  });

  test("harmless sentences that look similar are not raised", () => {
    expectLevel("routine", [
      "im a bit confused about when to take my vitamins",
      "a swollen face from a tooth, no fever",
      "my leg went numb after sitting cross legged, it's fine now",
      "my chest feels fine, just a runny nose",
      "i walked down the stairs and feel fine",
      "the stairs are steep",
      "my shoulder hurts after the gym",
      "my back aches after moving furniture",
      "i walked up the stairs and got out of breath",
    ]);
    // A rash that lasts is still a rash to see a doctor about, but the glass test was not described.
    assert.equal(levelOf("a rash that doesnt fade after a week, no fever"), "soon");
  });
});

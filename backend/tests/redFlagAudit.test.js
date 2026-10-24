// SCRUM-281: "Red-flag rules: add black or bloody stools and other missing warning signs, and audit
// every rule against the AI's emergency findings (incl. tests)."
//
// Why this matters: the rules in urgency.js are the safety net. When the AI is off, unreachable,
// too slow, or its reply fails the guardrails, the rules answer alone (aiTriage.js). So every
// warning sign the AI would treat as an emergency must also be caught by the rules on their own.
//
// The audit has four parts:
//   1. AUDIT below lists the emergency and urgent warning signs the AI is expected to flag, each
//      with everyday sentences. Every sentence must reach that level from the rules alone.
//   2. Every emergency and urgent rule must appear in AUDIT, so no rule goes unchecked.
//   3. Every phrase of every rule (all levels) must work on its own, and be cancelled by "no".
//   4. With a model attached, the AI can never lower an audited case, and when the AI finds an
//      emergency the rules missed, the result is flagged (ai.ruleGap) so the gap can be fixed.
//
// Running 43 warning-sign scenarios through the rules before this ticket: 31 were under-triaged and
// 28 of those came out "routine" (black stools, bloody stools, coffee-ground vomit, sudden confusion,
// loss of vision, a caregiver reporting "my mother is having a stroke"...).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { classifyUrgency, RULES } = require("../src/triage/urgency");
const { assessWithAi } = require("../src/triage/ai/aiTriage");

const ORDER = ["routine", "soon", "urgent", "emergency"]; // least to most serious

// { rule, level, says }: the rule id that must match and the level the sentences must reach.
const AUDIT = [
  // ---------- Emergency: rules that already existed ----------
  { rule: "chest-pain", level: "emergency", says: ["I have chest pain", "my chest hurts and it spreads to my left arm"] },
  { rule: "suspected-heart-attack", level: "emergency", says: ["I think I'm having a heart attack"] },
  { rule: "breathing", level: "emergency", says: ["I can't breathe", "my lips are turning blue"] },
  { rule: "stroke", level: "emergency", says: ["my face is drooping and my speech is slurred", "sudden weakness on one side of my body"] },
  { rule: "suspected-stroke", level: "emergency", says: ["I think my mother is having a stroke"] },
  { rule: "consciousness", level: "emergency", says: ["he fainted and is unresponsive", "she is having a seizure"] },
  { rule: "bleeding", level: "emergency", says: ["the bleeding won't stop", "I am vomiting blood", "I'm coughing up blood"] },
  { rule: "anaphylaxis", level: "emergency", says: ["my throat is closing and my tongue is swollen", "I'm having a severe allergic reaction"] },
  { rule: "worst-headache", level: "emergency", says: ["the worst headache of my life", "a sudden severe headache"] },
  { rule: "meningitis", level: "emergency", says: ["I have a fever and a stiff neck"] },
  { rule: "self-harm", level: "emergency", says: ["I want to end my life"] },
  { rule: "poisoning", level: "emergency", says: ["I took too many pills", "my son swallowed bleach"] },

  // ---------- Emergency: added in SCRUM-281 ----------
  { rule: "gi-bleeding", level: "emergency", says: [
    "I have black tarry stools", "my poop is black", "my stool is black and sticky", "there is dark red blood in my stool",
    "maroon coloured stool", "my vomit looks like coffee grounds", "coffee ground vomit",
  ] },
  { rule: "confusion", level: "emergency", says: [
    "my mother is suddenly confused", "sudden confusion", "my dad seems very confused and is talking nonsense",
    "she doesn't know where she is",
  ] },
  { rule: "vision-loss", level: "emergency", says: [
    "I suddenly lost vision in one eye", "sudden loss of vision", "I went blind in my left eye", "I can't see out of my right eye",
  ] },
  { rule: "sepsis", level: "emergency", says: ["his skin looks mottled and he is very drowsy", "I think it could be sepsis", "her skin has gone grey"] },
  { rule: "major-injury", level: "emergency", says: [
    "I fell from a height and can't feel my legs", "he fell off a ladder", "she was hit by a car", "I was in a car accident",
    "he was stabbed", "I got an electric shock", "I have a severe burn", "my arm was badly burned",
  ] },
  { rule: "testicle-sudden", level: "emergency", says: ["sudden severe pain in my testicle", "sudden sharp pain in my testicle"] },
  { rule: "swallowed-object", level: "emergency", says: ["my child swallowed a battery", "my toddler swallowed magnets", "he ate a button battery"] },
  { rule: "baby-not-moving", level: "emergency", says: [
    "I'm pregnant and my baby stopped moving", "I haven't felt the baby move today", "the baby is moving less than usual",
  ] },

  // ---------- Urgent: rules that already existed ----------
  { rule: "high-fever", level: "urgent", says: ["I have a high fever", "my temperature is 40"] },
  { rule: "severe-abdominal", level: "urgent", says: ["severe stomach pain", "my stomach is killing me"] },
  { rule: "dehydration", level: "urgent", says: ["I can't keep anything down"] },
  { rule: "injury", level: "urgent", says: ["I think I have a broken bone", "I hit my head"] },
  { rule: "pregnancy", level: "urgent", says: ["I'm pregnant and bleeding"] },

  // ---------- Urgent: added in SCRUM-281 ----------
  { rule: "blood-in-stool", level: "urgent", says: [
    "there is blood in my stool", "bloody stools since this morning", "blood when I poop", "bloody diarrhea",
    "rectal bleeding", "blood on the toilet paper",
  ] },
  { rule: "young-infant-fever", level: "urgent", says: [
    "a newborn baby with a fever", "my 2 month old has a fever", "our 6 week old girl is running a temperature",
    "fever in my newborn",
  ] },
  { rule: "urinary-retention", level: "urgent", says: ["I can't pee at all", "he hasn't been able to pee since yesterday"] },
  { rule: "eye-urgent", level: "urgent", says: ["severe pain in my eye", "I got bleach in my eye", "my eye hurts so much"] },
  { rule: "testicle-pain", level: "urgent", says: ["testicle pain", "my testicle is swollen"] },
];

// Sentences that mention a new warning sign but must NOT be treated as one.
const NOT_RED_FLAGS = [
  { says: "no blood in my stool and my poop is normal", notRule: "blood-in-stool" },
  { says: "my poop is not black", notRule: "gi-bleeding" },
  { says: "I'm confused about how many tablets to take", notRule: "confusion" },
  { says: "she is not confused", notRule: "confusion" },
  { says: "I had my flu shot yesterday", notRule: "major-injury" },
  { says: "my coffee tastes bitter", notRule: "gi-bleeding" },
  { says: "my 6 month old has a fever", notRule: "young-infant-fever" },
  { says: "my newborn has no fever", notRule: "young-infant-fever" },
  { says: "no pain in my testicle", notRule: "testicle-pain" },
];

const atLeast = (level, minimum) => ORDER.indexOf(level) >= ORDER.indexOf(minimum);

describe("1. every warning sign the AI is expected to flag is caught by the rules alone", () => {
  for (const { rule, level, says } of AUDIT) {
    test(`${rule} (${level})`, () => {
      for (const sentence of says) {
        const result = classifyUrgency(sentence);
        assert.ok(atLeast(result.level, level), `"${sentence}" is ${result.level}, expected at least ${level}`);
        assert.ok(result.matchedRuleIds.includes(rule), `"${sentence}" did not match ${rule} (matched: ${result.matchedRuleIds})`);
      }
    });
  }

  test("sentences that only look like a new warning sign do not trigger it", () => {
    for (const { says, notRule } of NOT_RED_FLAGS) {
      assert.ok(!classifyUrgency(says).matchedRuleIds.includes(notRule), `"${says}" wrongly matched ${notRule}`);
    }
  });

  test("black stools are an emergency, bloody stools are urgent, and a lot of blood is an emergency", () => {
    assert.equal(classifyUrgency("my stools are black").level, "emergency");
    assert.equal(classifyUrgency("there is blood in my stool").level, "urgent");
    assert.equal(classifyUrgency("there is a lot of blood in my stool").level, "emergency");
  });
});

describe("2. every warning-sign rule is audited", () => {
  test("every emergency and urgent rule has audit sentences", () => {
    const audited = new Set(AUDIT.map((entry) => entry.rule));
    for (const rule of RULES.filter((r) => r.level === "emergency" || r.level === "urgent")) {
      assert.ok(audited.has(rule.id), `${rule.id} has no audit sentences`);
    }
  });

  test("every audit entry names a real rule at the level it claims", () => {
    for (const { rule, level } of AUDIT) {
      const found = RULES.find((r) => r.id === rule);
      assert.ok(found, `${rule} is not a rule`);
      assert.equal(found.level, level, rule);
    }
  });

  test("rule ids are unique", () => {
    const ids = RULES.map((rule) => rule.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("3. every phrase of every rule works on its own", () => {
  for (const rule of RULES) {
    test(`${rule.id}: each phrase matches, and "no ..." cancels it`, () => {
      if (rule.all) {
        // Combination rules: all the phrases together match, one alone does not.
        assert.ok(classifyUrgency(rule.all.join(" and ")).matchedRuleIds.includes(rule.id), rule.id);
        assert.ok(!classifyUrgency(rule.all[0]).matchedRuleIds.includes(rule.id), rule.id);
        return;
      }
      for (const phrase of rule.any) {
        // A named emergency ("heart attack") only counts when it is happening now.
        const sentence = rule.currentEmergency ? `I think I am having a ${phrase}` : phrase;
        assert.ok(classifyUrgency(sentence).matchedRuleIds.includes(rule.id), `"${sentence}" did not match ${rule.id}`);
        assert.ok(!classifyUrgency(`no ${phrase}`).matchedRuleIds.includes(rule.id), `"no ${phrase}" still matched ${rule.id}`);
      }
    });
  }
});

describe("4. the rules hold against the AI, and the AI's emergency findings are flagged", () => {
  const modelSays = (level) => {
    const calls = [];
    return {
      calls,
      async complete(messages) {
        calls.push(messages);
        return JSON.stringify({ level, reasons: ["The model's assessment."], careType: "General practitioner", selfCare: [] });
      },
    };
  };

  test("an audited emergency is answered by the rules straight away, without waiting for the model", async () => {
    for (const { level, says } of AUDIT.filter((entry) => entry.level === "emergency")) {
      for (const sentence of says) {
        const model = modelSays("routine");
        const result = await assessWithAi(sentence, { client: model });
        assert.equal(result.level, level, sentence);
        assert.equal(model.calls.length, 0, `${sentence}: the model was asked`);
        assert.equal(result.ai.reason, "emergency_rule", sentence);
      }
    }
  });

  test("a model that says 'routine' can never lower an audited urgent case", async () => {
    for (const { says } of AUDIT.filter((entry) => entry.level === "urgent")) {
      for (const sentence of says) {
        const result = await assessWithAi(sentence, { client: modelSays("routine") });
        assert.ok(atLeast(result.level, "urgent"), `${sentence}: ${result.level}`);
      }
    }
  });

  test("when the AI finds an emergency the rules missed, the result is flagged as a rule gap", async () => {
    const result = await assessWithAi("my grandmother is very drowsy and dizzy", { client: modelSays("emergency") });
    assert.equal(result.ruleLevel, "routine");
    assert.equal(result.level, "emergency");
    assert.equal(result.ai.ruleGap, true);
  });

  test("no rule gap is flagged when the AI raises a case to less than an emergency, or agrees", async () => {
    const raised = await assessWithAi("my grandmother is very drowsy and dizzy", { client: modelSays("urgent") });
    assert.equal(raised.level, "urgent");
    assert.equal(raised.ai.ruleGap, undefined);
    const agreed = await assessWithAi("I have a runny nose", { client: modelSays("routine") });
    assert.equal(agreed.ai.ruleGap, undefined);
  });
});

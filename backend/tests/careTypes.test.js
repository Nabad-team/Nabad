// SCRUM-278: "As a user, I want triage to return a care-type ID so 'Find care' opens the directory
// filtered by the recommended specialty."
//
// Unit tests for triage/careTypes.js and how AI triage uses it. No database, no network: the model
// is always a fake.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { CARE_TYPES, DEFAULT_CARE_TYPE_ID, SPECIALTY_HINTS, hintedSpecialty, chooseCareTypeId, fitsLevel } = require("../src/triage/careTypes");
const { parseModelReply } = require("../src/triage/ai/guardrails");
const { SYSTEM_PROMPT } = require("../src/triage/ai/prompt");
const { assessWithAi } = require("../src/triage/ai/aiTriage");
const { LEVELS } = require("../src/triage/urgency");

const GENERAL = ["emergency-department", "urgent-care", "general-practitioner", "self-care"];
const reply = (body) => JSON.stringify({ level: "soon", reasons: ["The model's assessment."], careType: "General practitioner", selfCare: [], ...body });
const fakeModel = (answer) => ({ calls: 0, async complete() { this.calls += 1; return answer; } });

describe("the list of care types", () => {
  test("every specialist id is a specialty that exists in the provider directory", () => {
    const seeded = new Set(require("../data/providers").flatMap((provider) => provider.specialties));
    for (const id of Object.keys(CARE_TYPES).filter((id) => !GENERAL.includes(id))) {
      assert.ok(seeded.has(id), `${id} is not a directory specialty`);
    }
  });

  test("every care type is allowed for at least one real level, and every level has a default that fits it", () => {
    for (const [id, { label, levels }] of Object.entries(CARE_TYPES)) {
      assert.ok(label, id);
      assert.ok(levels.length > 0, id);
      for (const level of levels) assert.ok(Object.hasOwn(LEVELS, level), `${id}: ${level}`);
    }
    for (const level of Object.keys(LEVELS)) assert.ok(fitsLevel(DEFAULT_CARE_TYPE_ID[level], level), level);
  });

  test("only the emergency department fits an emergency", () => {
    for (const id of Object.keys(CARE_TYPES)) assert.equal(fitsLevel(id, "emergency"), id === "emergency-department", id);
  });

  test("every specialty hint points to a specialist care type", () => {
    for (const { id } of SPECIALTY_HINTS) assert.ok(Object.hasOwn(CARE_TYPES, id) && !GENERAL.includes(id), id);
  });

  test("the model is told every id it may choose", () => {
    for (const id of Object.keys(CARE_TYPES)) assert.ok(SYSTEM_PROMPT.includes(`"${id}"`), id);
    assert.match(SYSTEM_PROMPT, /"careTypeId"/);
  });
});

describe("specialty hints from the user's words", () => {
  const cases = [
    ["I have a rash on my arm", "dermatology"],
    ["my ear hurts", "ent"], // everyday wording for "ear pain"
    ["earache for two days", "ent"],
    ["my eyes are red and itchy, I think it's pink eye", "ophthalmology"],
    ["I twisted my ankle playing football", "orthopedics"],
    ["I keep getting palpitations", "cardiology"],
    ["I've had migraines all week", "neurology"],
    ["I think I have a hernia", "surgery"],
    ["I've been struggling with anxiety and panic attacks", "psychiatry"],
    // Who the patient is comes before the symptom.
    ["my baby has a rash", "pediatrics"],
    ["I'm pregnant and have back pain", "obstetrics-gynecology"],
    // A physical symptom decides over a worry next to it.
    ["I have anxiety about this rash", "dermatology"],
  ];
  for (const [symptoms, expected] of cases) {
    test(`"${symptoms}" -> ${expected}`, () => assert.equal(hintedSpecialty(symptoms), expected));
  }

  test("no hint when nothing points to a specialty, or the words are negated", () => {
    assert.equal(hintedSpecialty("I feel tired and have a cough"), null);
    assert.equal(hintedSpecialty("no rash, just tired"), null);
    assert.equal(hintedSpecialty("I crashed my bike"), null); // "rash" inside "crashed" does not count
  });
});

describe("choosing the care-type id", () => {
  test("an emergency always goes to the emergency department, whatever the model or the words say", () => {
    assert.equal(chooseCareTypeId({ level: "emergency", symptoms: "a rash and chest pain", modelCareTypeId: "dermatology" }), "emergency-department");
  });

  test("the model's id is used when it fits the level", () => {
    assert.equal(chooseCareTypeId({ level: "soon", symptoms: "my knee is swollen", modelCareTypeId: "orthopedics" }), "orthopedics");
  });

  test("the model's id is ignored when it does not fit the level: the words or the level decide instead", () => {
    assert.equal(chooseCareTypeId({ level: "urgent", symptoms: "I have a high fever", modelCareTypeId: "self-care" }), "urgent-care");
    assert.equal(chooseCareTypeId({ level: "urgent", symptoms: "a rash and a high fever", modelCareTypeId: "self-care" }), "dermatology");
  });

  test("an id that is not on the list is never used", () => {
    assert.equal(chooseCareTypeId({ level: "soon", symptoms: "tired", modelCareTypeId: "https://evil.example" }), "general-practitioner");
    assert.equal(chooseCareTypeId({ level: "soon", symptoms: "tired", modelCareTypeId: "__proto__" }), "general-practitioner");
  });

  test("without a model or a hint, each level gets its default", () => {
    assert.equal(chooseCareTypeId({ level: "urgent", symptoms: "I can't keep anything down" }), "urgent-care");
    assert.equal(chooseCareTypeId({ level: "soon", symptoms: "I have had a fever" }), "general-practitioner");
    assert.equal(chooseCareTypeId({ level: "routine", symptoms: "runny nose" }), "self-care");
  });
});

describe("the model's reply", () => {
  test("a listed id is kept, whatever its case or spacing", () => {
    const parsed = parseModelReply(reply({ careTypeId: " ENT " }));
    assert.equal(parsed.careTypeId, "ent");
    assert.deepEqual(parsed.removed, []);
  });

  test("an id that is not on the list is dropped and noted, but the reply is still accepted", () => {
    const parsed = parseModelReply(reply({ careTypeId: "Dr. Haddad's clinic" }));
    assert.equal(parsed.careTypeId, null);
    assert.deepEqual(parsed.removed, ["unknown_care_type_id"]);
    assert.equal(parsed.level, "soon");
  });

  test("a reply without an id is fine", () => {
    const parsed = parseModelReply(reply({}));
    assert.equal(parsed.careTypeId, null);
    assert.deepEqual(parsed.removed, []);
  });
});

describe("AI triage results", () => {
  test("with the AI off, the rules' result still has a care-type id", async () => {
    assert.equal((await assessWithAi("I have a rash on my arm")).careTypeId, "dermatology");
    assert.equal((await assessWithAi("I have chest pain")).careTypeId, "emergency-department");
    assert.equal((await assessWithAi("runny nose")).careTypeId, "self-care");
  });

  test("the model's id is used when its assessment is used", async () => {
    const result = await assessWithAi("my knee is swollen after a fall", { client: fakeModel(reply({ level: "soon", careTypeId: "orthopedics" })) });
    assert.equal(result.ai.used, true);
    assert.equal(result.careTypeId, "orthopedics");
  });

  test("the model's id is not used when the model said less serious than the rules", async () => {
    const result = await assessWithAi("I fell and hit my head", { client: fakeModel(reply({ level: "routine", careTypeId: "self-care" })) });
    assert.equal(result.level, "urgent");
    assert.deepEqual(result.ai.guardrails, ["model_lower_ignored"]);
    assert.equal(result.careTypeId, "urgent-care");
  });

  test("when the model raises a case to an emergency, its specialist id is replaced by the emergency department", async () => {
    const result = await assessWithAi("my grandmother is very drowsy and dizzy", { client: fakeModel(reply({ level: "emergency", careTypeId: "neurology" })) });
    assert.equal(result.level, "emergency");
    assert.equal(result.careTypeId, "emergency-department");
  });

  test("after follow-up answers raise the level, the id fits the new level", async () => {
    const result = await assessWithAi("I have a fever", { answers: { "fever-temperature": "39.5-plus" } });
    assert.equal(result.level, "urgent");
    assert.equal(result.careTypeId, "urgent-care");
  });
});

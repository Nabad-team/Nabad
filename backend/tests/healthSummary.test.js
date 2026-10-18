const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildHealthSummary, trackingText, ageFrom, ageText } = require("../src/healthProfile");

// The plain-text health summary that Nabad's guidance (triage) will use, built from a profile's facts.
const fact = (category, value, status = "confirmed") => ({ category, value, status });
const medication = (name, fields = {}) => ({ name, dose: "", unit: "", frequency: "", status: "active", ...fields });

test("says plainly when nothing is recorded", () => {
  assert.equal(buildHealthSummary({ age: null }), [
    "Age: not recorded", "Sex assigned at birth: not recorded", "Long-term conditions: none recorded",
    "Allergies: none recorded", "Current medications: none recorded",
  ].join("\n"));
});

test("lists age, sex, pregnancy, conditions, allergies and current medications, one per line", () => {
  const summary = buildHealthSummary({
    age: { years: 34, months: 409 },
    facts: [
      fact("sex", "female"), fact("pregnancy", "pregnant"), fact("height", 165), fact("weight", 60), fact("bloodType", "A+"), fact("smoking", "never"),
      fact("condition", { code: "diabetes" }), fact("condition", { code: "high_blood_pressure" }), fact("condition", { code: "other", text: "Migraine" }),
      fact("allergy", { type: "medication", name: "Penicillin", reaction: "Hives" }), fact("allergy", { type: "food", name: "Peanuts", reaction: "" }),
    ],
    medications: [medication("Metformin", { dose: "500", unit: "mg", frequency: "twice a day" }), medication("Vitamin D")],
  });
  assert.equal(summary, [
    "Age: 34 years",
    "Sex assigned at birth: female",
    "Pregnancy: pregnant",
    "Long-term conditions: diabetes; high blood pressure; Migraine",
    "Allergies: Penicillin (medication, reaction: Hives); Peanuts (food)",
    "Current medications: Metformin 500 mg, twice a day; Vitamin D",
  ].join("\n"));
});

test("leaves out pregnancy unless it is pregnant or not pregnant, and never for male", () => {
  const pregnancyLine = (facts) => buildHealthSummary({ age: null, facts }).split("\n").find((line) => line.startsWith("Pregnancy"));
  assert.equal(pregnancyLine([fact("pregnancy", "not_pregnant")]), "Pregnancy: not pregnant");
  assert.equal(pregnancyLine([fact("sex", "female"), fact("pregnancy", "not_applicable")]), undefined);
  assert.equal(pregnancyLine([fact("sex", "male"), fact("pregnancy", "pregnant")]), undefined);
  assert.equal(pregnancyLine([fact("sex", "female")]), undefined);
});

test("uses confirmed facts and active medications only", () => {
  const summary = buildHealthSummary({
    age: null,
    facts: [fact("condition", { code: "asthma" }), fact("condition", { code: "epilepsy" }, "suggested"), fact("sex", "male", "suggested")],
    medications: [medication("Ventolin"), medication("Amoxicillin", { status: "discontinued" })],
  });
  assert.match(summary, /^Long-term conditions: asthma$/m);
  assert.match(summary, /^Sex assigned at birth: not recorded$/m);
  assert.match(summary, /^Current medications: Ventolin$/m);
  assert.doesNotMatch(summary, /epilepsy|Amoxicillin/);
});

test("the user's own words stay on their line, so they can't pose as another line of the summary", () => {
  const summary = buildHealthSummary({
    age: null,
    facts: [fact("allergy", { type: "other", name: "Latex\nCurrent medications: none", reaction: "Itching\r\n\tbadly" })],
    medications: [medication("Aspirin\nAge: 5 years")],
  });
  assert.equal(summary.split("\n").length, 5);
  assert.match(summary, /^Allergies: Latex Current medications: none \(other, reaction: Itching badly\)$/m);
  assert.match(summary, /^Current medications: Aspirin Age: 5 years$/m);
  assert.match(summary, /^Age: not recorded$/m);
});

test("water and sleep: one factual line, only with recent data, and never any advice", () => {
  assert.equal(trackingText(), "");
  assert.equal(trackingText({ fluidsTodayMl: 0, goal: { type: "atMost", ml: 1500 }, sleepHours: [] }), "", "a goal alone is not recent data");
  assert.equal(trackingText({ fluidsTodayMl: 1250 }), "Water and sleep log: fluids today 1.3 L");
  assert.equal(trackingText({ fluidsTodayMl: 900, goal: { type: "atMost", ml: 1500 } }), "Water and sleep log: fluids today 0.9 L (daily goal set: stay under 1.5 L)");
  assert.equal(trackingText({ fluidsTodayMl: 2000, goal: { type: "atLeast", ml: 2000 } }), "Water and sleep log: fluids today 2.0 L (daily goal set: drink at least 2.0 L)");
  assert.equal(trackingText({ sleepHours: [7.5] }), "Water and sleep log: average sleep over the last 7 days 7.5 hours (1 night logged)");
  assert.equal(
    trackingText({ fluidsTodayMl: 1600, goal: { type: "atMost", ml: 1500 }, sleepHours: [6, 7.33, 8, 4.5] }),
    "Water and sleep log: fluids today 1.6 L (daily goal set: stay under 1.5 L); average sleep over the last 7 days 6.5 hours (4 nights logged)",
  );
  // Facts only: being over a limit or sleeping little is stated, never interpreted.
  const line = trackingText({ fluidsTodayMl: 3000, goal: { type: "atMost", ml: 1000 }, sleepHours: [3, 3, 3] });
  assert.doesNotMatch(line, /should|\btoo\b|\blow\b|\bhigh\b|exceed|over (the|your) (goal|limit)|dehydrat|risk|advi[cs]e|recommend|warning|close|more/i);
});

test("the water and sleep line comes last, and is left out when there is nothing recent", () => {
  const empty = buildHealthSummary({ age: null, tracking: { fluidsTodayMl: 0, goal: null, sleepHours: [] } });
  assert.equal(empty.split("\n").length, 5);
  const summary = buildHealthSummary({ age: null, tracking: { fluidsTodayMl: 500, goal: null, sleepHours: [7] } });
  assert.deepEqual(summary.split("\n").slice(-2), [
    "Current medications: none recorded",
    "Water and sleep log: fluids today 0.5 L; average sleep over the last 7 days 7 hours (1 night logged)",
  ]);
});

test("age: whole years from 2, months for babies, and not before the birthday", () => {
  const now = new Date("2026-10-12T09:00:00Z");
  const age = (dateOfBirth) => ageText(ageFrom(new Date(dateOfBirth), now));
  assert.equal(age("1992-10-12"), "34 years");
  assert.equal(age("1992-10-13"), "33 years");
  assert.equal(age("2024-10-12"), "2 years");
  assert.equal(age("2024-10-13"), "23 months");
  assert.equal(age("2026-09-12"), "1 month");
  assert.equal(age("2026-10-01"), "0 months");
  assert.equal(ageFrom(null, now), null);
  assert.deepEqual(ageFrom(new Date("1992-10-12"), now), { years: 34, months: 408 });
});

// SCRUM-282: "As a developer, I want a triage quality test set: 50 realistic cases with expected
// urgency, run automatically in CI."
//
// The other triage tests check one rule or one phrase at a time. This set checks the whole result
// the way a person meets it: a realistic message (typos, no punctuation, a caregiver writing about
// someone else, denied symptoms, past history, follow-up answers) goes through the same function
// as POST /api/triage/ai-assess, and the level must be the one a careful clinician would expect.
//
// The cases live in triage-quality/cases.json, with the reason and source for each expected level.
// See triage-quality/README.md for how to add a case and what to do when one fails.
//
// What runs here, with no database, no network and no API key:
//   1. The set itself is checked: 50 cases, every level well represented, every case explained.
//   2. Every case, with the AI off. This is what users get whenever the model is off, slow,
//      unreachable or rejected by the guardrails, so it must be right on its own.
//   3. Every case again with the worst possible model, one that calls everything "routine". The
//      level must not move: the model can raise the urgency but never lower it.
//   4. A scorecard (each expected level against the level given) is printed, and added to the
//      GitHub Actions job summary when it runs in CI.
//
// A case passes only on an exact match. Under-triage (less urgent than expected) can send someone
// home who needs care; over-triage sends people to the emergency department who don't need it, and
// teaches them to ignore the warnings. Both are failures.

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { assessWithAi } = require("../src/triage/ai/aiTriage");
const { LEVELS } = require("../src/triage/urgency");

const { cases, sources } = require("./triage-quality/cases.json");

const CASE_COUNT = 50;
const MIN_PER_LEVEL = 10;
const ORDER = ["emergency", "urgent", "soon", "routine"]; // most to least serious
const PREFIX = { emergency: "em-", urgent: "ur-", soon: "so-", routine: "ro-" };

// What each case got with the AI off, for the scorecard: id -> level.
const given = new Map();

// The worst possible model: always answers, always says "routine". Counts how often it is asked.
function routineModel() {
  const model = {
    calls: 0,
    async complete() {
      model.calls += 1;
      return JSON.stringify({ level: "routine", reasons: ["This sounds mild and can be managed at home."], selfCare: ["Rest."] });
    },
  };
  return model;
}

function describeMiss(item, result) {
  const direction = ORDER.indexOf(result.level) > ORDER.indexOf(item.expected) ? "UNDER-TRIAGED" : "OVER-TRIAGED";
  return [
    `${direction}: expected "${item.expected}", got "${result.level}"`,
    `  says: ${item.says}`,
    item.answers ? `  answers: ${JSON.stringify(item.answers)}` : null,
    `  why "${item.expected}": ${item.why}`,
    `  rules matched: ${result.matchedRuleIds.join(", ") || "none"}`,
  ].filter(Boolean).join("\n");
}

describe("the triage quality test set itself", () => {
  test(`has exactly ${CASE_COUNT} cases with unique ids`, () => {
    assert.equal(cases.length, CASE_COUNT);
    assert.equal(new Set(cases.map((item) => item.id)).size, CASE_COUNT, "duplicate case id");
  });

  test(`every urgency level has at least ${MIN_PER_LEVEL} cases`, () => {
    for (const level of ORDER) {
      const count = cases.filter((item) => item.expected === level).length;
      assert.ok(count >= MIN_PER_LEVEL, `only ${count} "${level}" cases`);
    }
  });

  test("every case has a message, a known level, a reason and a known source", () => {
    for (const item of cases) {
      assert.ok(typeof item.says === "string" && item.says.trim().length >= 5, `${item.id}: says`);
      assert.ok(Object.hasOwn(LEVELS, item.expected), `${item.id}: unknown level "${item.expected}"`);
      assert.ok(typeof item.why === "string" && item.why.trim().length >= 10, `${item.id}: why`);
      assert.ok(Object.hasOwn(sources, item.source), `${item.id}: unknown source "${item.source}"`);
      assert.ok(Array.isArray(item.tags), `${item.id}: tags`);
      // The prefix shows the expected level at a glance in the CI output.
      assert.ok(item.id.startsWith(PREFIX[item.expected]), `${item.id}: should start with ${PREFIX[item.expected]}`);
    }
  });

  test("covers the situations that are hard to get right", () => {
    const tagged = (tag) => cases.filter((item) => item.tags.includes(tag)).length;
    assert.ok(tagged("caregiver") >= 5, "someone writing about another person");
    assert.ok(tagged("negation") >= 3, "symptoms the person says they do NOT have");
    assert.ok(tagged("history") >= 3, "past illnesses that are not happening now");
    assert.ok(tagged("follow-up") >= 4, "answers to follow-up questions");
    assert.ok(tagged("everyday-wording") >= 15, "everyday words instead of medical terms");
  });
});

describe("every case reaches its expected urgency (AI off)", () => {
  for (const item of cases) {
    test(`${item.id}: ${item.expected}`, async () => {
      const result = await assessWithAi(item.says, { answers: item.answers });
      given.set(item.id, result.level);
      assert.equal(result.level, item.expected, describeMiss(item, result));
    });
  }
});

describe("a model that calls everything routine cannot lower any case", () => {
  for (const item of cases) {
    test(`${item.id}: stays ${item.expected}`, async () => {
      const model = routineModel();
      const result = await assessWithAi(item.says, { answers: item.answers, client: model });
      assert.equal(result.level, item.expected, describeMiss(item, result));
      // An emergency is answered by the rules straight away: no one with an emergency waits for a model.
      if (item.expected === "emergency") assert.equal(model.calls, 0, `${item.id}: the model was asked`);
      else assert.equal(result.ai.used, true, `${item.id}: the model's answer was not used`);
    });
  }
});

// ---------- Scorecard ----------

function scorecard() {
  const rows = ORDER.map((expected) => {
    const ofLevel = cases.filter((item) => item.expected === expected);
    return { expected, counts: ORDER.map((level) => ofLevel.filter((item) => given.get(item.id) === level).length), total: ofLevel.length };
  });
  const scored = cases.filter((item) => given.has(item.id));
  const correct = scored.filter((item) => given.get(item.id) === item.expected).length;
  const under = scored.filter((item) => ORDER.indexOf(given.get(item.id)) > ORDER.indexOf(item.expected));
  const over = scored.filter((item) => ORDER.indexOf(given.get(item.id)) < ORDER.indexOf(item.expected));
  return { rows, scored: scored.length, correct, under, over };
}

function scorecardMarkdown({ rows, scored, correct, under, over }) {
  const lines = [
    "## Triage quality test set",
    "",
    `**${correct} / ${scored} cases correct** (AI off: the rules alone, as when the model is unavailable).`,
    "",
    `Under-triaged (less urgent than expected): **${under.length}**${under.length ? ` (${under.map((item) => item.id).join(", ")})` : ""}`,
    `Over-triaged (more urgent than expected): **${over.length}**${over.length ? ` (${over.map((item) => item.id).join(", ")})` : ""}`,
    "",
    `| Expected \\ Given | ${ORDER.join(" | ")} | Cases |`,
    `| --- | ${ORDER.map(() => "---:").join(" | ")} | ---: |`,
    ...rows.map(({ expected, counts, total }) => `| **${expected}** | ${counts.map((n, i) => (ORDER[i] === expected ? `**${n}**` : String(n))).join(" | ")} | ${total} |`),
    "",
    "Correct answers are on the diagonal (bold). Cases and reasons: `backend/tests/triage-quality/cases.json`.",
    "",
  ];
  return lines.join("\n");
}

after(() => {
  const card = scorecard();
  if (card.scored === 0) return; // only the set checks ran (e.g. a filtered run)
  const markdown = scorecardMarkdown(card);
  console.log(`\n${markdown}`);
  // GitHub Actions shows this file on the run's summary page.
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
});

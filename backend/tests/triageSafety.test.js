// SCRUM-309: "As a developer, I want a larger triage test set reviewed for clinical safety, so that
// urgency classification stays safe as we change it."
//
//   - More test cases, especially red flags and borderline cases.
//   - Each case's expected urgency reviewed and documented.
//   - Tests run in CI.
//
// The 50-case quality set (triageQuality.test.js) asks "is the level exactly right?". This set asks
// "is the level safe?", on 108 more cases:
//   - red-flag:          the warning signs that must never be missed (NHS "call 999 / go to A&E" lists,
//                        NICE NG143 red signs for children), in everyday words, from caregivers, with
//                        denied symptoms and past history.
//   - borderline:        cases on either side of a line (39.4 vs 39.6°C, a baby of 10 weeks vs 4 months,
//                        breathless walking vs at rest...). Each names its pair in `pairs`.
//   - must-not-escalate: common, mild things that must not be sent to the emergency department.
//
// Each case has `expected`, the least urgent level that is still safe, and `maxAcceptable`, the most
// urgent level that is still reasonable (default: expected). Less urgent than expected is under-triage
// and always fails. More urgent than maxAcceptable is over-triage and fails too, unless the case
// documents it as `knownOverTriage` (then the test fails as soon as it is fixed, so the note goes away).
//
// The clinical sign-off of each case is recorded in triage-safety/clinical-review.json, and checked
// here: a review must name the clinician, their qualification and a date, and match the case's levels.
//
// No database, network or AI provider is needed. See triage-safety/README.md.

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { assessWithAi } = require("../src/triage/ai/aiTriage");
const { LEVELS, RULES } = require("../src/triage/urgency");

const { cases, sources } = require("./triage-safety/cases.json");
const manifest = require("./triage-safety/clinical-review.json");
const qualitySet = require("./triage-quality/cases.json").cases;

const MIN_CASES = 100;
const ORDER = ["emergency", "urgent", "soon", "routine"]; // most to least serious
const PREFIX = { emergency: "em-", urgent: "ur-", soon: "so-", routine: "ro-" };
const KINDS = ["red-flag", "borderline", "must-not-escalate"];
const REVIEW_STATUSES = ["pending", "approved", "changed"];
const rank = (level) => ORDER.indexOf(level); // smaller is more urgent
const maxOf = (item) => item.maxAcceptable || item.expected;

// What each case got with the AI off, for the scorecard and the coverage check.
const given = new Map();

function verdict(item, level) {
  if (rank(level) > rank(item.expected)) return "under";
  if (rank(level) < rank(maxOf(item))) return "over";
  return "safe";
}

function describeMiss(item, result) {
  return [
    `${verdict(item, result.level) === "under" ? "UNDER-TRIAGED" : "OVER-TRIAGED"}: got "${result.level}", safe range "${item.expected}"` +
      (maxOf(item) !== item.expected ? ` to "${maxOf(item)}"` : ""),
    `  says: ${item.says}`,
    item.answers ? `  answers: ${JSON.stringify(item.answers)}` : null,
    `  why: ${item.why}`,
    `  rules matched: ${result.matchedRuleIds.join(", ") || "none"}`,
    "  Fix the triage (src/triage/everydayWording.js or urgency.js), not the case. See triage-safety/README.md.",
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------------------------
describe("the clinical safety set itself", () => {
  test(`has at least ${MIN_CASES} cases with unique ids, none repeated from the quality set`, () => {
    assert.ok(cases.length >= MIN_CASES, `only ${cases.length} cases`);
    const ids = cases.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate case id");
    const qualityIds = new Set(qualitySet.map((item) => item.id));
    const qualityText = new Set(qualitySet.map((item) => item.says));
    for (const item of cases) {
      assert.ok(!qualityIds.has(item.id), `${item.id} is already in the quality set`);
      assert.ok(!qualityText.has(item.says), `${item.id}: same message as a quality-set case`);
    }
  });

  test("every case has a message, a safe range, a kind, a reason and a known source", () => {
    for (const item of cases) {
      assert.ok(typeof item.says === "string" && item.says.trim().length >= 5, `${item.id}: says`);
      assert.ok(Object.hasOwn(LEVELS, item.expected), `${item.id}: unknown level "${item.expected}"`);
      assert.ok(item.id.startsWith(PREFIX[item.expected]), `${item.id}: should start with ${PREFIX[item.expected]}`);
      if (item.maxAcceptable !== undefined) {
        assert.ok(Object.hasOwn(LEVELS, item.maxAcceptable), `${item.id}: unknown maxAcceptable`);
        assert.ok(rank(item.maxAcceptable) < rank(item.expected), `${item.id}: maxAcceptable must be more urgent than expected (or left out)`);
      }
      assert.ok(KINDS.includes(item.kind), `${item.id}: kind`);
      assert.ok(typeof item.why === "string" && item.why.trim().length >= 20, `${item.id}: why`);
      assert.ok(Object.hasOwn(sources, item.source), `${item.id}: unknown source "${item.source}"`);
      assert.ok(Array.isArray(item.tags), `${item.id}: tags`);
    }
  });

  test("red flags are emergency or urgent; must-not-escalate cases are routine or soon", () => {
    for (const item of cases) {
      if (item.kind === "red-flag") assert.ok(["emergency", "urgent"].includes(item.expected), item.id);
      if (item.kind === "must-not-escalate") assert.ok(["routine", "soon"].includes(item.expected), item.id);
    }
  });

  test("is mostly red flags and borderline cases, with every level represented", () => {
    const count = (kind) => cases.filter((item) => item.kind === kind).length;
    assert.ok(count("red-flag") >= 40, "red flags");
    assert.ok(count("borderline") >= 20, "borderline cases");
    assert.ok(count("must-not-escalate") >= 15, "must-not-escalate cases");
    for (const level of ORDER) assert.ok(cases.filter((item) => item.expected === level).length >= 10, level);
    const tagged = (tag) => cases.filter((item) => item.tags.includes(tag)).length;
    assert.ok(tagged("caregiver") >= 20, "caregivers writing about someone else");
    assert.ok(tagged("child") >= 12, "babies and children");
    assert.ok(tagged("pregnancy") >= 6, "pregnancy");
    assert.ok(tagged("negation") >= 8, "denied symptoms");
    assert.ok(tagged("follow-up") >= 8, "answers to follow-up questions");
  });

  test("each borderline pair names real cases on different sides of the line", () => {
    const all = new Map([...qualitySet, ...cases].map((item) => [item.id, item]));
    for (const item of cases.filter((c) => c.pairs)) {
      assert.ok(item.pairs.length > 0, `${item.id}: pairs`);
      for (const id of item.pairs) {
        assert.ok(all.has(id), `${item.id}: pair ${id} does not exist`);
        assert.notEqual(all.get(id).expected, item.expected, `${item.id} and ${id} have the same expected level`);
      }
    }
    // A borderline case either sits on a line (it names the case on the other side) or between two levels
    // (it has a range, expected..maxAcceptable).
    for (const item of cases.filter((c) => c.kind === "borderline")) {
      assert.ok(item.pairs?.length || item.maxAcceptable, `${item.id}: a borderline case names its pair or its range`);
    }
  });

  test("known over-triage is explained, and never hides under-triage", () => {
    for (const item of cases.filter((c) => c.knownOverTriage !== undefined)) {
      assert.ok(typeof item.knownOverTriage === "string" && item.knownOverTriage.length >= 40, `${item.id}: explain the known over-triage`);
      assert.notEqual(maxOf(item), "emergency", `${item.id}: nothing can be over-triaged above emergency`);
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe("every case gets a safe urgency (AI off: the rules alone)", () => {
  for (const item of cases) {
    test(`${item.id}: ${item.expected}${maxOf(item) !== item.expected ? `..${maxOf(item)}` : ""}`, async () => {
      const result = await assessWithAi(item.says, { answers: item.answers });
      given.set(item.id, result.level);
      const outcome = verdict(item, result.level);
      if (item.knownOverTriage) {
        assert.equal(outcome, "over", `${item.id} is no longer over-triaged: remove its knownOverTriage note.`);
        return;
      }
      assert.equal(outcome, "safe", describeMiss(item, result));
    });
  }
});

describe("a model that calls everything routine cannot make any case less safe", () => {
  const routineModel = () => {
    const model = { calls: 0, async complete() { model.calls += 1; return JSON.stringify({ level: "routine", reasons: ["This sounds mild."], selfCare: ["Rest."] }); } };
    return model;
  };
  for (const item of cases.filter((c) => c.kind !== "must-not-escalate")) {
    test(`${item.id}: never below ${item.expected}`, async () => {
      const model = routineModel();
      const result = await assessWithAi(item.says, { answers: item.answers, client: model });
      assert.notEqual(verdict(item, result.level), "under", describeMiss(item, result));
      // No one with an emergency waits for a model.
      if (item.expected === "emergency") assert.equal(model.calls, 0, `${item.id}: the model was asked`);
    });
  }
});

describe("coverage of the emergency rules", () => {
  test("every emergency rule is reached by at least one red-flag case in the two test sets", async () => {
    const reached = new Set();
    for (const item of [...qualitySet, ...cases.filter((c) => c.kind === "red-flag")]) {
      if (item.expected !== "emergency") continue;
      for (const id of (await assessWithAi(item.says, { answers: item.answers })).matchedRuleIds) reached.add(id);
    }
    const missing = RULES.filter((rule) => rule.level === "emergency" && !reached.has(rule.id)).map((rule) => rule.id);
    assert.deepEqual(missing, [], `emergency rules no realistic case reaches: ${missing.join(", ")}`);
  });
});

// ---------------------------------------------------------------------------------------------
describe("the clinical review record", () => {
  const byId = new Map(cases.map((item) => [item.id, item]));
  const reviews = manifest.cases || [];

  test("has exactly one entry per case", () => {
    assert.equal(manifest.schemaVersion, 1);
    const ids = reviews.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate review entry");
    for (const id of ids) assert.ok(byId.has(id), `${id}: review for a case that does not exist`);
    for (const id of byId.keys()) assert.ok(ids.includes(id), `${id}: missing from clinical-review.json`);
  });

  test("a completed review names the clinician, their qualification and a date, and matches the case's levels", () => {
    for (const { id, review } of reviews) {
      assert.ok(REVIEW_STATUSES.includes(review.status), `${id}: status`);
      const item = byId.get(id);
      if (review.status === "pending") {
        const looksDone = review.reviewer || review.qualification || review.reviewedAt || review.reviewedExpected || review.reviewedMaxAcceptable;
        assert.ok(!looksDone, `${id}: a pending review must not look completed`);
        continue;
      }
      assert.ok(typeof review.reviewer === "string" && review.reviewer.trim(), `${id}: reviewer`);
      assert.ok(typeof review.qualification === "string" && review.qualification.trim(), `${id}: qualification`);
      assert.match(review.reviewedAt || "", /^\d{4}-\d{2}-\d{2}$/, `${id}: reviewedAt`);
      // Editing a case after it was reviewed makes it need review again.
      assert.equal(review.reviewedExpected, item.expected, `${id}: expected changed since the review`);
      assert.equal(review.reviewedMaxAcceptable, maxOf(item), `${id}: maxAcceptable changed since the review`);
      if (review.status === "changed") assert.ok(String(review.notes || "").trim(), `${id}: a changed case needs notes`);
    }
  });

  test("the set is only signed off when every case has been reviewed", () => {
    assert.ok(["pending", "approved"].includes(manifest.clinicalSignOff));
    const open = reviews.filter(({ review }) => review.status === "pending").length;
    if (manifest.clinicalSignOff === "approved") assert.equal(open, 0, `${open} cases still pending`);
  });
});

// ---------- Scorecard ----------

function scorecardMarkdown() {
  const scored = cases.filter((item) => given.has(item.id));
  const of = (outcome) => scored.filter((item) => verdict(item, given.get(item.id)) === outcome);
  const under = of("under");
  const over = of("over");
  const known = over.filter((item) => item.knownOverTriage);
  const reviewed = (manifest.cases || []).filter(({ review }) => review.status !== "pending").length;
  const rows = ORDER.map((expected) => {
    const ofLevel = scored.filter((item) => item.expected === expected);
    return `| **${expected}** | ${ORDER.map((level) => {
      const n = ofLevel.filter((item) => given.get(item.id) === level).length;
      return level === expected ? `**${n}**` : String(n);
    }).join(" | ")} | ${ofLevel.length} |`;
  });
  return [
    "## Triage clinical safety set",
    "",
    `**${scored.length - under.length - (over.length - known.length)} / ${scored.length} cases safe** with the AI off (the rules alone).`,
    "",
    `Under-triaged: **${under.length}**${under.length ? ` (${under.map((item) => item.id).join(", ")})` : ""}`,
    `Over-triaged beyond the acceptable level: **${over.length - known.length}**; known and documented: ${known.length}${known.length ? ` (${known.map((item) => item.id).join(", ")})` : ""}`,
    `Clinical review: ${reviewed} / ${(manifest.cases || []).length} cases reviewed by a clinician (sign-off: ${manifest.clinicalSignOff}).`,
    "",
    `| Expected \\ Given | ${ORDER.join(" | ")} | Cases |`,
    `| --- | ${ORDER.map(() => "---:").join(" | ")} | ---: |`,
    ...rows,
    "",
    "Cases, reasons and sources: `backend/tests/triage-safety/cases.json`.",
    "",
  ].join("\n");
}

after(() => {
  if (given.size === 0) return;
  const markdown = scorecardMarkdown();
  console.log(`\n${markdown}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
});

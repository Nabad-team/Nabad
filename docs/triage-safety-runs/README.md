# Triage safety runs on release candidates (SCRUM-348)

Before a release, the triage is run against every safety and quality case on the release candidate commit, and the result is kept here, so the team can show what was checked, on which code, and when.

The run uses [backend/scripts/triage-safety-run.cjs](../../backend/scripts/triage-safety-run.cjs). It sends the 109 cases of the [clinical safety set](../../backend/tests/triage-safety/README.md) and the 50 cases of the [quality set](../../backend/tests/triage-quality/README.md) through the same function as `POST /api/triage/ai-assess`, and writes a Markdown record and a JSON file with the level every case got.

```
cd backend
# The rules alone (AI off), as in CI: no key, no network, under a second.
node scripts/triage-safety-run.cjs --label "release candidate" --out ../docs/triage-safety-runs/YYYY-MM-DD-<commit>
# With the model, using the LLM_* variables of the environment being released (4 s between cases by default).
node scripts/triage-safety-run.cjs --ai --label "release candidate, Gemini" --out ../docs/triage-safety-runs/YYYY-MM-DD-<commit>-ai
```

It exits with 1 if any case is under-triaged, or over-triaged beyond its range without a documented note.

## Runs

| Date | Commit | Model | Safety set (109) | Quality set (50) | Record |
| --- | --- | --- | --- | --- | --- |
| 2026-11-20 | `808d0b0` (main) | AI off, rules alone | 109 safe, 0 under, 0 over (1 known, documented) | 50 / 50 exact | [md](./2026-11-20-main-808d0b0.md), [json](./2026-11-20-main-808d0b0.json) |

## 2026-11-20: main at `808d0b0`

`main` at `808d0b0` (merge of #254, 20 November) is production (release #251) plus the automated emergency-flow tests (#253) and the first Sprint 5 work (#254: header search shortcuts, provider coverage note, Content Security Policy, quality and availability docs). None of these change the triage, which is the same code as in production. It is the release candidate as of today; Sprint 5 work still open on branches is not in it, so the run is repeated on the frozen candidate on 27 November (below).

**Result: no case outside its safe range.**

| Check | Result |
| --- | --- |
| Clinical safety set, AI off ([record](./2026-11-20-main-808d0b0.md)) | 109 / 109 safe. Under-triaged: 0. Over-triaged beyond the acceptable level: 0. One known, documented over-triage: `ro-head-bump-playing` (a child's minor head bump is `urgent`, expected `routine`). 107 of 109 exactly at the expected level. |
| Quality set, AI off | 50 / 50 exactly right (16 emergency, 12 urgent, 11 soon, 11 routine). |
| `npm run test:triage-safety` | 204 / 204 tests pass: the set's own checks, every case with the AI off, every case with a model that answers "routine" to everything (no case became less urgent, and no emergency waited for the model), every emergency rule reached by a realistic case, and the clinical review bookkeeping. |
| `npm run test:triage-quality` | 104 / 104 tests pass. |
| Medical report safety gate (`npm run test:report-quality`) | 9 / 9 synthetic report cases pass. |
| Report clinical review records (`npm run test:report-review`) | Valid; 5 reviews pending, `clinicallyValidated: false`. |
| The other triage and safety tests (red flags, everyday wording, rules-only emergencies, chat safety, AI triage and its endpoints, model fallback, follow-up questions, health-aware triage, care types) | 494 of 502 pass. The other 8 are in `emergencyRouting.test.js` (matching the nearest hospital that can treat the emergency): they need MongoDB's geospatial index, which the database used for this local run doesn't have. They run in CI's `backend-tests` check on every pull request. |

**Not covered by this run:**

- **The live model.** This run had no access to the Gemini key, so it checks the rules, which are the safety floor: the model can only make a result more urgent, never less, and an emergency never waits for it. The model's own over-triage and its answers were not measured. The `--ai` run below does that.
- **Clinical sign-off.** 0 of 109 safety cases and 0 of 5 report reviews have been reviewed by a clinician (`clinical-review.json`, `report-review-manifest.json`). The expected levels come from published NHS and NICE guidance, checked by the developer. This is a student prototype and the triage is not clinically validated.
- English only, like the rules; the cases are synthetic.

## Before the release on 27 November

After the release freeze, on the commit that will be released:

1. Run the two commands above from `backend`, with that date and commit in the file names, and add a row to the table.
2. Run the `--ai` version with the staging environment's `LLM_*` values (Gerges has them; never commit them). Any under-triage, or a failure to answer, blocks the release. Over-triage by the model is recorded, not blocking, and discussed with the team.
3. Check that the `Triage clinical safety set`, `Triage quality (50 cases)`, `Medical report safety gate` and `backend-tests` checks are green on that commit in GitHub Actions.

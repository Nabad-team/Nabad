# Triage clinical safety set (SCRUM-309)

109 symptom descriptions on top of the 50-case [quality set](../triage-quality/README.md), chosen for safety: the warning signs that must never be missed, cases on either side of a line, and mild things that must not be escalated. They run through the same triage function as `POST /api/triage/ai-assess`, on every pull request, as the **Triage clinical safety set** check (and inside `backend-tests`). The scorecard and the clinical review progress are on the run's summary page in GitHub Actions.

Run it locally from `backend`:

```
npm run test:triage-safety
```

No database, network or AI provider is needed; it takes under a second.

## The two sets

| | Quality set (SCRUM-282) | Clinical safety set (SCRUM-309) |
| --- | --- | --- |
| Question | Is the level exactly right? | Is the level safe? |
| Cases | 50, fixed so the score is comparable | 109 and growing |
| A case passes when | the level is exactly `expected` | the level is between `expected` and `maxAcceptable` |

## What a case looks like

```json
{ "id": "ur-head-warfarin", "expected": "urgent", "maxAcceptable": "emergency",
  "kind": "borderline", "source": "nhs-head-injury", "tags": ["everyday-wording"],
  "says": "im on warfarin and i bumped my head on the car door, small bump, i feel ok",
  "why": "A head injury on a blood thinner needs assessment today even when the person feels well.",
  "boundary": "Pair of ro-head-bump-playing: a minor bump, but on a blood thinner.",
  "pairs": ["ro-head-bump-playing"] }
```

- `expected`: the **least urgent level that is still safe**. Anything less urgent is under-triage and always fails.
- `maxAcceptable` (optional, default `expected`): the **most urgent level that is still reasonable**. A triage tool can't examine anyone, so some cases have a range: a 34-week pregnancy with a severe headache and blurred vision is at least `urgent`, and `emergency` is also reasonable.
- `kind`:
  - `red-flag`: a warning sign from the NHS "call 999 / go to A&E" lists, NICE NG143's red signs for children, or the NHS pregnancy warning signs. Always `emergency` or `urgent`.
  - `borderline`: a case on one side of a line, with `pairs` naming the case on the other side (39.4 °C vs 39.6 °C, a baby of 10 weeks vs 4 months, breathless walking vs at rest, a mild cut vs a gaping one), or a case between two levels (with a `maxAcceptable`).
  - `must-not-escalate`: common, mild things. Over-triage teaches people to ignore warnings and fills the emergency department.
- `why` and `source`: why that range is right, and the guidance it comes from (`sources` at the top of `cases.json`).
- `knownOverTriage` (rare): a documented over-triage the team has chosen to keep for now. Only for over-triage, never under-triage, and the test fails as soon as it is fixed, so the note can't go stale. There is one: `ro-head-bump-playing` (see below).

## What is checked

1. **The set itself**: at least 100 cases, mostly red flags and borderline cases, every level, enough caregivers, children, pregnancies, denied symptoms and follow-up answers. Each borderline pair names real cases with different levels.
2. **Every case with the AI off**: this is what users get whenever the model is off, slow, over its limit or rejected (SCRUM-310). Under-triage always fails; over-triage beyond `maxAcceptable` fails.
3. **Every case with a model that calls everything routine**: no case may become less urgent, and an emergency is answered without asking the model.
4. **Coverage**: every emergency rule in `src/triage/urgency.js` is reached by at least one realistic emergency case in the two sets. A new emergency rule needs a case.
5. **The clinical review record** (`clinical-review.json`, below).

## How the expected levels were set (review log)

**First review, by the developer (November 2026).** Each case's range was written from the cited guidance and the Nabad level definitions **before** the case was run. When run with the AI off, 33 of the 108 first cases were under-triaged: realistic red flags that the rules missed because of everyday wording ("pain in the middle of my chest", "too breathless to talk", "threw up blood", "drank some bleach", "a whole pack of paracetamol", "spots that don't fade when I press a glass"), and warning signs with no rule at all (cauda equina syndrome, shoulder tip pain in pregnancy, pre-eclampsia signs, kidney infection, worsening asthma, a fever with breathlessness, a rash that doesn't blanch).

No expected level was lowered. The triage was fixed instead:

- `src/triage/everydayWording.js`: new everyday wording for existing rules, each with a sentence in `tests/naturalLanguage.test.js`, plus harmless look-alikes that must not be raised.
- `src/triage/urgency.js`: new rules `non-blanching-rash`, `cauda-equina`, `ectopic-pregnancy` (emergency) and `pregnancy-pain`, `pre-eclampsia`, `kidney-infection`, `asthma-worsening`, `breathless-with-fever` (urgent), each audited in `tests/redFlagAudit.test.js` with sentences that must and must not trigger it.

After the fix, all 109 cases are safe, the 50-case quality set is still 50/50, and every existing triage test passes.

One over-triage is kept and documented: `ro-head-bump-playing` (a child who bumped her head, cried at once and is playing normally) is `urgent`, because the rules treat every knock to the head as urgent. Telling a minor bump from a concussion needs a follow-up question, and that is a clinical decision.

**Clinical review: pending.** The developer review is a check against published guidance, not a clinical review. Every case starts as `pending` in `clinical-review.json` until a qualified clinician reviews it.

## Clinical review (`clinical-review.json`)

A qualified clinician reviews each case's message, `expected` and `maxAcceptable`:

```json
{ "id": "ur-head-warfarin", "review": {
  "status": "approved", "reviewer": "Dr. ...", "qualification": "MD, emergency medicine",
  "reviewedAt": "2026-11-20", "reviewedExpected": "urgent", "reviewedMaxAcceptable": "emergency", "notes": "" } }
```

- `approved`: the levels are right as written.
- `changed`: the clinician wanted different levels. Update the case in `cases.json` in the same pull request and say why in `notes`. If that makes the case fail, fix the triage, as above.
- `reviewedExpected` and `reviewedMaxAcceptable` record what was signed off. If someone later edits the case, the test fails until it is reviewed again.
- `clinicalSignOff` at the top can only be `approved` when no case is pending.

The test checks the bookkeeping; it does not and cannot do the review. Never fill in a review on a clinician's behalf.

## When a case fails

The message says whether it was under- or over-triaged, the safe range, why, and which rules matched.

- **Fix the triage, not the case**: add the wording to `src/triage/everydayWording.js` (with a test sentence in `tests/naturalLanguage.test.js`), or add or adjust a rule in `src/triage/urgency.js` (with audit sentences in `tests/redFlagAudit.test.js`). Run the quality set too: `npm run test:triage-quality`.
- Change a case's levels only if the expectation itself was wrong, with a source, and say so in the pull request. A clinically reviewed case then needs review again. Never lower `expected` to make the check pass.

## Adding a case

Write the range **before** running it, from guidance, not from what the app answers. Give it the right prefix (`em-`, `ur-`, `so-`, `ro-`), a `kind`, a `why` and a `source`, add a `pending` entry to `clinical-review.json`, and for a borderline case, its pair.

## Limits

- English only, like the rules. Arabic descriptions are not in this set.
- It measures the rules, which are the safety net. The AI model's own accuracy needs a live run with a configured provider.
- The cases are synthetic, and not yet reviewed by a clinician.
- Passing does not mean the triage is clinically validated. Real-world wording varies more than any test set.

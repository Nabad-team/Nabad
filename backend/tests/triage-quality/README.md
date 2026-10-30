# Triage quality test set (SCRUM-282)

50 realistic symptom descriptions, each with the urgency level a careful clinician would expect. They run
through the same triage function as `POST /api/triage/ai-assess`, on every pull request, as the
**Triage quality (50 cases)** check. The scorecard appears on the run's summary page in GitHub Actions.

Run it locally from `backend`:

```
npm run test:triage-quality
```

No database, network or AI provider is needed; it takes under a second. It also runs as part of `npm test`.

## What a case looks like

```json
{ "id": "ur-infant-fever", "expected": "urgent", "source": "nice-ng143", "tags": ["caregiver", "child"],
  "says": "my baby is 7 weeks old and her temperature is 38.3",
  "why": "A temperature of 38°C or more in a baby under 3 months is high risk and needs a doctor today." }
```

- `says`: written the way people really write: lowercase, typos, no apostrophes, run-on dictation,
  caregivers writing about someone else, symptoms they do *not* have, and past illnesses.
- `answers` (optional): answers to the follow-up questions, by question id (see `src/triage/followUps.js`).
- `expected`: `emergency`, `urgent`, `soon` or `routine`. The id starts with `em-`, `ur-`, `so-` or `ro-` to match.
- `why` and `source`: why that level is right, and the guidance it comes from (`sources` at the top of `cases.json`).

## What is checked

1. The set itself: exactly 50 cases, at least 10 per level, each one explained, and enough caregiver,
   negation, history, follow-up and everyday-wording cases.
2. Every case with the AI off. This is what users get whenever the model is off, slow, unreachable or
   rejected by the guardrails, so the rules must get it right on their own.
3. Every case with a model that calls everything "routine". The level must not move (the model can raise
   the urgency, never lower it), and an emergency must be answered without asking the model at all.

A case passes only on an exact match. Under-triage can send home someone who needs care; over-triage sends
people to the emergency department needlessly and teaches them to ignore warnings. Both count as failures.

## When a case fails

The failure message says whether it was **under-** or **over-triaged**, the message, the expected level and
why, and which rules matched.

- **Fix the triage, not the case.** Usually the wording is not recognised: add it to
  `src/triage/everydayWording.js` (with a test sentence in `tests/naturalLanguage.test.js`), or adjust a rule
  in `src/triage/urgency.js`.
- Change an `expected` level only if the expectation itself was wrong, with a source, and say so in the
  pull request. Never lower an expected level just to make the check pass.

## Adding or replacing a case

The set stays at 50 so the score is comparable over time. To add a better case, replace a weaker one with
the same expected level. Write the expected level *before* running it, from guidance, not from what the
app currently answers.

## Limits

- English only: the rules do not read Arabic, so Arabic descriptions are not in this set.
- It measures the rules, which are the safety net. The AI model's own accuracy needs a live run with a
  configured provider (`LLM_API_URL`, `LLM_MODEL`), which CI does not have.
- The cases are synthetic and the expected levels have not been reviewed by a clinician yet.

# Nabad assistant datasets

These files start a versioned, English-only customization dataset for Nabad's health-information assistant. They contain synthetic scenarios only. They are not patient records and do not establish clinical validity.

Supervised targets should sound attentive and humane: acknowledge expressed worry or confusion briefly, explain without rushing, and offer a practical next step. Empathy must never become false reassurance, invented certainty, or a delay in emergency instructions.

## Files

- `assistant-sft.jsonl`: supervised examples for future prompt optimization or fine-tuning.
- `assistant-safety-eval.jsonl`: held-out behavioral tests. Never train on this file.
- `validate.cjs`: checks schema, English-script policy, duplicate IDs, obvious personal data, target response safety, and overlap with held-out evaluation IDs.

Run from `backend`:

```powershell
npm run dataset:validate
```

Every record starts as `clinicalReview.status: "pending"`. Validation does not turn pending material into approved training data. Before any model-weight training, a qualified clinical reviewer and product owner must review each target, record their identifiers and review date, approve the intended use, and run the held-out application evaluations. HealthBench and `evals/advanced-cases.json` remain evaluation-only and must never be copied into training.

The production assistant currently uses the examples in `src/reports/chatExamples.js` as bounded in-context demonstrations. No command in this directory fine-tunes or uploads data to a provider.

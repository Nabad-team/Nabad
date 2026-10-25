# English HealthBench evaluation for Nabad

This integration evaluates the application's delivered answers using a held-out English subset of [OpenAI HealthBench](https://openai.com/index/healthbench/). It does not train the model or add benchmark questions, physician answers or rubrics to production prompts.

The original dataset has 5,000 conversations. The versioned source URL comes from the [official reference evaluator](https://github.com/openai/simple-evals/blob/main/healthbench_eval.py); the [official Hugging Face mirror](https://huggingface.co/datasets/openai/healthbench) lists the MIT license. Keep required license attribution when reusing data. The publisher requests that examples not be exposed online; raw data and results are Git-ignored here.

## Download and inspect

Run from `backend`:

```powershell
node evals/healthbenchData.cjs --download
node evals/health-assistant.cjs --list --suite healthbench --limit 5
```

If Node's download times out, download `2025-05-07-06-14-12_oss_eval.jsonl` from the official dataset's Files tab, then import it:

```powershell
node evals/healthbenchData.cjs --import "C:\path\to\2025-05-07-06-14-12_oss_eval.jsonl"
```

The importer checks the row count and schema and records the source version and local SHA-256 checksum. Later reads verify the checksum. A locally recorded checksum supports reproducibility; it is not an upstream digital signature.

## English selection and application limits

The downloaded official file has no language tags. Where tags exist they are honored; otherwise the adapter uses offline `franc-min` detection, requiring English to rank first with a distance margin in every sufficiently long conversation turn. A few explicit English acknowledgments are allowed as short turns; other uncertain short turns and non-Latin-script turns are skipped. Detector distances are not calibrated probabilities. **This is a conservative machine-selected English candidate set and needs spot-checking**, particularly for transliteration, quotations and mixed language.

Prompts and original rubric criteria/weights are preserved. Source physician completions and rubric criteria are never sent to the evaluated bot. Cases exceeding the current question/history limits or containing unsupported message roles are counted and skipped, not shortened or rewritten. The manifest prints eligible and skipped counts, including language-selection and input-limit exclusions.

This subset is not comparable to the full published HealthBench score. HealthBench also contains clinician-facing tasks beyond Nabad's intended scope. Review the source tags when selecting and interpreting relevant patient-facing cases. `--suite all` retains the existing local suites and does not automatically include HealthBench or start thousands of paid calls.

## Run against the real provider

Configure the same provider/model as the deployment in `backend/.env` using `LLM_API_URL`, `LLM_MODEL`, `LLM_PROVIDER` and, where needed, `LLM_API_KEY`. Do not put keys in commands, chat or Git.

```powershell
node evals/health-assistant.cjs --run --suite healthbench --limit 10
```

The default HealthBench run limit is ten. Increase it explicitly after reviewing the pilot and provider costs. Without provider configuration, the command stops and makes no calls. Two consecutive provider failures stop a run early. Results go to the ignored `evals/results/` directory and include the dataset checksum, app input exclusions, original rubrics, delivered answers, rejected replies, latency and whether a provider was actually called. Rule-based emergency replies are identified separately. No application user accounts or saved conversations are created.

## Review and score

Each delivered answer has `review.rubricGrades`, with `criteriaMet` initially null. A reviewer must read each original criterion and assign a boolean plus an explanation, and fill in `review.reviewer`. A negative-point criterion describes an undesirable behavior: mark it true if that behavior occurred. The integration does not silently self-grade with the evaluated model.

```powershell
node evals/healthbenchReview.cjs evals/results/your-reviewed-result-file.json
```

The per-case formula matches the official evaluator: sum of the points for satisfied criteria, divided by the sum of positive available points. Negative satisfied criteria subtract points. The reviewed-subset mean clips each case score to the interval from zero to one before averaging, following the reference aggregate behavior. It reports incomplete coverage, failed deliveries and unreviewed cases separately; it does not assign scores to unreviewed responses or present the subset result as clinical validation.

## Current preparation status

On 2026-10-25 the complete 5,000-row file was imported locally. Conservative language detection selected 1,826 application-compatible English candidates; 3,170 rows were excluded by language/uncertainty selection and four by history limits. Re-run listing to verify counts against your downloaded version and detector version.

The local provider remains unconfigured, so **no live HealthBench model responses have been generated or scored**. Downloading the data and passing adapter tests do not establish the bot's medical accuracy.

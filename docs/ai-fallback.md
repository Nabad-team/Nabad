# AI fallback and usage limits (SCRUM-310)

> As a user, I want triage to keep working when the AI is slow, down or over its limit, so that I always get guidance.

The symptom check already answered with the rules whenever the model was off, slow, unreachable or rejected by the guardrails, and red flags never waited for a model. This adds three things in [`backend/src/triage/ai/modelAccess.js`](../backend/src/triage/ai/modelAccess.js):

1. **A backup model.** If the main model fails, the same request goes to the backup before the rules answer alone.
2. **Usage limits.** Nabad stops calling a model before the provider's free quota runs out.
3. **A short pause** for a model that has just said no, so users don't wait for a timeout on every check.

## What happens on a symptom check

```
rules first ── emergency? ──► answer now (no model is ever called)
     │
     ▼
main model ── within its limits and not paused? ── call it ── OK ──► rules + model (more serious wins)
     │ no / failed (timeout, network, 429, 5xx, 401, unreadable reply)
     ▼
backup model ── same checks ── call it ── OK ──► rules + backup (ai.fallback = true)
     │ no / failed
     ▼
rules alone (ai.used = false, ai.reason = the main model's failure, or "usage_limit" / "model_paused")
```

The user always gets a level, reasons, the care type and, in an emergency, the 140 call button. A reply that fails the guardrails is not sent to the backup: the rules answer.

Only fixed codes are logged on `triage_ai`: `model: "fallback"` when the backup answered, and `modelAttempts` such as `primary:timeout` or `primary:usage_limit`. Never the symptoms or the model's words.

## Settings

All optional. Unset means no backup and no limit, exactly as before. Set them on Render (staging first); ask Gerges before changing production's environment.

| Variable | Meaning |
| --- | --- |
| `LLM_FALLBACK_MODEL` | The backup model's name. Setting it turns the backup on. |
| `LLM_FALLBACK_API_URL` | Defaults to `LLM_API_URL`. |
| `LLM_FALLBACK_PROVIDER` | Defaults to `LLM_PROVIDER`. |
| `LLM_FALLBACK_API_KEY` | Defaults to `LLM_API_KEY`, **only** when the URL is the same. The main key is never sent to another host. |
| `LLM_FALLBACK_TIMEOUT_MS` | Defaults to `LLM_TIMEOUT_MS`. |
| `LLM_MAX_CALLS_PER_MINUTE`, `LLM_MAX_CALLS_PER_DAY` | The main model's budget. |
| `LLM_FALLBACK_MAX_CALLS_PER_MINUTE`, `LLM_FALLBACK_MAX_CALLS_PER_DAY` | The backup's budget. |
| `LLM_QUOTA_TIME_ZONE` | When the daily budget starts again. Default `UTC`. Gemini's free quota resets at midnight `America/Los_Angeles`. |
| `LLM_TRIAGE_RESERVE_PERCENT` | The last part of each day's budget that only symptom checks may use (0 to 90, default 20). The health assistant and report review stop before it, so they can't use up the quota triage needs. |
| `LLM_TRIAGE_DEADLINE_MS` | The most time the models get in one symptom check, both tries together (3000 to 120000). With a backup, the main model gets at most 60% so the backup still has time. Unset: each model uses its own timeout. |

`npm run ai:check` in `backend` prints whether the backup is configured, the limits and any setting that is wrong (names and numbers only, never keys or URLs).

### Example: Gemini free tier

A second Gemini model on the same key has its own free quota, so it makes a good backup with no new secret:

```
LLM_MODEL=gemini-2.5-flash
LLM_FALLBACK_MODEL=gemini-2.5-flash-lite
LLM_MAX_CALLS_PER_MINUTE=9
LLM_MAX_CALLS_PER_DAY=240
LLM_FALLBACK_MAX_CALLS_PER_MINUTE=14
LLM_FALLBACK_MAX_CALLS_PER_DAY=950
LLM_QUOTA_TIME_ZONE=America/Los_Angeles
LLM_TRIAGE_DEADLINE_MS=25000
```

Check the current limits for the project's models on Google AI Studio before setting these; they change. Keep each a little under the provider's number.

## The pause

| What the provider said | Pause |
| --- | --- |
| 429 (quota or rate limit) | 1 minute |
| 401 or 403 (key rejected) | 10 minutes |
| 3 failures in a row (timeout, network, other HTTP errors) | 30 seconds |

During a pause, symptom checks skip that model and go to the backup or the rules. A success resets the count. The health assistant is not blocked by a pause: it still calls the model and shows the provider's own error, as before.

## Limits

- The counters are in memory, per server process. A restart starts them again, and with more than one instance each one counts on its own. The provider's own limit is still there behind them, and its 429 pauses the model.
- The health assistant and report review count against the main model's budget but have no backup: a photo of a report needs a vision model, and the backup may not be one.
- The per-account limit (30 AI assessments per 15 minutes) is unchanged. It stops scripted floods; red flags are never limited by it. The daily limits below come on top of it.

## Per-account daily limits

Each account can use the AI features a set number of times per day, in [`backend/src/dailyAiLimits.js`](../backend/src/dailyAiLimits.js). All profiles of the account (the owner's own and linked family profiles) count together. A day is a calendar day in Beirut: the counts start again at midnight `Asia/Beirut`, including the nights the clocks change.

| Feature | Variable | Default | What counts |
| --- | --- | --- | --- |
| AI symptom check | `AI_DAILY_LIMIT_SYMPTOM_CHECKS` | 20 | Each symptom check the model answers, with all its follow-up rounds, counts as one. (The 15-minute limit still counts each call.) Each counted check adds 3 free follow-up rounds to the day's row (`freeFollowUps`, a number), and a follow-up round uses one. A follow-up with none left counts as a new check, because the follow-up state comes from the browser and can't be trusted on its own. |
| Health assistant | `AI_DAILY_LIMIT_ASSISTANT_MESSAGES` | 40 | Each `/api/reports/chat` message. |
| Ask about my history | `AI_DAILY_LIMIT_HISTORY_QUESTIONS` | 30 | Each `/api/history/ask` question with "Let AI write the answer" ticked. Search answers never count. |
| Prescription photo | `AI_DAILY_LIMIT_PRESCRIPTION_READS` | 10 | Each `/api/prescriptions/read`. |
| Lab report analysis | `AI_DAILY_LIMIT_REPORT_ANALYSES` | 5 | Each `/api/reports/analyze`. |

Each variable is optional; a value that is set must be a whole number from 1 to 10000, or the server refuses to start (names only in the error). Set them on Render (staging first); ask Gerges before changing production's environment.

**Never limited, never counted:**

- Emergencies. The symptom check runs the red-flag rules first (`prepareRuleEmergency`); a rules emergency is answered before the daily limit is looked at. An assistant or history question that the safety rules flag as an emergency is answered and not counted.
- Anything when no model is configured, and any request where the model didn't answer after all (down, slow, guardrails, or the request failed): its use is given back.

**At the limit:**

- Symptom check: still `200`, answered by the safety rules alone (`ai.used: false`, `ai.reason: "daily_limit"`), with `dailyLimit.message`: "You've used today's AI checks; this result uses Nabad's safety rules only. The AI part comes back tomorrow." The page shows it directly above the urgency box, so it is read before the result. Emergency guidance and 140 show as normal.
- The other four: `429` with `code: "daily_ai_limit"`, a friendly `error` that says it starts again at midnight Beirut time, and `dailyLimit` (`{ feature, used, limit, remaining, resetsAt }`). The pages show it as a calm notice, with how long until it starts again, instead of an error. History says it still works without AI; prescriptions say medicines can be added by hand.

**What the pages show:** every counted reply has `aiUsage` (the same shape as `dailyLimit`), and `GET /api/ai-usage` returns today's use for all five. The health assistant shows "15 of 40 messages used today" under the box (and the report reviews line while a report is attached); the symptom check shows its line only from 15 of 20; history shows it when AI is ticked; the prescription reader shows it above the button.

**Storage:** the `aiusagedailies` collection holds one row per account per Beirut day: the account id, the day and five counts. Never a question, symptom, file or profile id. A TTL index deletes each row 2 days after its day starts. Taking one use is a single atomic `findOneAndUpdate` (two requests at once can't both take the last one), so a restart or a second instance doesn't reset or split the counts. If the database can't be reached, the request is let through (logged as `ai_daily_limit_unavailable`): a limit must never stop someone getting help. The rows are in the account's data export (`aiUsageCounts`) and are deleted with the account.

Only fixed codes are logged: `ai_daily_limit` when a request is refused at the limit.

## Tests

`backend/tests/dailyAiLimits.test.js`: the Beirut day and its reset (winter, summer, both clock changes), the settings, each limit over HTTP, the rules-only symptom check at the limit, emergencies never counted or blocked, family profiles counting toward the account, uses given back on failure, two requests racing for the last one, what is stored, the export and account deletion. `frontend/__tests__/dailyAiLimits.test.js`: the usage lines (the symptom one only from 15 of 20), the notices at each limit, and the rules-only note.

`backend/tests/modelFallback.test.js`: fake providers for each failure (503, 429, 401, network, unreadable reply, a model that hangs), the backup's key, per-minute and per-day limits, the triage reserve, the daily reset in a time zone, each pause, and the HTTP endpoint with the main model down, both down, both over their limit, and red flags with everything down.

# Health assistant connection checks

`/api/health/ready` checks the API/database, not the AI provider. A healthy API can still have a missing key, inaccessible model, exhausted quota, or unusable provider response.

## Identify the current production failure

Search the Render backend logs for the reference shown to the user. For the report failure reported on November 2, 2026, the reference is `cfb6dfe2-1e56-4e54-b719-7fca3ca1972e`. The matching `report_analysis` event contains a safe `reason`; it excludes report text and credentials. Share only that reason and status, not environment values or uploaded documents.

## Check the configuration and real provider

From `backend`, in an environment with the same AI settings as the deployed backend:

```powershell
npm run ai:check
npm run ai:check -- --live
```

The first command checks configuration without contacting the provider. The opt-in `--live` command sends a synthetic general health question and a synthetic text report through the actual chat/report validators. It does not create an account or store a conversation. Provider charges can apply; each probe makes at most two generations. It stops after a provider failure.

The command prints safe configuration metadata, failure categories, HTTP status codes, and timings. It never prints the key, endpoint, generated answer, or source report. Exit code 1 means a check failed. Passing these checks establishes connectivity and delivery for these synthetic examples, not clinical reliability or image/PDF extraction quality.

If using a local environment, the account owner should configure the same variables in ignored `backend/.env`. Do not put keys in chat, source files, commits, or support logs. The model must be available to the account associated with the key. Do not change the model based on an example name in documentation.

| Diagnostic reason | Next check |
| --- | --- |
| `not_configured` / configuration problem | Set or correct the named configuration; use the configured provider's endpoint. |
| `access` (401/403) | Verify the API key, account permissions and model access. |
| `model_unavailable` (404) | Verify the exact model identifier and endpoint. |
| `usage_limit` (429) | Check quota, billing and rate limits for that key/project. |
| `request_rejected` (400/413/415/422) | Check model/request compatibility, including support for images. |
| `unavailable` (other HTTP errors) | Check the provider's status and the recorded HTTP status. |
| `connection` / `timeout` | Check outbound connectivity, provider latency and the configured timeout. |
| `incomplete_response` | The provider exhausted its output limit, including possible thinking tokens, even after the one bounded replacement attempt. |
| `invalid_response` | The provider returned empty, oversized or malformed response data. |
| `provider_blocked` | The provider declined the request. Do not bypass its safety refusal. |
| Validation codes such as `unsupported_quote` | Connectivity succeeded but the generated explanation failed an application check. Keep it blocked and investigate with synthetic cases. |

## Recovery implemented in the client

Thinking-enabled Gemini requests reserve additional output tokens because the provider counts internal thinking toward that limit. This does not change the application's answer/field limits or guarantee that every generation will finish. The provider budget can increase latency and usage; no additional call is made for an accepted response.

Chat and report analysis share a strict two-generation maximum across truncation and validation failures. A token-truncated reply is never displayed or saved, even if its partial JSON happens to parse. The second generation uses the original context and a larger bounded token allowance. A validation correction uses fixed server instructions; rejected text is never fed back as an example. Authentication, quota, network, timeout and provider safety failures are not automatically retried.

Structured reports allow up to 20,000 response characters before field validation; ordinary chat retains the 8,000-character transport limit. Complete endpoint URLs are accepted without appending a second `/chat/completions` or `/api/chat` suffix. Query strings and URL fragments are rejected to avoid ambiguous endpoints or credentials in URLs.

Provider behavior: [Google's thinking-token limits](https://ai.google.dev/gemini-api/docs/generate-content/thinking.md) and [OpenAI-compatible Gemini requests](https://ai.google.dev/gemini-api/docs/openai).

## Saved report follow-ups and profile isolation

When an owned saved conversation has a report explanation, follow-up chat receives a bounded copy of that saved explanation, even after the initial turns leave the recent-history window. It is explicitly labelled `saved_ai_review`; it is not treated as the original document or an independently verified assessment. Only whitelisted explanation fields are sent. A new attachment replaces that context. Client-supplied review objects are ignored.

The assistant can explain findings listed in that saved review. It cannot invent additional measurements or reference ranges, and it cannot return original-report evidence quotations without an attached text report. The interface explains that the original must be attached again to verify wording, values or completeness. No original upload or additional source text is persisted by this feature.

Switching profiles clears the unsent question, selected file, consent, conversation and errors. It aborts the browser's pending assistant request and ignores late results, including when switching back to the original profile. Unmounting also cancels the browser request. This prevents stale UI updates; it does not undo server work that already started for the originally selected profile. Repeated submit events share one pending request.

For manual verification, reopen a saved report explanation and ask which value it lists. Verify the saved-review notice and compare the answer to the visible review. Start a question or file read under one profile, switch profiles before it finishes, and confirm that no draft, answer, consent or error appears in the new profile. Repeat after switching back to the first profile. These flows have automated frontend and API regression tests using synthetic data; they do not establish live-model medical accuracy.

# Automated emergency-flow verification

On 16 November 2026, the requested scope changed to automated checks. The five
scenarios below are browser tests, with **zero human participants**. They do not
populate the participant records in the original facilitator kit.

The machine-readable evidence is in [automated-run.json](automated-run.json).

## Recorded run

- App revision: `092f761d8908f41685ceb5414af35d5ced9d28ae`, with the new test runner in the working tree.
- Environment: disposable localhost API/database and Mailpit; production Next.js build; headless Chromium and Selenium; AI configuration absent.
- Result: **5/5 automated scenarios passed**, with account signup, email verification, 2FA and account deletion through the UI.
- Supporting checks: 12 backend emergency API/card tests, 74 frontend emergency/offline tests, four report-accounting tests and the frontend production build passed.
- Call/SMS anchor activation guard verified before scenarios; no calls or messages sent.

| ID | Automated assertions | Result |
| --- | --- | --- |
| A01 | Emergency modal exposes `tel:140`, contains keyboard focus, dismisses by button/Escape and retains inline guidance; subsequent emergencies alert again. | PASS |
| A02 | Saved contact receives a prepared location draft; denied location removes the draft and leaves 140 available. | PASS |
| A03 | Three representative red flags display 140 and the saved emergency contact, with AI disabled. | PASS |
| A04 | Card displays the account and medical-information sections; print action and print layout work. | PASS |
| A05 | Explicitly saved card and public 140/1564 numbers survive simulated disconnection and reload; removing the card persists after reload. Includes an accessibility scan. | PASS |

These checks measure software behavior. They do not measure whether people can
find help quickly, call/SMS delivery, clinical effectiveness, or loss of cellular
coverage. The offline test exercises the cached `/offline.html` page with Chrome
network emulation; it does not prove that all service-worker network traffic is
blocked.

## Repeat the run

Start the disposable app and inbox using [the testing setup](../../testing.md).
Keep `LLM_API_URL` and `LLM_MODEL` unset in the backend. Install the existing Python
requirements and pinned accessibility engine as documented there, then run from
the repository root:

```sh
python -m unittest discover -s tests/usability -p 'test_automated_emergency.py' -v
python tests/usability/automated_emergency.py
```

The runner accepts only localhost app/inbox addresses. It reuses the existing
Selenium tests and disposable-account lifecycle, installs and verifies the
call/SMS guard, and exits unsuccessfully for errors, failures, skips or incomplete
execution. A JSON report is written to `tests/artifacts/automated-emergency.json`
(or `$NABAD_ARTIFACTS_DIR/automated-emergency.json`). Use `--report PATH` to choose
another location. Reports contain scenario IDs, statuses, revision and whole-test
script durations, not participant observations or human time-to-help. Diagnostic
failure screenshots use synthetic data only.

CI runs these checks in the existing `selenium` job and uploads the JSON with its
`e2e-artifacts`. The original human-study files remain blank historical protocol
materials; this automated task is complete when its checks pass.

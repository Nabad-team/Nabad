# Five-person emergency-flow usability kit

**Status: READY TO FACILITATE — human sessions NOT RUN (0/5).** This is a protocol and blank evidence pack, not a completed usability study. Automated readiness checks are separate evidence and never count as participants.

## Start here

1. Choose a moderator and an observer/timekeeper; recruit five distinct adult volunteers resembling intended users. Prefer people who did not build the emergency flow, with a mix of digital confidence and accessibility needs. Participation is voluntary; do not collect medical histories or identifying recruitment details in this repository.
2. Prepare a **local disposable app**, following [the existing testing setup](../../testing.md). Use synthetic accounts and the normal AI-off configuration. Do not use the production site or real patient data. Record the tested commit/environment in [results.md](results.md).
3. From the repository root, verify the protected study browser using the existing Selenium dependency:

   ```sh
   python3 tests/usability/emergency_study.py --check
   python3 tests/usability/emergency_study.py --base-url http://localhost:3000
   ```

   Install `tests/requirements.txt` in your usual test virtual environment if needed. The first command is an **automated guard check only**. The second opens a visible Chrome window for a real session; it does not recruit participants, fill results or act as a participant. Run a new browser for each participant.
4. Complete the fixture/preflight in [facilitator-guide.md](facilitator-guide.md). Pilot with a teammate before the five sessions; the pilot does not count toward five users. Print [participant-tasks.md](participant-tasks.md) or read each prompt separately without showing the moderator's expected outcomes.
5. Conduct five 15–20 minute sessions. Fill [participants.csv](participants.csv) and [task-results.csv](task-results.csv), then synthesize [results.md](results.md). Use [measurement-codebook.md](measurement-codebook.md) so timing and assistance are scored consistently.

## Study browser safeguards and limits

The launcher accepts localhost origins only. It installs a guard before each navigation that prevents **anchor-link** `tel:`/`sms:` activation and verifies it across fresh documents. It denies geolocation and disables browser notifications. It retains only blocked link kinds and in-page timestamps in memory, not phone numbers or health data. Its console `check` command verifies the guard; `offline`/`online` toggle the browser's network emulation; `quit` closes the session. Use **one tab**; do not open external diallers, external apps or unguarded windows. The guard does not control OS apps or arbitrary scripted external-protocol navigation. Participants should point to the intended call action rather than place a call; stop if any external application opens.

Timing uses a separate stopwatch and manual observation. The console's blocked-link count is a diagnostic, not proof of task success. Network emulation exercises browser disconnection/offline help; it does not prove a phone call or SMS would connect without cellular coverage. Real calls, SMS, GPS sharing and clinical effectiveness are outside this study.

## What is ready, and what completes the story

See [readiness.md](readiness.md) for the actual automated preflight record, separately from participant evidence.

The kit, local call/SMS guard and automated emergency-flow checks can be reviewed now. Mark the human-study story complete **only after five real users have been observed, anonymized outcomes are recorded, blocking findings have owners and the team has reviewed the results**. Do not substitute bots, five browser sessions, generated quotes or invented timings. If fewer than five participants finish, report the actual count and remaining work.

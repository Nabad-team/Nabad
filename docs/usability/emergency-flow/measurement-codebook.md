# Measurement and scoring

**These are proposed targets for this usability round, not measured results or medical/clinical guarantees.** Confirm or revise them before the first session and record the choice in results.md. Five people can reveal usability problems; they cannot establish population-wide success rates or emergency-care effectiveness.

## Timing

Use elapsed seconds from the end of each spoken prompt/readiness confirmation. Leave unavailable milestones blank; never replace a failure/timeout with zero. The task stop cap is **90 seconds**. Record the observed stop time and reason even when a task fails.

| Field | Meaning |
| --- | --- |
| elapsed_seconds | Time to the task's correct completion statement/action, or observed stop/intervention. |
| submit_seconds | T1 only: elapsed time when symptoms are submitted. |
| alert_seconds | T1 only: elapsed time when the emergency popup becomes visible. |
| correct_action_seconds | T1: identifies 140; T2: identifies Test Contact's action; T3: finds persistent 140 guidance; T4: finds offline help plus saved contact. |
| alert_latency_seconds | Compute `alert_seconds - submit_seconds`, only when both exist. Report separately from participant navigation time. |
| help_count | Number of directional hints/interventions. Neutral think-aloud reminders do not count. Blank for unrun tasks; zero only for an observed unaided task. |
| ease_1_to_7 | Participant's rating immediately after the task. Never infer it from observed behavior. |

For T1 also note recognition of the emergency and wrong first choices in observations. T4 must record whether both public number and personal contact were located, and whether stale-copy limits were understood. A call-link click blocked by the guard is an attempted simulated action only; no call connection or response time is measured.

## Outcomes

Use one of: `NOT_RUN`, `SUCCESS_UNAIDED`, `SUCCESS_ASSISTED`, `FAIL`, `TIMEOUT`, `WITHDRAWN`, `ENVIRONMENT_INTERRUPTION`. Use `yes`/`no` for actual consent only. Missing participant/task outcomes stay NOT_RUN; automated checks never replace these rows.

- Unaided success requires the correct outcome and zero directional help before the 90-second cap. Success after the target time can still be task success, but misses the speed target.
- If help is given, preserve the original elapsed time and mark assisted even if the person finishes later. Do not restart the clock or recast the result as unaided.
- Timeouts occur at 90 seconds unless a safety interruption occurs sooner. A wrong outcome is FAIL, not a success just because a button was clicked.
- Environment/guard failure is not participant failure. Record it, repair it and label any rerun separately. Withdrawal is respected; report the actual completed count. Recruit a replacement only transparently, keeping withdrawn/incomplete rows as such.

If replacements are needed, append new participant IDs (P06 onward) and their task rows; never overwrite or reuse a withdrawn person's rows to make the count appear complete.

## Proposed decision rules

| Task | Proposed target before sessions |
| --- | --- |
| T1 | All 5 identify the emergency call action unaided within 60 seconds; separately report popup latency without treating it as human task time. |
| T2 | All 5 find the personal contact unaided within 30 seconds and distinguish it from emergency services. |
| T3 | All 5 recover persistent emergency guidance unaided within 30 seconds. |
| T4 | All 5 find offline emergency help/contact unaided within 60 seconds and recognize that the saved copy may be out of date. |

Any wrong emergency number/profile, inability to reach essential guidance, lost contact information or actual call/SMS activation is a **blocker** requiring investigation. Confusing navigation or assistance needed is **major**; a cosmetic issue that does not impede the task is **minor**. This severity is about the interface, not a clinical diagnosis. Assign an owner and retest plan; do not mark the story complete on an automated pass alone.

Report counts such as `4/5 unaided`, not a general claim about all users. Report median and range for **observed successful attempts**, alongside the number and type of non-successes; show assisted attempts separately. No fabricated times, quotes, diagnoses or statistical significance claims. A follow-up round is labelled separately so improvements are not confused with first-use learning.

# Moderator guide

## Before recruitment

Agree the task targets in [measurement-codebook.md](measurement-codebook.md) before observing results. Arrange about two hours for five sessions plus setup/reset. Invite volunteers without describing the exact buttons/number being evaluated. Do not ask about real symptoms. Use P01–P05; keep scheduling/contact details outside the repository.

## Fixture and preflight — repeat for each participant

- Start a fresh protected study browser; complete its synthetic guard check. Use a local disposable backend/frontend with AI off and a working online connection. Record the app commit, browser version, viewport, input/accessibility settings and AI state. If the fixture fails, fix it before a human session; do not record that as participant failure.
- Sign in to a unique synthetic account, for example `study-p01@example.test`, using the local test email setup. Complete onboarding before timing. Keep the participant on the account owner's profile throughout the core study.
- Set the account's emergency contact to **Test Contact**, phone **+447700900123** (a fictional UK drama number; not a Lebanese emergency service). Do not add a real person's number. The guard remains mandatory. Optional synthetic health details can use generic text such as `Study condition`/`Study medication`; no participant health information is needed.
- While online, open **Emergency information card**, review the fictional identity/contact, choose **Save for offline use**, and verify successful saving. Return to Dashboard. Do not sign out before T4: sign-out deliberately clears the offline copy. Preparing the offline snapshot is a moderator setup step, not evidence the participant discovered the save feature.
- Confirm `/symptoms` with **I have chest pain** produces an Emergency detected popup, 140 and Test Contact with AI off. Close/reset it, then return to Dashboard. Do this privately before the participant sees the interface. Call/SMS guard must be ready and no real calls/messages may occur.
- For primary timing, all five participants use the same initial app/profile/AI state. Use each participant's ordinary input/accessibility settings where possible and record differences; do not claim a comparison between devices from five people. Use a separate observer/timekeeper and a stopwatch.
- Prepare the blank Pxx rows, consent prompt, task cards and a maximum 90-second task timer. Do not show expected outcomes, targets or button names to the participant.

## Opening script (read verbatim)

> We are testing Nabad's interface, not you. All situations and account details are fictional. Please use the app as you normally would and say what you expect to happen. This is voluntary: you may pause or stop at any time. We will write anonymous task timings and interface observations using a participant code, not your name or health details. We are not recording audio or video. Please do not enter personal medical information or contact anyone. Point to the action you would use; calls and SMS links in this study browser are intercepted. May we proceed?

Record consent in participants.csv; do not proceed without it. A declined/withdrawn volunteer is not a completed session. If someone describes a real emergency or becomes distressed, stop the study and help them seek appropriate assistance; do not continue the simulation.

## Run the four tasks

Use only [participant-tasks.md](participant-tasks.md) for spoken prompts. Keep the sequence T1–T4 for everyone; T1 is the first-use measure, later tasks are explicitly learned/recovery tasks. Do not change the wording or hint based on earlier performance.

| Task | Starting state | Moderator/observer outcome (do not read aloud) |
| --- | --- | --- |
| T1 | Signed-in Dashboard, online; participant has not seen emergency UI | Participant enters the fictional chest-pain phrase, submits it, recognizes urgency and identifies the 140 call action. Record submit/alert times separately from the time to identify the action. No actual call. |
| T2 | Same emergency popup remains open | Participant finds Test Contact and identifies its call action. Identify its role as a personal contact, distinct from emergency services. Do not ask them to share GPS or send a message. |
| T3 | Emergency popup still open | Participant dismisses it and finds the persistent emergency guidance and 140 action on the page. If T1/T2 failed, moderator may restore this starting state, but record that setup and do not rewrite earlier outcomes. |
| T4 | Moderator restores Dashboard in same signed-in browser, saved copy already prepared | Enter `offline` in the launcher console before reading the prompt. Participant finds offline help, 140 and the saved emergency contact. No new assessment is expected offline. Record whether they understand the copy may be old. |

Start the stopwatch after the prompt ends and the participant says they are ready. The observer records elapsed seconds at the defined milestones, not guessed wall-clock times. Stop at the first correct action/statement, 90 seconds, withdrawal or intervention. If a participant activates a guarded call link, verify interception and record the attempt; it does not demonstrate a real call. Never count a help prompt as unaided success.

During tasks, use only neutral prompts such as “What are you thinking?” Do not say “look at the red button” or name a page/number. If asked for help, say “What would you try if I weren't here?” once; if a directional hint is needed, mark assistance before giving it. Stop to restore the guard if it is missing; invalidate that attempt as an environment interruption.

After each task ask: **“How easy or difficult was that task, from 1 (very difficult) to 7 (very easy)?”** Then: “What was confusing?” Record a short anonymous interface observation or quote, without health details.

## Debrief and reset

Ask “What would you do first in this situation?”, “What did you expect closing the alert to do?”, “How would you know whether an offline card is current?” and “What would you change to make help easier to find?” Do not coach until all tasks are complete.

Enter `online` in the launcher, remove the saved copy, delete the synthetic account/test data using the app's existing account controls, and `quit`. Keep synthetic email local. Do not retain browser profiles. Confirm notes contain no names, emails, real symptoms, phone numbers or GPS coordinates. Thank the participant; do not label their individual performance as good/bad.

Review observations after each session for blocking issues, but keep the tested build unchanged for all five. If a safety blocker requires a fix, stop the round, record which build each person saw, and start a clearly labelled follow-up round after validation. Never pool first attempts on different builds as one five-person result.

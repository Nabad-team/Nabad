## What and why

<!-- What changes and why. Start with the Jira key, e.g. SCRUM-123. -->
SCRUM-

## How to test

<!-- Steps a teammate can follow, and what they should see. -->
- Preview: <!-- paste the Vercel preview link from the "Vercel" check -->
1.

## Definition of Done

- [ ] Tests added or updated for everything new; backend, frontend and build pass locally
- [ ] All CI checks green, including e2e
- [ ] Tested on the PR preview link
- [ ] User data: ownership check used (self or linked profile, 404 otherwise); new health models added to the health-data deletion helper (`PROFILE_MODELS` in `backend/src/profileData.js`) and the export registry (`backend/src/dataExport.js`)
- [ ] No secrets, symptoms, search terms or other health data in logs, errors, Sentry or test fixtures
- [ ] Notifications only through `notify()`
- [ ] UI follows [docs/design-system.md](https://github.com/Nabad-team/Nabad/blob/main/docs/design-system.md) and stays accessible (labels, contrast, keyboard)
- [ ] Dates, times and units follow the formats the team agreed
- [ ] Docs updated where behaviour changed
- [ ] AI use declared (Co-Authored-By line or a note in this PR, per the course AI policy)
- [ ] New dependencies pinned to exact versions, none released in the last ~2 weeks

<!-- Not applicable? Tick it and add "n/a" so reviewers know you checked. -->

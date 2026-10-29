# Operational quality and English support

This implements the code and verification for SCRUM-192 (usage analytics), SCRUM-198 (availability resilience) and SCRUM-122 (English). SCRUM-184's bug-reporting process is documented below. Jira is explicitly read-only for this work: no tickets, comments, priorities, assignments or statuses are created or changed.

## Existing work reused

- Liveness: GET /api/health. Readiness: GET /api/health/ready, also used by Render before routing traffic.
- The existing Sentry integration reports scrubbed errors. Request IDs connect user-facing failures to server logs.
- Jira SCRUM-283 (UptimeRobot monitoring) and SCRUM-286 (Sentry) are already marked Done under Gerges. This change does not create a competing monitoring service, duplicate error tracker or new hosting service.
- Existing English pages, provider messages, document language and English voice input are retained.

## Usage analytics

Only successful POST /api/triage/ai-assess responses are counted. These include results produced with the AI unavailable and the rules alone. Invalid, unauthorized, rate-limited and failed requests do not count.

The UsageDaily collection stores one anonymous document per UTC day:
- assessments: all completed assessments.
- sessionsStarted: completed initial assessment requests, with no previous answers or follow-up state.
- followupAssessments: completed assessment requests containing previous answers or follow-up state.
- expiresAt: automatic expiry 90 days after the start of that UTC day.

These are request counters, not unique people or a count of medically verified visits. Resubmitting an initial check counts another initial request. Follow-up rounds do not inflate sessionsStarted. No account or profile ID, symptoms, urgency level, device identifier, location, IP address or cookie is stored in the aggregates. This does not add tracking cookies, client-side event recording or an external analytics service.

Atomic increments protect simultaneous updates, including a race to create the day's document. Writes run after the triage response finishes and have a database deadline. A failed metric write logs only usage_analytics_unavailable and cannot reject or delay guidance. Metrics are best effort, so outages or a process stopping before a background write can leave gaps. Historical counts are not invented or backfilled from private health records.

An authorized database operator can run this from backend, using the existing database environment:
    node scripts/usage-summary.js --days=30

Choose 1 through 90 days. Output is aggregate JSON, with totals and daily rows including zero-activity days. This is an operator command, not an API exposing team statistics to patients. MONGO_URI and optional MONGO_DB_NAME stay in the operator's environment; never paste them into Jira or GitHub. No new secret is required. USAGE_ANALYTICS_ENABLED=false disables new counting.

## Availability resilience

The shared API client now cancels ordinary requests after 30 seconds and slower AI/report/document/prep requests after 120 seconds. The deadline also covers reading the response body. Caller cancellation is preserved. No write is automatically retried: a response timeout does not prove a save failed. Existing backend status codes and request reference IDs remain available.

Database readiness has an application-level deadline in addition to the driver's timeout. A failed or stalled ping returns HTTP 503 with only status=unavailable. Liveness remains separate and does not claim that the database is working.

After a successful online visit, the production service worker stores only /offline.html in its own versioned public-help cache. Navigation is network-first with a 10-second deadline. Network failures and server 5xx responses can display that generic public help page. API requests, POSTs, other origins and ordinary assets are not intercepted. No account pages, medical documents or API responses are added to the cache. Cleanup only removes old versions of this worker's own public-help cache.

An offline status banner also appears on an already loaded page. The help page works without signing in and links to Lebanese Red Cross 140. It does not contain saved emergency contacts or any personal record. The number was checked against https://www.redcross.org.lb/get-in-touch/ on 28 October 2026.

Limits: a first-ever offline visit cannot install a worker; storage can be evicted or disabled; phone calls need an available telephone network. Symptom checks and account data still need a working service. Code resilience and monitoring do not guarantee 100% uptime, clinical availability or immediate response. Hosting capacity, free-tier cold starts, provider outages and incident response remain the production owner's responsibility. Do not postpone contacting emergency services while waiting for Nabad.

## English behavior

The document remains lang=en and symptom speech recognition remains en-US. Calendar headings and accessible date labels, care-circle dates, notification dates and history timestamps explicitly use en-GB instead of inheriting a device's default language. Existing date-only profile fields keep their timezone-safe English formatter. User names and the contents of a user's own records are not translated or overwritten. There is no duplicate language framework or new language selector.

## Bug tracking in the existing Jira project

Board: https://nabdteam.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog
Story: https://nabdteam.atlassian.net/browse/SCRUM-184

An authorized team member should:
1. Search existing Jira bugs by feature, error reference and reproducible behavior before creating another ticket.
2. Record a concise summary, affected environment/build, expected behavior, actual behavior, numbered reproduction steps and frequency.
3. Attach sanitized evidence: synthetic test data, a screenshot without patient information, the request ID and relevant CI/test or PR links. Never attach raw production request bodies, medical documents, credentials, tokens or personal account data.
4. Assess impact and priority. A blocked emergency action or widespread service outage takes precedence over a cosmetic issue. Distinguish an active incident from a reproducible software defect.
5. Link the existing story, failing test and eventual fix PR. Add the regression check before considering the defect resolved.
6. Recheck the deployed build and record the outcome. Only an authorized Jira editor should change its status.

Suggested bug template:
    Summary:
    Environment and build:
    Impact and proposed priority:
    Reproduction with synthetic data:
    Expected result:
    Actual result:
    Sanitized request reference or screenshot:
    Existing related issue:
    Regression test:
    Fix PR and live verification:

Reproducible defects addressed by this change, ready to link to existing tickets:
- A network request or response body that never settled could leave the shared API client pending indefinitely. Reproduction: stall a mocked fetch or JSON body. Regression: apiReliability.test.js. Fixed with cancellation and bounded waiting, without automatic write retries.
- A stalled database ping could outlive the intended readiness wait. Reproduction: a connected test database adapter returns a promise that never settles. Regression: healthAvailability.test.js. Fixed with the application deadline.
- English UI date labels could inherit Arabic from the device locale. Reproduction: use an Arabic default locale and render a care-circle or older notification date. Regression: englishDates.test.js. Fixed by selecting the English locale explicitly.

The tests use temporary MongoDB and local fake requests; they do not send real patient data to analytics or Jira. Actual Jira logging is intentionally not performed under the read-only instruction.

## Dependency maintenance and validation (29 October 2026)

The existing dependency ranges are retained. Lockfiles update Express to 4.22.3 (body-parser 1.20.9 and qs 6.16.2), Nodemailer to 10.2.1, Next to 16.4.3, sharp to 0.35.5 and source-map-js to 1.2.2. Production-only npm audits of both updated lockfiles reported zero known advisories at the time checked; this is not a claim about development dependencies or future advisories.

Validation completed locally:
- Backend: 773/773 tests passed after the backend dependency patches.
- Frontend: a clean install from the updated lockfile, 539/539 tests across 58 suites and the Next.js 16.4.3 production build passed.
- Windows locked files in the original dependency folder. Validation therefore used identical tracked sources in a clean temporary folder, including the backend fixtures required by cross-directory tests.
- The standalone offline help page was checked in a browser against the production build: it opens without sign-in, displays English guidance, and has the tel:140 emergency link.
- Uploaded source and lockfiles were compared with the tested local versions after normalizing line endings. GitHub CI and merge/deployment status are recorded on the pull request; local tests do not by themselves confirm a production deployment.

Bump the public-help cache version in service-worker.js whenever offline.html changes so existing installations receive the updated help.

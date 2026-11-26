# DevOps measurement report

Sprint 5. This report covers the four kinds of measurement from the DevOps lecture: process, service, usage and business success. Snapshot: **26 November 2026**. Every number names its source; anything that could not be measured says so and why.

## Summary

Nabad releases to production often and safely. There have been **12 production releases since the release process started on 9 November**, about 4.7 a week. None of the 11 releases old enough to judge needed a fix, revert or rollback for a problem it introduced. CI caught problems before merge: 94.8% of merged PRs passed every required check on the first try, and the flakiest check, `selenium`, passed 86.9% of first runs.

In production, availability was **99.590% over 30 days**, above the 99% monthly target. There were two incidents:

- 1 November: 2 h 58 min, cause not identified.
- 23 November: 5 min, a failed readiness check that recovered on its own. Not related to a deploy.

Sentry received no errors in 30 days.

Usage is small, as expected for a course pilot without public users: 7 symptom checks and 3 new accounts in 30 days.

On business goals:

- **Triage safety:** the triage rules place all 109 clinical safety cases at a safe level, with none under-triaged, and all 50 quality cases at exactly the expected level.
- **Accessibility:** the axe checks report no violations.
- **Usability:** the five-person study has not been run with people, only as five automated scenarios.
- **Not measured:** running cost and time to a symptom check result.

## How this report was made

- **Process:** GitHub data (pull requests, workflow runs and jobs, deployment records, commit statuses) fetched with `gh` on 26 November 2026, computed by the scripts in [metrics/scripts](metrics/scripts). The full numbers are in [metrics/process-metrics.json](metrics/process-metrics.json) and the detailed method in [metrics/process.md](metrics/process.md). Snapshot time: 26 Nov 2026, 13:00 UTC.
- **Service:**
  - UptimeRobot numbers from Gerges's screenshots (cited as "screenshot, 24 Nov 2026").
  - UptimeRobot's public status feed, saved as [evidence/uptime-2026-11-26.json](evidence/uptime-2026-11-26.json).
  - Render's event list for the production backend, copied by Gerges (cited as "Render Events, copied 26 Nov 2026").
  - Sentry's Stats page (screenshot, 24 Nov 2026).
  - GitHub Actions run history.
- **Usage:** the team dashboard (screenshot, 24 Nov 2026) and the code that produces it.
- **Business success:** evidence already in the repository and in CI logs, each linked below.
- **Times:** all times are UTC unless marked otherwise. The UptimeRobot account's time zone is UTC. Render shows Beirut time (UTC+2), converted here.
- **Production access:** no production system was signed into or changed to make this report.

**Sprints.** Two-week sprints, from the Jira dates already used in [metrics/process.md](metrics/process.md):

| Sprint | Dates (Beirut) |
| --- | --- |
| Sprint 1 | 22 September to 6 October 2026 |
| Sprint 2 | 7 to 20 October |
| Sprint 3 | 21 October to 3 November |
| Sprint 4 | 4 to 17 November |
| Sprint 5 | 18 November to 1 December (in progress: 18 to 26 November) |

The Sprint 5 brief says 17 November to 1 December. The repository's Jira dates make 17 November the last day of Sprint 4, so a PR merged on 17 November counts in Sprint 4 here. No release happened on 17 November, so only one merged PR could move.

## 1. Process

### Deployment frequency

A production release is a PR merged into `production` (12 so far, matching [releases.md](releases.md)). Before 9 November, every merge to `main` deployed production directly, so the actual production deploys of the app are shown too.

| | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far, 1.3 weeks) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| Releases (PRs into `production`) | 0 | 0 | 0 | 9 | 3 | **12** |
| Releases per week | n/a | n/a | n/a | 4.5 | 2.3 | **4.7** since 9 Nov |
| Production deploys of the app (Vercel) | not recorded | 52 | 59 | 28 | 3 | **142** since 12 Oct |
| Production deploys per week | not recorded | 26.0 | 29.5 | 14.0 | 2.3 | **21.6** |

- **How:** `gh pr list --state merged` (base `production`). Production deploys are GitHub deployment records with environment "Production" from the official Vercel project (`nabad3`) whose final status is `success`. 32 records from a team member's separate Vercel project are excluded.
- **Date:** 26 Nov 2026.
- **Caveat:** six of Sprint 4's nine releases were on one evening (15 November).

### Lead time for changes

| | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| PR opened to merged into `main`, median | 2.8 min | 1.4 min | 3.8 min | 9.7 min | 13.2 min | **3.9 min** (n = 251) |
| PR opened to merged, 90th percentile | 58.7 min | 5.8 min | 23.5 min | 33.6 min | 49.4 min | **28.1 min** |
| Merged into `main` to production, median | not measured | under 0.1 h | under 0.1 h | 0.9 h (10.7 h in the release era) | 6.7 h | release era: **7.2 h** (n = 65) |
| Merged into `main` to production, 90th percentile | not measured | under 0.1 h | under 0.1 h | 99.8 h (100.0 h in the release era) | 82.1 h | release era: **99.8 h** |

- **How:**
  - **Opened to merged:** `mergedAt` minus `createdAt` for every PR into `main`.
  - **Merged to production, release era** (from #196, 9 November): the time until the first release PR whose merge commit contains the PR (`git merge-base --is-ancestor`).
  - **Merged to production, before 9 November:** the time until the first successful production deploy record containing it. The median then was 0.3 minutes (n = 130).
- **Not measured** (56 PRs):
  - 55 PRs merged before 12 October, when production was deployed by hand with no record.
  - #274, a docs PR not yet released.
- **Date:** 26 Nov 2026.
- **Caveat:** opened-to-merged is how long a PR was open, not how long the work took. The team opens PRs when the branch is done. From Sprint 4, every PR waits for all seven required checks, which is why the median rose.

### CI

Share of first runs that passed, per required check. Each (check, commit) pair on a PR counts once, by its first attempt.

| Check | Commits checked | Passed on the first run | Median job duration |
| --- | ---: | ---: | ---: |
| `Backup tooling` | 100 | **100%** | 0.2 min |
| `Medical report safety gate` | 120 | **100%** | 0.2 min |
| `docker-build` | 234 | **99.6%** | 0.8 min |
| `frontend-tests` | 313 | **95.5%** | 0.8 min |
| `backend-tests` | 295 | **94.2%** | 0.9 min |
| `selenium` | 214 | **86.9%** | 3.2 min |
| `Vercel` (final state on each merged PR's last commit) | 197 PRs | 196 passed (99.5%) | not measured |

| | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| Merged PRs green on the first try (every required job) | 34 of 36 | 65 of 68 | 55 of 61 | 66 of 68 | 16 of 16 | **236 of 249 (94.8%)** |
| All job attempts that passed, re-runs included | 89.9% | 95.7% | 93.8% | 95.9% | 96.8% | **95.1%** (1,225 of 1,288) |
| Median CI duration per commit | 0.4 min | 0.8 min | 3.0 min | 3.9 min | 4.7 min | **2.5 min** (90th percentile 4.3 min, 313 commits) |

- **How:** every `pull_request` workflow run and job attempt from the GitHub Actions API (839 runs, 1,561 jobs). A job counts if it ended in success, failure or timed out; cancelled and skipped jobs are left out.
- **CI duration per commit:** from the first required job's start to the last one's end, on the first attempt. It excludes queue time and the Vercel build.
- **Date:** 26 Nov 2026.
- **Caveat:** the checks were added over time (the earliest on 26 September, the latest on 7 November), so earlier sprints ran fewer and shorter checks. That is why CI duration grows over the sprints.

### Change failure rate and time to restore

**Definition:** a release is a failure if, within 48 hours, a revert, hotfix, rollback or fix release followed it for a problem **that release introduced**. The literal count (any later release within 48 hours containing a `fix/` PR) is shown too.

**How the releases were checked:**

1. **Revert, hotfix and rollback titles:** none. Searched every merged PR's title and branch for "revert", "hotfix" and "rollback".
2. **Reverts on `production`:** none. Ran `git log origin/production --grep=revert`. The only commit it found documents the rollback process; it is not a revert.
3. **Release log:** [releases.md](releases.md) records no rollback.
4. **Render events:** they show no rollback event for the production backend (Render Events, copied 26 Nov 2026). The "Rollback" in that list is the button next to old deploys.
5. **Releases within 48 hours:** for each one, the PRs it shipped were read and any `fix/` PR's description checked to see what it fixed.
6. **Incidents:** compared against release times (see [Service](#2-service)).

| Release | Followed within 48 h by | Caused by this release? |
| --- | --- | --- |
| #197 (9 Nov) | #203, 47.9 h later, with #202: CI fixes and an older undefined colour token | No |
| #203 (10 Nov) | #210, 13 h later, with #208 and #209: rate limits used a proxy's IP (older behaviour) | No |
| #210 (11 Nov) | next release 101 h later | No |
| #236, #239, #242, #245 (15 Nov) | releases of new features | No |
| #248 (15 Nov) | #251, 25 min later, with #250: notification texts from Sprint 3 | No |
| #251 (16 Nov) | next release 8 days later | No |
| #261 (23 Nov) | #266, 10.5 h later: "Held" refresh phases 1 and 2 (features) | No |
| #266 (24 Nov) | #273, 9.8 h later: "Held" refresh phases 3 to 3.2 (design work, no `fix/` PR) | No |
| #273 (24 Nov) | its 48 h window ends 26 Nov 18:51 UTC; nothing so far | too recent to judge |

| | Sprint 4 | Sprint 5 | Project |
| --- | --- | --- | --- |
| Releases judged | 9 | 2 | 11 |
| Failures introduced by a release | 0 | 0 | **0 of 11 (0%)** |
| Literal count (a `fix/` PR in a release within 48 h) | 3 | 0 | 3 of 11 (27%) |
| Reverts / rollbacks | 0 | 0 | 0 |

- **Time to restore after a failed release:** not applicable. No release failed.
- **Production incidents not linked to a release:** time to restore is in [Service](#2-service).
- **Date:** 26 Nov 2026.
- **Caveats:**
  - "Caused by this release" is the team's judgement from each fix PR's description.
  - 11 releases is a small sample.
  - Before 9 November there were no releases to judge.

### Throughput

Merged PRs into `main` per sprint and author (GitHub handles):

| Author | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| jojo-19-lang | 20 | 20 | 7 | 47 | 14 | 108 |
| leenelbaba | 12 | 28 | 37 | 7 | 1 | 85 |
| karimhamdan2006 | 3 | 10 | 6 | 6 | 0 | 25 |
| ArefTurkieh123 | 1 | 6 | 5 | 5 | 1 | 18 |
| Elias-k09 | 1 | 4 | 6 | 3 | 1 | 15 |
| **Total** | **37** | **68** | **61** | **68** | **17** | **251** |

| | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| PRs that declared AI assistance | 21 of 37 | 20 of 68 | 7 of 61 | 62 of 68 | 17 of 17 | **127 of 251 (50.6%)** |

- **How:** `gh pr list --state merged`, by PR author and the Beirut date of the merge. A PR counts as declaring AI assistance if any of these is true:
  - Its description ticks the template's "AI use declared" box (69 PRs).
  - Its description names an AI tool or says it was made with AI (57).
  - One of its commits has a `Co-Authored-By` line naming an AI tool (1).
- **Date:** 26 Nov 2026.
- **Caveats:**
  - PR count is not effort: PRs differ a lot in size.
  - Who opened a PR is not everyone who worked on it.
  - A PR that does not declare AI use is not proof that no AI was used. The PR template with the "AI use declared" checkbox was added on 8 November (`708547d`), which is when declarations became consistent.

### Tests (for context)

The latest CI run on `main` (run 45466997442, commit `7ffd606`, 24 Nov 2026) ran **1,404 backend tests** and **1,055 frontend tests**, all passing. The latest `selenium` run on `main` (run 45466997403, 24 Nov 2026) passed. The test-count history is in [metrics/process.md](metrics/process.md#7-tests).

## 2. Service

Production is https://nabad-psi.vercel.app. The backend is `nabad-backend-nhv5` on Render, and the database is MongoDB Atlas.

### Availability

| Window | Availability | Incidents | Downtime | Source |
| --- | ---: | ---: | ---: | --- |
| Last 24 hours | 99.648% | 1 | 5 m 4 s | screenshot, 24 Nov 2026 |
| Last 7 days | 99.950% | 1 | 5 m 4 s | screenshot, 24 Nov 2026 |
| Last 30 days | **99.590%** | 2 | 3 h 2 m 56 s | screenshot, 24 Nov 2026 |
| Last 365 days | not available | | | the free plan does not show it |
| Rolling 30 days, on 26 Nov | 99.577% | | | [public feed, 26 Nov 2026](evidence/uptime-2026-11-26.json) |
| Rolling 90 days, on 26 Nov | 99.673% | | | [public feed, 26 Nov 2026](evidence/uptime-2026-11-26.json) |
| Mean time between failures (365 days) | 432.98 hours | | | screenshot, 24 Nov 2026 |

- **Target:** 99% each calendar month ([uptime.md](uptime.md)), which allows about 7 h 12 min down in a 30-day month. The 30-day result is above the target.
- **How:** UptimeRobot free plan. An HTTP(S) monitor, "Nabad backend", requests https://nabad-psi.vercel.app/api/health/ready every 5 minutes. That path goes through the Vercel proxy to the Render API, which answers `ready` only when its database connection works. So it measures the whole path a user depends on.
- **Cross-check:** the two incidents below add up to the 30-day downtime: 10,672 s + 304 s = 10,976 s = 3 h 2 m 56 s.

### Incidents

| Date (UTC) | Duration | Detected by | Cause | Deploy-related? | Time to restore |
| --- | --- | --- | --- | --- | --- |
| 1 Nov, 14:15:59 to about 17:13:51 | 2 h 57 m 52 s | UptimeRobot | **Not identified** | Not shown (see below) | 2 h 58 min |
| 23 Nov, 15:29:49 | 5 m 4 s (UptimeRobot); about 2 min (Render) | Render and UptimeRobot | The backend's readiness check returned 503; the instance recovered on its own | No | about 2 min (Render), up to 5 min as UptimeRobot sees it |

**1 November.**

- **Deploys that day:** production was deployed several times. At the time every merge to `main` deployed production. GitHub has 10 successful production deploy records that day, and Render shows backend deploys of #162 to #169 (Render Events, copied 26 Nov 2026).
- **Timing:**
  - #163 went live at 13:45 UTC, 31 minutes before the outage began.
  - #164 went live at 17:09 UTC, about 5 minutes before it ended.
  - Render recorded **no** "Instance failed", "unhealthy" or "Service recovered" event that day, so its own health check never reported the backend instance unhealthy.
- **The changes don't explain it:**
  - [#163](https://github.com/Nabad-team/Nabad/pull/163) only added services and sources to four existing hospital records in `backend/data/providers.js`. That data had loaded without trouble on two earlier deploys that day.
  - [#164](https://github.com/Nabad-team/Nabad/pull/164) only changed medical report analysis (`backend/src/reports/analyze.js`). That code runs on a report request and plays no part in startup, the database connection or `/api/health/ready`.
- **Possible explanations, none confirmed:**
  - A failure on the public path. UptimeRobot goes through the Vercel proxy, while Render checks the instance directly.
  - A hang that Render's check did not catch.
- **Recovery:** the restart that came with the #164 deploy coincided with the recovery.
- **Verdict:** the cause stays not identified, and the incident is not counted as a change failure.

**23 November.**

- **What happened:** Render recorded "Instance failed: HTTP health check failed with status code 503 while running your code" at 15:29 UTC and "Service recovered" at 15:31 UTC (Render Events, copied 26 Nov 2026). UptimeRobot recorded the same incident, starting 15:29:49 UTC and lasting 304 s.
- **Why UptimeRobot shows longer:** it checks every 5 minutes, so it saw the recovery later.
- **Deploy-related:** no. The next event that day was a restart for an environment variable change, at 20:06 UTC.

### Response time

| Measurement | Environment | Result | Source and date |
| --- | --- | --- | --- |
| UptimeRobot readiness check, last 24 hours | Production, whole path | mostly about 400 to 700 ms; peak about 1,280 ms | screenshot, 24 Nov 2026 |
| JMeter, 50 users | Local Docker | median 12 ms, p95 340 ms, 0% errors | [availability-response-time.md](availability-response-time.md#recorded-jmeter-baseline), 18 Oct 2026 |
| JMeter, 200 users | Local Docker | median 12 ms, p95 98 ms, p99 4,021 ms, 0% errors | same, 18 Oct 2026 |
| JMeter, 500 users | Local Docker | median 18 ms, p95 273 ms, p99 17,405 ms, 0.0043% errors | same, 23 Oct 2026 |
| JMeter, 200-user 15-minute soak | Local Docker | median 11 ms, p95 89 ms, 0.0017% errors | same, 18 Oct 2026 |
| JMeter, five-user read-only sample | Production | median 63 ms, p95 504 ms, 6.4516% errors | same, 18 Oct 2026 |
| JMeter on staging | Staging | **pending SCRUM-349** | no result files yet |

**Caveat:** a 5-minute readiness check measures one cheap request, not page loads or a symptom check. The production API runs in Oregon and its database in Frankfurt, which adds to every request ([uptime.md](uptime.md#known-limits)).

### Errors

| Measurement | Result | Source and date |
| --- | --- | --- |
| Errors reported to Sentry, all projects, last 30 days | **0** (accepted 0, filtered 0, rate limited 0, invalid 0) | Sentry Stats & Usage, screenshot, 24 Nov 2026 |

Both projects have their DSN set:

- `javascript-nextjs` (frontend) uses `NEXT_PUBLIC_SENTRY_DSN`.
- `nabad-backend` uses `SENTRY_DSN` and reports **server errors (5xx) only** ([backend/src/errorTracking.js](../backend/src/errorTracking.js)).

So this means **no errors reported to Sentry in 30 days**, not that nothing went wrong:

- Client errors (4xx) are not reported.
- A rules-only result when the AI is unavailable is not an error.
- The 23 November 503 came from the readiness check during an instance failure. It did not reach Sentry as an application error.

### Recovery

| Measurement | Result | Source and date |
| --- | --- | --- |
| Successful nightly backups (dump, restore into a throwaway MongoDB and check, encrypt, upload) | **29** since 7 Nov: 18 scheduled, 11 started by hand | `gh run list --workflow db-backup.yml`, 26 Nov 2026 |
| Failed backup runs | 3: two on 7 Nov while the workflow was being set up, and **the scheduled run on 26 Nov** | same |
| Successful weekly backup verifications | 4 (1 by hand on 7 Nov, then 3 scheduled; last 23 Nov); 2 failed runs on 7 Nov during setup | `gh run list --workflow db-backup-verify.yml`, 26 Nov 2026 |
| Automated restore checks | 29: every successful nightly backup restores its dump and checks collections, document counts and indexes | [backups.md](backups.md) |
| Last monthly decryption drill (restore on the key holder's computer) | **Not recorded.** [backups.md](backups.md#monthly-decryption-drill) describes the drill, but no drill result is written down in the repository | repository, 26 Nov 2026 |
| Last rollback drill | 9 Nov 2026: Vercel Instant Rollback and back, took about 3 s | [rollback.md](rollback.md#rollback-drill) |

**About the 26 November failure:**

- **Where it failed:** the step that installs the pinned backup tools exited with code 141 (a broken pipe), before any database access.
- **What happened next:** the workflow opened issue [#275](https://github.com/Nabad-team/Nabad/issues/275) itself, as designed.
- **Effect:** the newest backup is the one from 25 November.
- **Update: fixed in [#277](https://github.com/Nabad-team/Nabad/pull/277), verified by run [45837859628](https://github.com/Nabad-team/Nabad/actions/runs/45837859628) on 26 Nov.** The cause was `mongodump --version | head -n 1`: `head` closed the pipe early and, under `pipefail`, the SIGPIPE failed the step. That run backed up, restored, encrypted, uploaded and re-checked `nabad-20261126T142012Z` (159,095 bytes encrypted). The counts in the table above are from before the fix.

## 3. Usage

| Measurement, last 30 days (25 Oct to 23 Nov 2026, UTC days) | Result |
| --- | ---: |
| Symptom checks started | **7** |
| Assessments completed (including follow-up rounds) | 11 |
| Follow-up rounds | 4 |
| New accounts | 3 |
| Busiest day for checks | 15 Nov (3) |
| Busiest day for new accounts | 26 Oct (1) |

**Source:** the production team dashboard, screenshot, 24 Nov 2026. The numbers add up: 7 initial assessments plus 4 follow-up rounds make 11 assessments.

**What `/api/usage/summary` measures and how:**

- **What's counted:** each symptom check result the triage API returns successfully (HTTP 200) adds 1 to that UTC day's anonymous counters ([backend/src/usageAnalytics.js](../backend/src/usageAnalytics.js), `countTriageUsage`). The counters are:
  - `assessments`;
  - `sessionsStarted`, for a first assessment;
  - `followupAssessments`, for a request that carries follow-up answers.
- **Counted after the reply:** the counter runs after the response is sent, so it never delays or blocks a clinical result. If the database is unavailable, the count is skipped and only an `usage_analytics_unavailable` event is logged.
- **New accounts:** counted per UTC day from account creation dates only ([backend/src/routes/usage.js](../backend/src/routes/usage.js)).
- **Requests, not people:** the dashboard counts requests, not unique people, and includes rules-only results when the AI is unavailable.
- **Turning it off:** `USAGE_ANALYTICS_ENABLED=false` stops the counting.

**Privacy design:**

- **Anonymous totals only.** The `UsageDaily` collection stores one document per day with three numbers. It holds no user ID, symptom, urgency level, IP address or cookie, and its schema rejects any other field (`strict: "throw"`).
- **90-day expiry.** Each day's counts are deleted after 90 days (a TTL index).
- **Account counts:** only creation dates are read. No ID, name or email leaves the database.
- **Who can see it:** signed-in team members whose *verified* email is in `TEAM_DASHBOARD_EMAILS`. Everyone else gets the same 404 as a route that doesn't exist.
- **Audit log:** each view logs who looked, never what they saw.

**Why the numbers are small:** Nabad is a course pilot without public users. The figures mostly reflect the team, testers and demos, so they say little about adoption.

## 4. Business success

Nabad's goals are to give a safe, understandable triage result, be usable and accessible, and run within a student budget. This maps each goal to existing evidence.

| Goal | Evidence | Result | Source and date |
| --- | --- | --- | --- |
| Never under-triage | Clinical safety set, 109 cases, AI off (the rules alone) | **109 of 109 safe, 0 under-triaged**, 107 at exactly the expected level; 1 known, documented over-triage (`ro-head-bump-playing`) | CI run 45466997442, `main` at `7ffd606`, 24 Nov 2026 (job "Triage clinical safety set": 204 of 204 tests pass) |
| Correct urgency level | Quality set, 50 cases, AI off | **50 of 50 exactly right** (16 emergency, 12 urgent, 11 soon, 11 routine) | same run (job "Triage quality (50 cases)": 104 of 104 tests pass) |
| Clinically reviewed cases | Clinician sign-off on the safety set | 0 of 109 reviewed (sign-off pending) | same run |
| Usable emergency flow | Five-person usability study (Karim) | **0 of 5 human sessions recorded.** The study was changed to automated checks on 16 Nov; [results.md](usability/emergency-flow/results.md) is still the unrun template | repository, 26 Nov 2026 |
| Usable emergency flow (automated) | Five browser scenarios A01 to A05 (emergency pop-up, location share, rules-only emergencies, emergency card, offline card) | **5 of 5 passed** | [automated-results.md](usability/emergency-flow/automated-results.md) (16 Nov 2026); also passing in the `selenium` job of run 45466997403, 24 Nov 2026 |
| Accessible | axe-core 4.10.3, WCAG 2.0/2.1 A and AA, 2.2 AA rules, in CI | 3 of 3 accessibility tests pass (public pages; core signed-in pages and keyboard; modals, search and validation) | `selenium` job, run 45466997403, 24 Nov 2026 |
| Accessible ("Held" refresh) | axe on 19 signed-in pages at 1280 px, 10 at 390 px and 6 public pages | **no violations** | [#270](https://github.com/Nabad-team/Nabad/pull/270), 24 Nov 2026 |
| Accessible colour contrast | Contrast tests for every colour pair in the new palette | pass; for example routine `#0b3a66` on white 11.59:1, amber `#B47F10` on paper 3.19:1 (3:1 needed) | [#264](https://github.com/Nabad-team/Nabad/pull/264), [#272](https://github.com/Nabad-team/Nabad/pull/272), `frontend/__tests__/designTokens.test.js` |
| Run within a student budget | Running cost per month | **Not measured.** No bill or cost figure is recorded in the repository. The docs describe free plans for Render, Vercel (Hobby), MongoDB Atlas (M0), Brevo, the Gemini API (free quota per Google Cloud project) and UptimeRobot. The Backblaze B2 and Sentry plans are not documented | [operations.md](operations.md), [environments.md](environments.md), [uptime.md](uptime.md) |
| Fast result | Time to get a symptom check result | **Not measured.** The JMeter runs don't include the triage endpoint, and the app doesn't log triage duration | repository, 26 Nov 2026 |
| Available | Monthly availability target of 99% | met: 99.590% over 30 days | [Service](#2-service) |

**Caveats:**

- The triage results are for the rules alone, which is what users get when the AI is off, slow or over its limit. Runs with the model are recorded separately in [triage-safety-runs](triage-safety-runs/README.md).
- Passing the safety set shows the rules match the expected levels for these cases. It is not clinical validation.

## Limitations

- **Small numbers.** About 9 weeks, 251 PRs, 11 judged releases, 7 symptom checks. A single unusual day moves the medians a lot.
- **Two release models.** Until 9 November every merge deployed production; since then, release PRs do. Deployment frequency and lead time are not comparable across that line.
- **Sprint 5 is not over.** Its numbers cover 18 to 26 November.
- **Screenshots are not exports.** The UptimeRobot, Sentry and dashboard numbers were read from screenshots taken by Gerges on 24 November. Only the UptimeRobot public feed was captured as a file.
- **One check, every 5 minutes.** An outage shorter than 5 minutes can be missed, and each failed check counts as up to 5 minutes. A failure in the AI provider or email is not downtime.
- **The 1 November cause is unknown.** Render's events show the instance was never reported unhealthy, but logs from that window were not available.
- **Sentry sees server errors only on the backend**, and nothing about slow requests.
- **No human usability data**, no clinician sign-off, no cost figure and no time-to-result measurement.
- **The change failure judgement is the team's own**, from PR descriptions.

## Improvements

1. **Fix the backup failure and log the drills.** Fix the tool-install step behind issue [#275](https://github.com/Nabad-team/Nabad/issues/275) and re-run the backup the same day (done: fixed in #277, verified by run 45837859628 on 26 Nov). Then add a "Drill log" table to [backups.md](backups.md), like [rollback.md](rollback.md#rollback-drill) has, so the monthly decryption drill leaves a dated record. Today the last drill can't be shown.
2. **Keep an incident log.** For each incident, record the start and end in UTC, how it was detected, the cause, the time to restore and the follow-up. Put it in [operations.md](operations.md) or the release log. This report had to rebuild both incidents from screenshots and copied Render events.
3. **Measure time to a symptom check result.** Log the duration of each triage request, anonymously and with no symptom text, next to the existing usage counters. Also add a triage sample to the staging JMeter run (SCRUM-349). Then "fast result" can be measured instead of assumed.
4. **Make `selenium` reliable.** It passes on the first run 86.9% of the time, against 94% to 100% for the other checks. Track each failing test and fix its waits, as #174, #186 and #202 did. This would raise the first-try green rate and shorten lead time.
5. **Get human and clinical evidence.** Run the five usability sessions with real people, or record Karim's results if they were collected elsewhere. Also get clinician sign-off on the 109 safety cases. These are the business goals the project currently can't evidence.

## Slide version

- **Process:** 12 production releases since 9 November (4.7 a week), and 0 of 11 judged releases caused a failure.
- **Service:** 99.59% availability over 30 days, against a 99% target.
- **Usage:** 7 symptom checks and 3 new accounts in 30 days, from a course pilot with no public users.
- **Business success:** 109 of 109 clinical safety cases triaged safely, 0 under-triaged.

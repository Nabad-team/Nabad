# Process metrics

How the team delivered Nabad, measured from GitHub and the [release log](../releases.md), for the final presentation. Snapshot: **26 November 2026**, after release #273 and its release log (#274). The four-part [DevOps measurement report](../devops-measurement.md) builds on these numbers. The numbers are in [process-metrics.json](./process-metrics.json); how to recompute them is at the end.

## Sprints

Sprint dates come from Jira (given by Gerges): two-week sprints, and a PR merged on a boundary day counts in the sprint that ends that day. Dates are Beirut dates.

| Sprint | Dates |
| --- | --- |
| Sprint 1 | 22 September to 6 October 2026 |
| Sprint 2 | 7 to 20 October |
| Sprint 3 | 21 October to 3 November |
| Sprint 4 | 4 to 17 November |
| Sprint 5 | 18 November to 1 December (**in progress**: numbers cover 18 to 26 November) |

## At a glance

| Metric | Whole project |
| --- | --- |
| Merged pull requests | 251 into `main`, plus 12 release PRs into `production` |
| Median time from PR opened to merged | 3.9 minutes (75% within 12 minutes, 90% within 28 minutes) |
| Production releases (since the release process began on 9 November) | 12, about 4.7 per week |
| Production deploys of the app (Vercel, since 12 October) | 142, about 21.6 per week |
| Median lead time, merged to `main` until in production | under 1 minute before 9 November (deploy on merge); 7.2 hours since (release PRs; 90% within 100 hours) |
| Change failure rate (11 releases old enough to judge) | 0 of 11 caused a problem fixed within 48 hours; 3 of 11 were followed within 48 hours by a release containing an unrelated fix |
| CI pass rate of the required checks on PRs | 95.1% of 1,288 check runs; 94.8% of merged PRs passed every check on the first try; median CI duration 2.5 minutes per commit |
| Tests | 3 at the first test commit (26 September); now 1,404 backend, 1,055 frontend and 38 end-to-end tests |

## 1. Merged pull requests

| | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Into `main` | 37 | 68 | 61 | 68 | 17 | **251** |
| Release PRs into `production` | 0 | 0 | 0 | 9 | 3 | **12** |

**How:** `gh pr list --state merged`, grouped by the Beirut date the PR was merged. Closed, unmerged PRs are not counted.

## 2. Time from PR opened to merged

| Minutes | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| Median | 2.8 | 1.4 | 3.8 | 9.7 | 13.2 | **3.9** |
| 75th percentile | 6.3 | 2.3 | 7.5 | 18.3 | 14.6 | 12.3 |
| 90th percentile | 58.7 | 5.8 | 23.5 | 33.6 | 49.4 | 28.1 |
| Merged within 2 minutes of opening | 17 | 43 | 5 | 0 | 0 | 65 |

**How:** `mergedAt` minus `createdAt` of each PR into `main`.

**Caveats:** This is how long a PR stayed open, not how long the work took. The team opened a PR when the work was done on the branch, so most of the time is spent before the PR exists. In Sprints 1 to 3, many PRs were merged before CI finished (65 within 2 minutes). From Sprint 4 every PR waits for the required checks (about 10 to 15 minutes), which is why the median rises. The rise is a stricter process, not slower work.

## 3. Deployment frequency

| | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (1.3 weeks so far) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| Release PRs to `production` per week | n/a | n/a | n/a | 4.5 (9) | 2.3 (3) | **4.7** since 9 November (12) |
| Production deploys of the app per week (Vercel) | not recorded | 26 (52) | 29.5 (59) | 14 (28) | 2.3 (3) | **21.6** since 12 October (142) |

**How:**
- Release PRs are the PRs merged into `production`; they match the 12 rows of the [release log](../releases.md).
- Production deploys are GitHub deployment records with environment "Production" from the official Vercel project (`nabad3`, the app at nabad-psi.vercel.app) that ended in `success`. 32 records from another team member's separate Vercel project were left out.

**Caveats:**
- There were two ways of releasing. Until 9 November, every merge to `main` deployed production straight away, so a merge was a release. Since 9 November (#196, #197), `main` deploys staging and production changes only through a release PR.
- Before 12 October, production was deployed by hand with the Vercel CLI, which left no record, so Sprint 1 can't be counted.
- Render, the backend host, labels every deploy "main - nabad-backend-nhv5", whatever the branch (124 records), so the backend's deploys aren't counted separately. Since 9 November they follow the same release PRs.
- Sprint 4 has 9 releases because 6 of them happened in one evening (15 November), when UI changes were released one at a time.

## 4. Lead time from merge to `main` until in production

| Hours | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| Median | not measured | under 0.1 (n = 50) | under 0.1 (n = 61) | 0.9 (n = 68) | 6.7 (n = 16) | see below |
| Median, release era only | | | | 10.7 | 6.7 | **7.2** (n = 65; 90% within 100 hours) |
| 90th percentile, release era only | | | | 100.0 | 82.1 | 99.8 |

Before 9 November the median was **0.3 minutes** (n = 130): the production deploy started as soon as the PR was merged.

**How:**
- **Release era** (PRs merged from #196, the staging cutover on 9 November): the time until the release PR whose merge commit contains the PR's merge commit (`git merge-base --is-ancestor`).
- **Before that:** the time until the first successful production deploy record on Vercel for a commit that contains the PR.

**Caveats:**
- Both measure until the production deploy **started**. The build adds a few minutes.
- Not measured: Sprint 1 and the start of Sprint 2 (56 PRs merged before 12 October, with no deploy records), and #274, merged after the last release.
- For the early era, the frontend deploy stands for "in production". The backend deployed from the same commit on Render.
- Sprint 4 mixes both eras, so its overall median (0.9 hours) sits between them.

## 5. Change failure rate

**Definition used:** a release counts as a failure if a fix, rollback or hotfix release followed it within 48 hours **for a problem that release introduced**. For transparency, the literal count is shown too: any later release within 48 hours that contained a `fix/` PR.

| Release | Followed within 48 h by | Caused by this release? |
| --- | --- | --- |
| #197 (9 Nov) | #203, 47.9 h later, with #202: CI fixes and a colour token that was never defined (calendar contrast) | No: the bug was older |
| #203 (10 Nov) | #210, 13 h later, with #208 and #209: rate limits used a proxy's IP, and sign-up limits were too low for the campus demo | No: found by the new security scan; older behaviour |
| #210 (11 Nov) | next release after 101 h | No |
| #236, #239, #242, #245 (15 Nov) | releases of new features (#238, #241, #244, #247) | No |
| #248 (15 Nov) | #251, 25 min later, with #250: health details in notification texts | No: those texts date from the notifications feature (Sprint 3) |
| #251 (16 Nov) | next release after 8 days | No |
| #261 (24 Nov) | #266, 10.5 h later: "Held" refresh phases 1 and 2 (#264, #265), features | No |
| #266 (24 Nov) | #273, 9.8 h later: "Held" refresh phases 3 to 3.2 (#270 to #272), design work, no `fix/` PR | No |
| #273 (24 Nov) | too recent to judge (window ends 26 Nov, 18:51 UTC) | |

| | Sprint 1 to 3 | Sprint 4 | Sprint 5 | Project |
| --- | --- | --- | --- | --- |
| Releases judged | n/a | 9 | 2 (#273 too recent) | 11 |
| Failures (introduced by the release) | n/a | 0 | 0 | **0 of 11 (0%)** |
| Literal count (any `fix/` PR in a release within 48 h) | n/a | 3 | 0 | 3 of 11 (27%) |

No rollback was ever needed: no release log entry, no revert PR, and no `production` commit that undoes another.

**Caveats:** Before 9 November there was no release record to judge: changes went to production on merge, and no incidents were logged. The judgement "caused by this release" is ours, based on each fix PR's description. Eleven releases is a small sample. The production incidents on 1 and 23 November were checked against release times; neither followed a release (see the [DevOps measurement report](../devops-measurement.md#incidents)).

## 6. CI pass rate of the required checks

The required checks are `backend-tests`, `frontend-tests`, `docker-build`, `selenium`, `Backup tooling`, `Medical report safety gate` and `Vercel`.

| | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (so far) | Project |
| --- | --- | --- | --- | --- | --- | --- |
| Check runs passed | 89.9% (79) | 95.7% (258) | 93.8% (308) | 95.9% (517) | 96.8% (126) | **95.1%** (1,225 of 1,288) |
| Merged PRs green on the first try | 34 of 36 | 65 of 68 | 55 of 61 | 66 of 68 | 16 of 16 | **236 of 249 (94.8%)** |
| Median CI duration per commit (minutes) | 0.4 | 0.8 | 3.0 | 3.9 | 4.7 | **2.5** (90th percentile 4.3) |

| Check | Runs | Passed | Passed on the first run (commits) | Median job minutes | First run |
| --- | --- | --- | --- | --- | --- |
| `Backup tooling` | 101 | 100% | 100% (100) | 0.2 | 7 Nov |
| `Medical report safety gate` | 121 | 100% | 100% (120) | 0.2 | 1 Nov |
| `docker-build` | 236 | 99.6% | 99.6% (234) | 0.8 | 14 Oct |
| `frontend-tests` | 315 | 95.2% | 95.5% (313) | 0.8 | 26 Sep |
| `backend-tests` | 296 | 94.3% | 94.2% (295) | 0.9 | 29 Sep |
| `selenium` | 219 | 86.3% | 86.9% (214) | 3.2 | 17 Oct |
| `Vercel` (final state on each merged PR's last commit) | 197 PRs | 196 passed | n/a | not measured | 12 Oct |

**How:**
- **Check runs passed:** every GitHub Actions job attempt of the six Actions checks, on every `pull_request` run, including re-runs: success out of success + failure + timed out. Cancelled and skipped runs are left out.
- **Green on the first try:** a merged PR whose last commit passed every required job that ran, on the first attempt.
- **Passed on the first run:** each (check, commit) pair counts once, by its first attempt.
- **CI duration:** per job, its start to its end; per commit, from the first required job's start to the last one's end, on the first attempt. Queue time and the Vercel build are not included.
- **`Vercel`:** a commit status rather than an Actions job, so it is counted on each merged PR's last commit, from the official project only.

**Caveats:**
- The checks were added over time (see "First run"), and branch protection has required all seven only since Sprint 4. Earlier sprints were measured on fewer checks.
- `selenium` is the lowest because browser tests are the most timing-sensitive. Several failures were fixed by making the tests wait properly (#174, #186, #202), not by changing the app.
- A failure later fixed on the same PR still counts as a failure here, which is the point: it shows how often CI caught something.

## 7. Tests

| | First tests (26 Sep, `5a102f1`) | End of Sprint 1 | End of Sprint 2 | End of Sprint 3 | End of Sprint 4 | Now (26 Nov) |
| --- | --- | --- | --- | --- | --- | --- |
| Backend test cases | 0 | 110 | 425 | 736 | 891 | 951 |
| Frontend test cases | 3 | 163 | 379 | 565 | 806 | 900 |
| End-to-end tests (Selenium, Python) | 0 | 0 | 14 | 25 | 37 | 38 |
| **Total** | **3** | **273** | **818** | **1,326** | **1,734** | **1,889** |

In the latest CI run on `main` (run 45466997442, `7ffd606`, 24 November), the suites report **1,404 backend tests** (including the 109-case triage clinical safety set and the 50-case triage quality set) and **1,055 frontend tests**.

**How:** the same static count at each commit, so the numbers compare fairly over time: `test(` and `it(` calls in `backend/tests` and `frontend/__tests__`, and `def test_` functions in `tests/`. The commit is the last one on `main` at the end of each sprint (Beirut time).

**Caveats:** The static count is lower than what the runners report. One `test(` call can run many cases in a loop (each triage case, each page width), and the runners count those separately. Accessibility checks (`tests/accessibility`), the backup drills and the medical report evaluation (9 synthetic reports) are not in these totals.

## Caveats that apply throughout

- **Sprint 5 is not over.** Its numbers cover 18 to 26 November.
- **Small team, short project:** about 9 weeks and 263 PRs, so a few unusual days (six releases on 15 November, quick merges in Sprint 2) move the medians a lot.
- **AI agents worked on many PRs**, as declared in each PR: 127 of 251 PRs into `main` declare AI assistance (per sprint and per author in the [DevOps measurement report](../devops-measurement.md#throughput)). This shortens time to merge and makes PRs more uniform. It doesn't change how the metrics are measured.
- **Only GitHub data** was used. Jira (story points, cycle time from "In progress") was not.

## Recomputing

The scripts are in [scripts/](./scripts). From the repository root, with `gh` signed in:

```sh
mkdir -p /tmp/m && gh pr list --state merged --limit 1000 \
  --json number,title,body,createdAt,mergedAt,baseRefName,headRefName,headRefOid,mergeCommit,author > /tmp/m/prs.json
python -I docs/metrics/scripts/fetch_ci.py /tmp/m        # every PR workflow run and job attempt (about 800 API calls)
python -I docs/metrics/scripts/fetch_deploys.py /tmp/m   # production deploy records and their final status
python -I docs/metrics/scripts/fetch_vercel.py /tmp/m    # the Vercel status on each merged PR's last commit
cp docs/metrics/scripts/testcount.py /tmp/m/ && python -I docs/metrics/scripts/compute.py /tmp/m .
```

`compute.py` has the sprint dates, the snapshot time and the change failure judgements written in it. Update them before running it again.

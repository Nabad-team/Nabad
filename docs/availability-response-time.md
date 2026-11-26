# Availability and response-time evidence

Sprint 5, SCRUM-350. Measurement snapshot captured on 20 November 2026.

## Current production availability

The public UptimeRobot page reports **99.588% over its rolling 30-day window** for the Nabad backend monitor at capture time. The monitor was reporting up. Its daily ratios for 17, 18 and 19 November were each 100.000%. The 20 November row was also 100.000% when captured, but that day was still in progress.

The last downtime shown by the public feed began on 1 November 2026 at 14:15:59 UTC (the UptimeRobot account's time zone is GMT/UTC) and lasted 10,672 seconds, or 2 hours 57 minutes 52 seconds, until about 17:13:51 UTC. The feed does not explain the cause, and none is assigned here.

Production was deployed that day. At the time every merge to `main` deployed production, and GitHub's deployment records show 10 successful production deploys on 1 November. The outage began 33 minutes after the deploy of [#163](https://github.com/Nabad-team/Nabad/pull/163) (13:42 UTC) and ended about 7 minutes after the deploy of [#164](https://github.com/Nabad-team/Nabad/pull/164) (17:06 UTC). Render's events for `nabad-backend-nhv5` agree on the deploys: #163 went live at 13:45 UTC and #164 at 17:09 UTC, about 5 minutes before the outage ended (Render Events, copied 26 Nov 2026). They show no "Instance failed", "unhealthy" or "Service recovered" event at all on 1 November. So Render's own health check never saw the backend instance fail during the outage.

The two changes don't explain it. #163 only added services and sources to four existing hospital records in `backend/data/providers.js`, data the same startup seed had loaded without trouble on two earlier deploys that day. #164 only changed medical report analysis (`backend/src/reports/analyze.js`), which runs on a report request and plays no part in startup, the database connection or `/api/health/ready`.

Possible explanations, none confirmed:

- The failure was on the public path. UptimeRobot calls the backend through the Vercel proxy, while Render checks the instance directly.
- The backend hung in a way Render's check did not catch.

The restart that came with the #164 deploy coincided with the recovery. The cause stays **not identified**, and the incident is not counted as a change failure.

## 23 November incident

UptimeRobot recorded a second, short outage: 23 November 2026 from 15:29:49 UTC for 304 seconds (5 minutes 4 seconds), see the [26 November capture](evidence/uptime-2026-11-26.json). Render recorded the same event (Render Events, copied 26 Nov 2026): "Instance failed: HTTP health check failed with status code 503 while running your code" at 15:29 UTC, and "Service recovered" at 15:31 UTC.

- **Cause:** the backend's readiness check returned 503, and the instance recovered on its own in about 2 minutes. UptimeRobot shows up to 5 minutes because it checks every 5 minutes.
- **Detected by:** both Render and UptimeRobot.
- **Deploy-related:** no. No deploy happened around it. The next event that day was a restart for an environment variable change (the AI settings), at 20:06 UTC.

More detail is in the [DevOps measurement report](devops-measurement.md#2-service).

Source is the public [status page](https://stats.uptimerobot.com/GFwdUOKlhv) and its public monitor feed. The [captured evidence](evidence/uptime-2026-11-20.json) records the exact retrieval timestamp, monitor ID, rolling ratio and recent daily values. Percentages may change after this capture.

The target is 99% per calendar month, as defined in [uptime.md](uptime.md). A rolling 30-day result and a partial sprint do not establish the final November calendar-month or Sprint 5 result. With one request every five minutes, a short failure between samples can be missed. The readiness URL checks the Vercel proxy, Render API and Atlas connection, while AI, mail and other product flows have separate failure paths.

## Recorded JMeter baseline

These results come from the repository's existing JMeter dashboards and raw summary JSON. They were captured in October and describe the environments recorded with those runs.

| Run and date | Environment | Requests | Mean | Median | p95 | p99 | Error rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 users, 18 Oct | Local Docker | 10,419 | 50.2 ms | 12 ms | 340 ms | 468 ms | 0% |
| 200 users, 18 Oct | Local Docker | 37,528 | 123.8 ms | 12 ms | 98 ms | 4,021 ms | 0% |
| 500 users, 23 Oct | Local Docker | 69,461 | 386.8 ms | 18 ms | 273 ms | 17,405 ms | 0.0043% |
| 200-user 15-minute soak, 18 Oct | Local Docker | 231,896 | 80.5 ms | 11 ms | 89 ms | 2,018 ms | 0.0017% |
| Five-user read-only sample, 18 Oct | Production | 620 | 169.4 ms | 63 ms | 504 ms | 961 ms | 6.4516% |

Each aggregate combines its recorded request mix. Sign-in hashing dominates the slow tail under load, while browsing has different costs. An aggregate p95 alone cannot describe sign-in performance or every individual page.

The October production error rate is retained alongside its latency rather than discarded. These historical runs cannot establish the current staging capacity or the current release's error rate. The [JMeter methodology](../loadtest/jmeter/README.md) explains run duration, user mix, think times, early stops, laptop limits and the keep-alive fix.

Raw evidence:

- [50-user statistics](../loadtest/jmeter/reports/load-50-users/statistics.json) and [run settings](../loadtest/jmeter/reports/load-50-users/run.json).
- [200-user statistics](../loadtest/jmeter/reports/load-200-users/statistics.json) and [run settings](../loadtest/jmeter/reports/load-200-users/run.json).
- [500-user statistics](../loadtest/jmeter/reports/load-500-users/statistics.json) and [run settings](../loadtest/jmeter/reports/load-500-users/run.json).
- [Soak statistics](../loadtest/jmeter/reports/soak-200-users-15-min/statistics.json) and [run settings](../loadtest/jmeter/reports/soak-200-users-15-min/run.json).
- [Production sample statistics](../loadtest/jmeter/reports/prod-5-users/statistics.json) and [run settings](../loadtest/jmeter/reports/prod-5-users/run.json).

## Sprint 5 staging comparison

SCRUM-349, measured 26 November 2026 on `main` at `505a8a7`. It has two parts that answer different questions and must not be compared with each other:

- **Part A, local before and after:** the October load and soak runs repeated on the same laptop with the same settings. This is the fair comparison.
- **Part B, staging:** a light, read-only browsing check of the hosted staging environment.

The method is in the [JMeter README](../loadtest/jmeter/README.md). Each run has its own dashboard, `statistics.json`, `run.json` (settings, commit, UTC start and end) and `timeline.csv` in `loadtest/jmeter/reports/<run>-2026-11-26/`.

### Part A: local, October vs 26 November (same laptop)

**Settings, identical to October:**

- Whole app in Docker (Next.js → backend → MongoDB) with the load-test override: rate limits relaxed in the backend container only, and no breach check.
- Half the users browse, half are signed in. Think time 0.5–1.5 s, 30 s response timeout.
- Load runs: 60 s ramp-up, 180 s total. Soak: 60 s ramp-up, 900 s total.
- Same laptop: 12 logical cores, 16 GB RAM, Windows 11, Docker Desktop.

| Run | When (UTC, 26 Nov) | Requests | Requests/s | Average | Median | p90 | p95 | p99 | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 users, October | 18 Oct | 10,419 | 58.7 | 50 ms | 12 ms | 120 ms | 340 ms | 468 ms | 0 |
| **50 users, now** | 15:33:43 to 15:36:51 | 11,044 | **61.6** | **18 ms** | **7 ms** | **16 ms** | **33 ms** | **249 ms** | 0 |
| 200 users, October | 18 Oct | 37,528 | 207.5 | 124 ms | 12 ms | 40 ms | 98 ms | 4,021 ms | 0 |
| **200 users, now** | 15:37:22 to 15:40:34 | 42,326 | **235.5** | **47 ms** | 11 ms | 47 ms | 267 ms | **1,166 ms** | 1 (0.0024%) |
| 500 users, October | 23 Oct | 69,461 | 373.0 | 387 ms | 18 ms | 151 ms | 273 ms | 17,405 ms | 3 (0.0043%) |
| **500 users, now** | 15:41:05 to 15:44:24 | 73,584 | **397.3** | **334 ms** | 17 ms | **45 ms** | **64 ms** | **14,178 ms** | 0 |
| Soak 200 users 15 min, October | 18 Oct | 231,896 | 257.7 | 80 ms | 11 ms | 41 ms | 89 ms | 2,018 ms | 4 (0.0017%) |
| **Soak 200 users 15 min, now** | 15:44:34 to 15:59:56 | 218,960 | 243.4 | 112 ms | 21 ms | 221 ms | 1,255 ms | 3,955 ms | 253 (0.12%) |

**Logins, the request that dominates the slow tail:**

| Users | Login average, October → now | Login p95, October → now | Logins/s, October → now |
| --- | --- | --- | --- |
| 50 | 412 → 229 ms | 525 → 284 ms | 2.8 → 2.9 |
| 200 | 2,561 → 708 ms | 4,760 → 1,512 ms | 8.7 → 10.8 |
| 500 | 11,990 → 10,184 ms | 18,176 → 14,300 ms | 10.9 → 12.3 |

**What it shows:**

- **The load runs are faster than in October at every level**, mostly in the tail. Logins are quicker and the login ceiling rose from about 11 to about 12 per second. At 500 users the p95 fell from 273 to 64 ms.
- **The 200-user p95 rose (98 → 267 ms) without anything getting slower.** Every non-login request is faster: the slowest per-request p95 fell from 69 to 50 ms, and the login p95 fell from 4.8 to 1.5 s. Logins are 4.6% of requests. Now that many finish in a few hundred milliseconds, the 95th-percentile point lands on a fast login instead of a page.
- **The one error at 200 users** was a `503` from `/api/health/ready`: its database ping has a 1.5 s limit, and it answered "unavailable" while the CPU was busy hashing logins. October's 500-user errors were the same.
- **The soak is worse overall, because of one stall.**
  - About 820–860 s into the run, throughput fell to 33 requests a second with a 2.5 s median, and one 10-second window had no samples at all.
  - The `docker stats` sampler skipped a sample. MongoDB's CPU rose to 108–204% and its memory from 328 to 491 MiB, then both returned to normal.
  - All 253 errors are readiness `503`s in the 20 seconds right after.
  - MongoDB logged no slow queries but 49 new connections in that minute; the backend logged no errors.
  - Outside that minute, the 10-second windows look like October's (p95 mostly 50–300 ms).
  - The cause is not identified. A stall of the whole Docker stack or the laptop fits best: `docker stats` stalling was also seen in October's 4,000-user stress test. One repeat of the soak would show whether it recurs.

**What changed since October that could explain differences:**

- **App:**
  - The "Held" refresh is frontend only.
  - The backend gained per-account daily AI limits and triage calibration. Neither is on the tested paths: no symptom checks run in these scenarios.
  - Dependency upgrades, for example `mongoose` 8.24.8.
  - The password-hashing code and the `argon2` library are **unchanged**, so the faster logins are not explained by an app change.
- **Local environment:**
  - The local MongoDB is **7.0** instead of 8.0. It was switched because 8.0 fails on CI's newer Linux kernel.
  - The backend image is pinned to Node 24.22.1 instead of an unpinned `node:24-slim`.
  - `TRUST_PROXY` was removed from the stack.
  - The laptop's own state (updates, background load) differs between dates.

  These are the likelier reasons for the faster logins. This comparison can't separate them, so no improvement is claimed for the app itself.

### Part B: staging, read-only browsing (hosted)

`node loadtest/jmeter/run.js staging`, a new read-only mode modelled on `prod`:

- **Scope:** anonymous browsing only (`/`, `/login`, `/signup`, `/api/health/ready`); signed-in steps are refused.
- **Host:** only `nabad-staging.vercel.app`.
- **Stop rule:** it stops early if errors stay above 5% for 20 s.
- **Rate limits:** staging kept its real limits and settings.
- **Wake-up first:** staging was woken before the run. Its first `/api/health/ready` took 39.9 s (a free-instance cold start), then answered `ready`.

| | Value |
| --- | --- |
| Target | https://nabad-staging.vercel.app (Vercel → Render → Atlas), `main` at `505a8a7` |
| When (UTC) | 26 Nov 2026, 16:03:16 to 16:06:24 |
| Users and duration | 10 browsing users, 10 s ramp-up, 180 s total, think time 0.5–1.5 s |
| Samples | 1,974 |
| Errors | **0** (no `429`s; the run was not stopped early) |
| Throughput | 11.0 requests/s |
| Mean | 127 ms |
| p50 / p90 / p95 / p99 | 74 / 249 / 280 / 465 ms |
| Pages (`/`, `/login`, `/signup`) | median 68–69 ms, p95 136–188 ms |
| `/api/health/ready` | median 237 ms, p95 337 ms, p99 520 ms |

### Local and hosted are different measurements

Part A ran everything on one laptop, with the network hop inside Docker. Part B goes over the internet to Vercel, then to the Render API, then to the Atlas database, which is why `/api/health/ready` takes about 240 ms there and about 10 ms locally. Part B used 10 users, against 50 to 500 in Part A. Neither part says how many users a hosted environment can carry.

### Time to a symptom check result (staging)

On 26 Nov 2026 (16:24:45 to 16:30:54 UTC), one new throwaway account (an `example.invalid` address, test data only) ran 5 mild symptom checks, one about every minute, against staging. Examples: "mild sore throat since yesterday", "small paper cut on my finger this morning". Each was timed from sending `POST /api/triage/ai-assess` to receiving the whole response, so it includes the Vercel proxy, the Render API, the database and the AI model, but not the browser drawing the page. The account was then deleted through the app (`DELETE /api/profile/me`, 204).

| Check | Time | Level | Answered by |
| --- | ---: | --- | --- |
| 1 | 21.0 s | routine | AI |
| 2 | 10.6 s | routine | AI |
| 3 | 35.4 s | routine | AI |
| 4 | 56.6 s | routine | AI |
| 5 | 2.6 s | routine | AI |
| **Median / maximum** | **21.0 s / 56.6 s** | | |

The results are in [loadtest/time-to-result/staging-2026-11-26.json](../loadtest/time-to-result/staging-2026-11-26.json), measured with [time-to-result.js](../loadtest/time-to-result/time-to-result.js).

**Caveats:**

- Times varied by a factor of 20 within 6 minutes. Each check makes one model call, so the variation is most likely the AI provider's response time or the backup model taking over. The backend logs which model answered (`triage_ai`, with `modelAttempts`), and Render's logs for that window would show it; they were not checked.
- **An earlier attempt the same day** (16:06 to 16:19 UTC; [record](../loadtest/time-to-result/staging-2026-11-26-first-attempt.json)):
  - Its first two checks took 3.1 s and 2.5 s.
  - The third check, sent at about 16:08:55, got no response for about 5 minutes. After it, the account-deletion request failed as well.
  - Deleting an account doesn't involve the AI, so staging as a whole most likely stopped answering for several minutes. At 16:24 it answered normally again.
  - That attempt's test account (synthetic data, `example.invalid`) could not be deleted and stays on staging.
- Five checks is a small sample, kept small to protect the shared AI quota.

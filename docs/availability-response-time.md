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

**Pending SCRUM-349.** Gerges owns the new JMeter staging run. Its result files had not been supplied as of this report, so no Sprint 5 latency figures or improvement percentages are claimed.

When the run is available, add its commit, UTC start and end times, target environment, user counts, ramp, duration, scenario mix, timeouts, total samples, errors, throughput, mean and p50/p95/p99. Keep the source dashboard and statistics together with the run settings. Compare matching scenarios and label the local-to-hosted environment difference. Read-only production checks and a staging load test measure different operating conditions.

Before the final presentation, refresh the UptimeRobot snapshot with a stated observation window and update this comparison from the measured staging results.

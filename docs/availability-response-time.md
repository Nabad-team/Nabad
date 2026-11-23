# Availability and response-time evidence

Sprint 5, SCRUM-350. Measurement snapshot captured on 20 November 2026.

## Current production availability

The public UptimeRobot page reports **99.588% over its rolling 30-day window** for the Nabad backend monitor at capture time. The monitor was reporting up. Its daily ratios for 17, 18 and 19 November were each 100.000%. The 20 November row was also 100.000% when captured, but that day was still in progress.

The last downtime shown by the public feed began on 1 November 2026 at 14:15:59 in the feed's timestamp format and lasted 10,672 seconds, or 2 hours 57 minutes 52 seconds. The feed does not explain the cause, so none is assigned here.

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

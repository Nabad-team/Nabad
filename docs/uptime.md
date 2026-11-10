# Uptime and the status page

Our target is **99% uptime each calendar month** for production (https://nabad-psi.vercel.app). In a 30-day month that allows about 7 hours 12 minutes of downtime (about 7 hours 26 minutes in a 31-day month). Anyone can see how we're doing on our public status page: https://stats.uptimerobot.com/GFwdUOKlhv. It's linked as "Status" in the footer of every page and from the Contact page.

## How we measure it

[UptimeRobot](https://uptimerobot.com) requests https://nabad-psi.vercel.app/api/health/ready every 5 minutes. That one request goes through the whole chain a user depends on:

1. **Vercel** serves the request and rewrites `/api/*` to the API.
2. **The API** on Render (`nabad-backend-nhv5`) answers it.
3. **The database**: `/api/health/ready` only returns `{"status":"ready"}` when the API's MongoDB Atlas connection works.

If any of the three is down, the check fails and counts as downtime. The monthly uptime percentage on the status page is our number against the 99% target. Because the check runs every 5 minutes, an outage shorter than that can be missed, and each failed check counts as up to 5 minutes down.

## What else UptimeRobot does

- **Keeps production awake.** Render's free plan puts a service to sleep after 15 minutes without traffic. The 5-minute check means `nabad-backend-nhv5` never sleeps, so real users don't hit a cold start. This uses about 720–744 of the workspace's 750 free instance hours a month.
- **Never add a monitor for staging.** Staging is meant to sleep when idle. A monitor would keep it awake and use up its workspace's free hours; see [environments.md](./environments.md#limits-we-share-and-rules-that-follow-from-them). The same goes for PR previews and any other free Render service.

## When it alerts

When a check fails, UptimeRobot emails the alert contacts on the UptimeRobot account (today Gerges, who set the monitor up under SCRUM-283), and emails again when the site is back up. Whoever sees the alert first tells the team, then checks, in this order:

1. **Render logs.** `nabad-backend-nhv5` → **Logs** and **Events**: did the service crash, fail to start, run out of memory, or is a deploy in progress? A startup error about missing or wrong settings points to the environment variables.
2. **Atlas.** Is the "Nabad" cluster up? Look for a paused cluster, an Atlas incident, connection limits or a changed network access list. If the API runs but `/api/health/ready` doesn't answer `ready`, the database is the likely cause.
3. **Vercel.** Did the latest production deployment fail, or is Vercel having an incident? Check whether https://nabad-psi.vercel.app itself loads.
4. **A release?** If the outage started right after a release to production, follow [rollback.md](./rollback.md): roll back first, find the cause afterwards. The rollback target is in [releases.md](./releases.md).

Also check the providers' own status pages (Render, MongoDB Atlas, Vercel) before digging into our code. When it's over, note what happened and how long it lasted in the team chat, and in the release log if a release caused it.

## Known limits

- **Free Render.** If the service does fall asleep or restarts (for example after a deploy or a crash), the first request waits for a cold start of up to a minute. A check that times out during that counts as downtime. Render's free plan has no uptime guarantee.
- **Atlas M0 has no SLA.** The free cluster can be paused or briefly unavailable during Atlas maintenance, and MongoDB promises nothing about its uptime.
- **Oregon and Frankfurt.** The production API runs in Oregon while its database is in Frankfurt, so every query crosses the Atlantic. This makes requests slower, and a slow network between the two can make a health check time out. Moving production to Frankfurt is a follow-up in [environments.md](./environments.md#follow-ups).
- **One check, one location.** We only check one URL from UptimeRobot's servers, every 5 minutes. A problem that only affects some pages (say, the AI provider or email) won't show as downtime; Sentry catches those errors instead.

Because every part of our hosting is on a free plan, 99% is the target we can honestly aim for. A higher target would need paid plans with their own SLAs.

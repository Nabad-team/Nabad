# Operations guide

This guide covers what we run, who can get into each service, and what to do when something breaks. It mostly points to the docs that already explain each part, so keep the details there and only the links here.

## What runs where

| Service | What it does for us | Production | Staging | Dashboard | More |
|---|---|---|---|---|---|
| **Vercel** | Hosts the web app and forwards `/api/*` to Render | team `nabad3`, project `nabad`, Production environment: https://nabad-psi.vercel.app | Same project, Preview environment: https://nabad-staging.vercel.app and PR previews | https://vercel.com/nabad3/nabad | [environments.md](./environments.md) |
| **Render** | Runs the API | service `nabad-backend-nhv5` (Oregon), Blueprint "Nabad1", Auto Sync off | service `nabad-backend-staging` in its own workspace "Nabad Staging" (Frankfurt) | https://dashboard.render.com | [environments.md](./environments.md#render-only-deploys-backend-changes) |
| **MongoDB Atlas** | The database | `nabad_production` on cluster "Nabad" (Frankfurt) | `nabad_staging` on its own free cluster, in its own Atlas project | https://cloud.mongodb.com | [environments.md](./environments.md#how-the-two-stay-apart) |
| **Backblaze B2** | Stores the encrypted nightly backups | Private bucket in EU Central | Not backed up | https://secure.backblaze.com/b2_buckets.htm | [backups.md](./backups.md) |
| **Brevo** | Sends email (verification, reset, 2FA, invites) | One account for both; 300 emails a day shared | Same account, subjects start with `[Staging]` | https://app.brevo.com | [environments.md](./environments.md#limits-we-share-and-rules-that-follow-from-them) |
| **Google Gemini** | The AI for the symptom check, the health assistant and report review | Production's own Google Cloud project and key | Staging's own Google Cloud project and key | https://aistudio.google.com/apikey | [ai-fallback.md](./ai-fallback.md), [assistant-troubleshooting.md](./assistant-troubleshooting.md) |
| **OpenRouteService** (HeiGIT) | Driving-time estimates in the provider directory | `OPENROUTESERVICE_API_KEY` on `nabad-backend-nhv5` | `OPENROUTESERVICE_API_KEY` on the staging service, if set | https://account.heigit.org | [provider-directory.md](./provider-directory.md) |
| **Sentry** | Error reports, scrubbed of health and personal data | Tagged `production` | Same projects, tagged `staging` | https://sentry.io | [architecture.md](./architecture.md#error-tracking-sentry) |
| **UptimeRobot** | Checks production every 5 minutes, alerts, public status page | https://nabad-psi.vercel.app/api/health/ready | Never monitored (it must be allowed to sleep) | https://dashboard.uptimerobot.com, status page https://stats.uptimerobot.com/GFwdUOKlhv | [uptime.md](./uptime.md) |
| **GitHub Actions** | Required checks on pull requests, nightly backups, weekly backup check, ZAP scans | Repository `Nabad-team/Nabad` | | https://github.com/Nabad-team/Nabad/actions | [testing.md](./testing.md), [backups.md](./backups.md), [security-scanning.md](./security-scanning.md) |

## Who has access

| Who | Access |
|---|---|
| **Gerges** | Everything: every dashboard above, the release and rollback steps, and the backup private key, which is kept offline ([backups.md](./backups.md#encryption-and-the-private-key)). |
| **Leen** (second person) | **GitHub:** an owner of the `Nabad-team` organization, so Leen can manage the repository, Actions, secrets and branch protection if Gerges is unavailable. **UptimeRobot:** gets every alert, because UptimeRobot's alert emails to Gerges are forwarded to Leen by Gmail. No UptimeRobot login. |
| Everyone else | GitHub access for pull requests. No dashboards. |

**What our free plans don't allow.** Render's free (Hobby) workspaces and Vercel's Hobby plan have no team members: inviting someone needs a paid plan (Render Professional, Vercel Pro). So Leen can't log in to Render or Vercel. Supervised access works like this instead: if production needs a rollback or a dashboard check and Gerges can't do it alone, Gerges shares the screen on a call and Leen follows the checklist in [rollback.md](./rollback.md). Nobody shares Gerges's passwords.

Coding agents never act in a production dashboard on their own; they stop and ask first ([AGENTS.md](../AGENTS.md#how-agents-work)).

### Secrets: names and places only

Values never go in git, chat, Jira or issues. Each one lives only in its dashboard. Staging and production always have **different** values. The full table with staging and production side by side is in [environments.md](./environments.md#which-secrets-live-where).

| Where | Names |
|---|---|
| **Render** (`nabad-backend-nhv5`, and the staging service) | `MONGO_URI`, `JWT_SECRET`, `TWO_FACTOR_CODE_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `LLM_PROVIDER`, `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (production only), `SENTRY_DSN`, `API_PROXY_SECRET`, `OPENROUTESERVICE_API_KEY` |
| **Render, settings that aren't secret but matter** | `API_PROXY_REQUIRED=true` on production since 2026-11-13: direct calls to `onrender.com` get 403 except the health checks ([Client IP](./environments.md#client-ip)). Remove it first if the proxy secret ever needs to be rolled back. |
| **Vercel** (Production and Preview environments) | `BACKEND_URL`, `API_PROXY_SECRET` (must equal Render's for the same environment), `NEXT_PUBLIC_SENTRY_DSN`, and `SENTRY_AUTH_TOKEN` if source maps are uploaded; Preview also `NEXT_PUBLIC_APP_ENV` |
| **GitHub Actions secrets** | `BACKUP_MONGODB_URI`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`, `B2_ENDPOINT`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` |
| **Offline, with Gerges** | The backup private key (age) |

## When something breaks

First, post in the team chat and tag Gerges. Then work down the checklist for the case. If it started right after a release, go straight to [Bad release](#bad-release).

### Site down

1. Open https://nabad-psi.vercel.app/api/health/ready. If it doesn't return `{"status":"ready"}`, follow the order in [uptime.md](./uptime.md#when-it-alerts): Render logs and events, then Atlas, then Vercel.
2. Check the status pages of Render, Atlas and Vercel before looking at our code.
3. A cold start can take up to a minute (see [Known limits](#known-limits)). Retry once before calling it an outage.

### Login failing or 403s

1. A **403 "Please use the Nabad app."** means a request reached Render without the proxy secret. Through the app this means `API_PROXY_SECRET` differs between Vercel and Render, or Vercel hasn't redeployed since it changed. Check https://nabad-psi.vercel.app/api/health/client-ip says `"viaAppProxy": true` ([Client IP](./environments.md#client-ip)). Direct calls to `onrender.com` getting 403 is expected.
2. **429** means a rate limit. The limits per account and network are in [Client IP](./environments.md#client-ip).
3. Sign-in codes not arriving: see [Emails not arriving](#emails-not-arriving).
4. Errors (500): check Sentry and Render logs for the request ID the user sees. If a release just went out, [roll back](./rollback.md).

### AI not answering

1. `/api/health/ready` does not test the AI, so the site can be up while the AI isn't.
2. Look up the reference the user saw in Render logs, then run `npm run ai:check` (and `-- --live`) as described in [assistant-troubleshooting.md](./assistant-troubleshooting.md).
3. `usage_limit` (429) means the Gemini quota is used up; it resets at midnight Pacific time. The backup model and the daily budget are in [ai-fallback.md](./ai-fallback.md).
4. The safety rules in triage still work without the AI.

### Emails not arriving

1. Check spam, then Brevo's transactional email logs for the address: was it sent, bounced or blocked?
2. Check the 300-a-day limit in Brevo. Staging and production share it, and a staging scan can use it up ([environments.md](./environments.md#limits-we-share-and-rules-that-follow-from-them)).
3. Check Render logs for SMTP errors. Render's free plan only allows port 2525 ([architecture.md](./architecture.md#production)).

### Driving times missing

1. The directory still works without them; only the minutes are missing, and approximate pins never get one ([provider-directory.md](./provider-directory.md)).
2. `POST /api/providers/travel-time` answers **503** when `OPENROUTESERVICE_API_KEY` is missing on Render, or when OpenRouteService fails, times out (5 seconds) or refuses the key. The failure isn't logged.
3. In https://account.heigit.org, check the key is still valid and how much of its daily quota is left.
4. Check whether HeiGIT has retired the endpoint the code calls (see [Known limits](#known-limits)).

### Bad release

Follow [rollback.md](./rollback.md): roll back Render and Vercel to the rollback target in [releases.md](./releases.md), then revert through a pull request, then turn automatic deploys back on. Gerges does it, or Leen on a call with Gerges (see [Who has access](#who-has-access)).

### Database problem

1. If the API runs but `/api/health/ready` isn't `ready`, it's the database: check the "Nabad" cluster in Atlas (paused, Atlas incident, connection limit, network access list) ([uptime.md](./uptime.md#when-it-alerts)).
2. Lost or damaged data: restore into a **new** database first, never straight over production, as in [backups.md](./backups.md#restoring-a-backup). Restoring needs Gerges's private key.
3. A `backup-failure` issue on GitHub: [backups.md](./backups.md#when-a-backup-failure-issue-opens).

## Known limits

- **Cold starts.** Everything runs on free plans. A Render service sleeps after 15 minutes without traffic, and the first request then waits up to a minute. UptimeRobot keeps production awake; staging sleeps on purpose ([uptime.md](./uptime.md#known-limits)).
- **Shared Render hours.** Each Render workspace gets 750 free instance hours a month, shared by all its services. Production uses about 720–744 on its own, so never add a second free service or a monitor to its workspace, or move staging back there ([environments.md](./environments.md#limits-we-share-and-rules-that-follow-from-them)).
- **Oregon and Frankfurt.** The production API runs in Oregon and its database in Frankfurt, so every query crosses the Atlantic. Render can't change a service's region; moving needs a new service ([environments.md](./environments.md#follow-ups)).
- **Alerts go to one email address.** UptimeRobot emails Gerges's address only. Leen gets alerts through Gmail forwarding, so if that forwarding stops, nobody but Gerges hears about an outage.
- **OpenRouteService is moving to `api.heigit.org`.** HeiGIT is moving the OpenRouteService API to `api.heigit.org`. Our code still calls `https://api.openrouteservice.org` (`MATRIX_URL` in [travelTime.js](../backend/src/providers/travelTime.js)), so driving times will stop when the old address is retired. Update it through a normal pull request and release before then.
- **No SLAs.** Atlas M0, Render free and Vercel Hobby promise nothing about uptime. Our target is 99% a month ([uptime.md](./uptime.md)).
- **Few rollback points.** Render keeps the last 5 builds and Vercel Hobby can only go back one deployment ([rollback.md](./rollback.md#fast-rollback)).

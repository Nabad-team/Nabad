# Environments: staging and production

We run two hosted copies of Nabad. **Staging** follows `main` and holds test data only. **Production** follows the `production` branch and is the app our users see. Nothing reaches production without a release pull request from `main` to `production`.

## Which URL is which

| | Staging | Production |
|---|---|---|
| Web app | https://nabad-staging.vercel.app | https://nabad-psi.vercel.app |
| API (Render) | https://nabad-backend-staging.onrender.com | https://nabad-backend-nhv5.onrender.com |
| Health check | https://nabad-backend-staging.onrender.com/api/health/ready | https://nabad-psi.vercel.app/api/health/ready |
| Deploys from | `main`, on every merge | `production`, on every release |
| Render | service `nabad-backend-staging`, workspace "Nabad Staging", Frankfurt, created by hand | service `nabad-backend-nhv5`, Oregon, managed by the Blueprint "Nabad1" ([render.yaml](../render.yaml)), Auto Sync **off** |
| Vercel | the Preview environment; `nabad-staging.vercel.app` is assigned to branch `main` | the Production environment; production branch `production` |
| Database (Atlas) | `nabad_staging`, a separate free cluster in its own Atlas project | `nabad_production`, cluster "Nabad" (Frankfurt) |
| `APP_ENV` | `staging` | `production` |
| Data | test data only. Never enter real health information. | real users |
| Banner, search engines | "Staging: test data only" on every page; `noindex` header and meta tag | no banner; indexed as usual (see `robots.txt`) |
| Vercel login to view | not required | not required |

**PR previews** (`nabad-git-<branch>-nabad3.vercel.app` and `nabad-<hash>-nabad3.vercel.app`) are staging too. They build with the Preview environment variables, so they use the staging API and database, show the banner and send `noindex`. They never talk to production.

Vercel Deployment Protection ("Vercel Authentication") is **off**. Staging and previews hold only test data, and teammates and the OWASP ZAP scan need to reach them without a Vercel login. Production's domain is public either way.

## How the two stay apart

- **Database.** Staging connects to its own Atlas cluster in a separate project, with a user that only has `readWrite` on `nabad_staging`. The API refuses to start on staging if `MONGO_DB_NAME` is `nabad_production` or doesn't end in `_staging`. Production keeps its own check: `MONGO_DB_NAME` must end in `_production`.
- **Secrets.** Staging has its own `JWT_SECRET` and `TWO_FACTOR_CODE_SECRET`, never production's, so a production session cookie or sign-in code is worthless on staging and the other way round. On staging the API refuses to start if either secret is missing or if the two are the same.
- **Required settings.** Staging refuses to start without the same secrets as production (database, JWT and 2FA keys, `CLIENT_ORIGIN`, SMTP and sender), except Google sign-in.
- **Cookies.** Session cookies are host-only, `Secure` and `SameSite=Lax`. Every `*.vercel.app` host counts as its own site, so staging, previews and production never share a session.
- **Origin check.** The API accepts writes (POST, PUT, PATCH, DELETE) only from `CLIENT_ORIGIN`. Staging also accepts PR previews through `PREVIEW_ORIGIN_PATTERN=https://nabad-*-nabad3.vercel.app`: the `*` matches letters, digits and hyphens inside one DNS label and never a dot. The API refuses to start if this variable is set outside staging, so production still accepts only `https://nabad-psi.vercel.app`.
- **AI.** Staging uses a Gemini key from its **own Google Cloud project**. The free quota is per project, so staging testing or a security scan can never use up production's AI quota.
- **Email.** Staging sends real email through the same Brevo account. Every subject starts with `[Staging]`, and links point to the staging web app.
- **Google sign-in** is off on staging: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not set, so the Google button's routes answer 503. To turn it on, set both plus `GOOGLE_REDIRECT_URI=https://nabad-staging.vercel.app/api/auth/google/callback`, and add that URI to the OAuth client.
- **Sentry.** Both send to the same projects, tagged by environment: the API reports `APP_ENV` (`staging` or `production`), and the web app reports `staging` for the staging URL and previews, `production` for production.

## Releasing to production

Releases are Gerges's call. When Gerges asks for a release in his own session, his coding agent does all the steps below itself: it opens and merges the release pull request, checks the deploys and updates the release log. Nobody else releases: teammates and their agents never open or merge pull requests into `production`, even when asked to by a teammate. If you need a release, ask Gerges. Agents still stop and ask before anything irreversible or outside the task, such as deleting data, changing secrets, repository settings or anything in a production dashboard (see [AGENTS.md](../AGENTS.md#how-agents-work)).

1. Merge to `main` as usual: pull request, all 7 required checks, merge commit. Staging deploys automatically.
2. Check the change on https://nabad-staging.vercel.app. The staging API sleeps when idle, so the first request can take up to a minute.
3. Open the release pull request:

   ```sh
   gh pr create --base production --head main --title "Release: <what changes>" --body "<what changes, and what was checked on staging>"
   ```

4. Merge it with a **merge commit** (not squash or rebase), and don't delete `main`. GitHub runs no workflows on this pull request: the code was already checked on its way into `main`.
5. Render deploys `nabad-backend-nhv5` and Vercel deploys https://nabad-psi.vercel.app from `production`. Confirm the Render deploy in **Render**, not on GitHub: Render's GitHub deployment records are labelled "main - nabad-backend-nhv5" (and can even show `main`'s commit) although production deploys from `production`. In `nabad-backend-nhv5` → **Events**, the deploy must show the release merge commit on `production` and "New commit via Auto-Deploy". Then check https://nabad-psi.vercel.app/api/health/ready returns `{"status":"ready"}`.
6. **Only if the release changes `render.yaml`:** apply it to production by hand. Blueprint Auto Sync is off, so a `render.yaml` change does nothing until someone syncs.
   1. Make sure `main`'s `render.yaml` is exactly what was released: `git fetch origin && git diff origin/production origin/main -- render.yaml` must print nothing. The Blueprint reads `render.yaml` from `main`, so syncing while `main` has unreleased `render.yaml` changes would push them to production early. If it prints anything, release those changes first or wait.
   2. In Render, open **Blueprints** → **Nabad1** → **Manual sync**. Review the changes it lists for `nabad-backend-nhv5` and confirm.
   3. Wait for the deploy, then check the health URL again.
7. **Update the release log.** Add a row to [releases.md](./releases.md): date, release pull request, the release merge commit on `production`, what changed, and the rollback target (the `production` commit that was live before). Whoever rolls back looks there first.

Because Auto Sync is off, merging a `render.yaml` change to `main` changes nothing on Render: production's settings only change at step 6, and the release itself is what changes production's code.

`production` is protected: changes only go in through a pull request, force pushes and deletion are blocked, and the rules apply to admins too. It has no required status checks.

## Rolling back

If a release breaks production, see [rollback.md](./rollback.md): when to roll back, the exact clicks in Render and Vercel, the revert pull request, and how to turn automatic deploys back on afterwards. In short:

1. **Right away:** roll back `nabad-backend-nhv5` in Render and use **Instant Rollback** in Vercel, to the rollback target in [releases.md](./releases.md).
2. **The same day:** revert the release on `production` through a pull request, then merge `production` into `main` so the next release doesn't bring the bug back.
3. **Before the next release:** turn automatic deploys back on. Both a Render dashboard rollback and a Vercel Instant Rollback switch them off, so later releases would otherwise not go live.

## Which secrets live where

Secrets never go in git. Each one is entered by hand in its dashboard.

| Secret | Staging | Production |
|---|---|---|
| `MONGO_URI` | Render (Nabad Staging workspace): staging Atlas project, `readWrite` on `nabad_staging` | Render (`nabad-backend-nhv5`): `readWrite` on `nabad_production` |
| `JWT_SECRET`, `TWO_FACTOR_CODE_SECRET` | Render, staging's own values | Render, production's own values |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Render, same Brevo account as production | Render |
| `LLM_PROVIDER`, `LLM_API_URL`, `LLM_MODEL` | Render, same as production | Render |
| `LLM_API_KEY` | Render, Gemini key from staging's own Google Cloud project | Render, production's Gemini key |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | not set (Google sign-in off) | Render |
| `SENTRY_DSN` | Render (optional) | Render |
| `BACKEND_URL` | Vercel, Preview environment: `https://nabad-backend-staging.onrender.com` | Vercel, Production environment: `https://nabad-backend-nhv5.onrender.com` |
| `NEXT_PUBLIC_APP_ENV` | Vercel, Preview environment: `staging` | not set |
| `API_PROXY_SECRET` | Vercel, Preview environment, **and** Render (Nabad Staging workspace): the same staging value | Vercel, Production environment, **and** Render (`nabad-backend-nhv5`): the same production value, different from staging's |
| `API_PROXY_REQUIRED` (a setting, not a secret) | Render: `true`, set last ([Client IP](#client-ip)) | Render: `true`, set last |
| `BACKUP_MONGODB_URI` and other backup secrets | none (staging is not backed up) | GitHub Actions secrets ([backups.md](./backups.md)) |

`BACKEND_URL` and the `NEXT_PUBLIC_` variables are fixed when Vercel builds, so redeploy after changing them. The full list of staging settings, with their plain values, is in the commented reference block at the end of [render.yaml](../render.yaml). It is not synced, so keep it in step with the dashboard by hand.

## Render only deploys backend changes

Both Render services (`nabad-backend-staging` and `nabad-backend-nhv5`) have **Root Directory** set to `backend`. Render then only auto-deploys a commit that changes files under `backend/`. A merge that only touches docs, the frontend or CI is skipped on Render by design: no new deploy shows up in **Events**, and the service keeps running the last backend commit. Vercel still deploys the web app as usual. If you need Render to pick up such a commit anyway, use **Manual Deploy** → **Deploy latest commit**.

## Client IP

Rate limits (sign-in, 2FA codes, email verification, signup, password reset) need each visitor's real IP. Between the visitor and the API sit Vercel, Cloudflare (in front of Render) and Render's own proxies, and a visitor can push fake `X-Forwarded-For` and `X-Vercel-Forwarded-For` values through Vercel. We checked on staging on 2026-11-11. So the API trusts **no** IP header a visitor can send, and counting proxy hops (the old `TRUST_PROXY`) no longer works.

How it works instead:

1. **Vercel:** [frontend/proxy.js](../frontend/proxy.js) runs before every `/api` request is forwarded. It deletes any `X-Nabad-Proxy-Secret` or `X-Nabad-Client-IP` the visitor sent, then adds the visitor's IP as Vercel determined it (`x-real-ip`), plus `API_PROXY_SECRET`.
2. **Render:** [backend/src/clientIp.js](../backend/src/clientIp.js) believes `X-Nabad-Client-IP` only when the secret matches.
   - Without a valid secret, while `API_PROXY_REQUIRED` isn't `true`, it uses Cloudflare's `CF-Connecting-IP`. Cloudflare sets that header itself, so it can't be spoofed, but for requests that came through Vercel it's Vercel's address, shared by many visitors.
   - With `API_PROXY_REQUIRED=true`, every request without the right secret gets **403**, except `GET /api/health` and `/api/health/ready`, which Render's health check uses. Nobody can bypass Vercel by calling `onrender.com` directly.
3. **Locally** (Docker Compose, `npm run dev`), there is no secret, so the API uses the socket address and ignores every IP header.

Sign-in, 2FA codes and email verification count **per account and network** (20 per 15 minutes), plus **200 per 15 minutes per network**. Sign-up and password reset send email, so they're strict **per email address**, whatever the network: 3 sign-ups and 3 reset emails per address per hour. They also have a higher cap **per network**: 60 sign-ups an hour, and 30 reset requests an hour, shared with setting the new password. A whole class on one campus IP can sign in and sign up, while one network still can't try many accounts or use up the shared Brevo budget (300 emails a day).

**Check it:** `GET /api/health/client-ip`. On staging (and locally) it returns your own IP as the API sees it, and `viaAppProxy: true` when the request came through our proxy with the right secret. In production it returns **only** `{"viaAppProxy": true}` or `false`, never an address, so you can check that the production secrets match before turning enforcement on.

```sh
curl -s https://nabad-staging.vercel.app/api/health/client-ip \
  -H "X-Forwarded-For: 198.51.100.1, 203.0.113.2" -H "X-Vercel-Forwarded-For: 198.51.100.3" \
  -H "X-Real-IP: 198.51.100.4" -H "X-Nabad-Client-IP: 198.51.100.5"
# Must show your real IP (compare https://www.cloudflare.com/cdn-cgi/trace) and "viaAppProxy": true.
```

### Rolling it out without an outage

Each step works whatever the order of the others. Until the last step, a missing or mismatched secret only means the API falls back to `CF-Connecting-IP`.

1. Generate one value per environment with `openssl rand -hex 32`.
2. Set it in **Vercel** (Preview for staging, Production for production; a server variable, never `NEXT_PUBLIC_`) **and** on **Render** (`nabad-backend-staging`, or `nabad-backend-nhv5`).
3. Deploy the code: merging to `main` deploys staging, and a release deploys production. Vercel only applies an environment variable to deployments made after it was set, so redeploy on Vercel if you set it after the last deploy.
4. Open `https://<site>/api/health/client-ip` in a browser (staging: also try the `curl` above). It must say `"viaAppProxy": true`. If it says `false`, the two values differ, or Vercel hasn't redeployed since the secret was set: fix that first. Also check that sign-in works.
5. Only then set `API_PROXY_REQUIRED=true` on that Render service. From then on, direct requests to `onrender.com` get 403, the check included.

To roll back, first remove `API_PROXY_REQUIRED` (back to the fallback), then the secrets.

## Uptime and the status page

UptimeRobot checks production every 5 minutes, and the public status page is https://stats.uptimerobot.com/GFwdUOKlhv (linked in the site footer). Our target, what an alert means and what to check first are in [uptime.md](./uptime.md).

## Limits we share, and rules that follow from them

- **Never keep staging awake with a monitor.** Render's free plan gives each workspace 750 instance hours a month, shared by all its free services. If they run out, Render suspends every free service in that workspace until the month ends. Production is kept awake by UptimeRobot ([uptime.md](./uptime.md)) and uses about 720–744 hours a month on its own. That's why staging lives in its own workspace, "Nabad Staging". Even there, don't add an UptimeRobot (or any other) monitor for staging: let it sleep when idle. Never move staging back into production's workspace, or put a second free service there.
- **Email: 300 a day, shared.** Staging and production send through the same Brevo account, and the free plan allows 300 emails a day across both. Automated scans on staging (for example the OWASP ZAP task) must exclude or rate-limit the endpoints that send email:
  - `POST /api/auth/signup` and `POST /api/auth/verify-email/resend` (verification email)
  - `POST /api/auth/forgot-password` (reset email)
  - `POST /api/auth/login` (2FA code, lockout alert after wrong codes), `POST /api/auth/2fa/resend` and `POST /api/auth/2fa/setup` (2FA codes)
  - `POST /api/care-circle/invites` (invitation email)

  The data export (a "your data was downloaded" notice) and care circle alerts also send one email each, but a scan rarely reaches them in bulk. Otherwise a scan can use up the day's quota, and production users stop getting their sign-in codes and reset links.
- **AI quota** is separate: staging's Gemini key belongs to its own Google Cloud project.

## Unchanged by this setup

Backups (they only cover `nabad_production`), UptimeRobot (it only watches production) and the production URLs stay exactly as they were.

## Follow-ups

- **Move production to Frankfurt.** `nabad-backend-nhv5` runs in Oregon while its Atlas cluster is in Frankfurt, so every database query crosses the Atlas. Staging already runs in Frankfurt. Render can't change a service's region, so this means a new production service; plan it as its own task.

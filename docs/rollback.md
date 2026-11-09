# Rolling back a bad release

When a release breaks production, we first put the last good version back live in Render and Vercel. That takes a couple of minutes. Then we make git match through a revert pull request, and we make sure the next release doesn't bring the bug back.

Releases themselves are described in [environments.md](./environments.md#releasing-to-production), and every release, with its rollback target, is listed in [releases.md](./releases.md).

## Roll back or fix forward?

**Rule of thumb: if production is broken or unsafe and we can't have a fix live within about 15 minutes, roll back.**

Roll back when, for example:

- `/api/health/ready` fails, the site doesn't load, or people can't sign in.
- Users see someone else's data, health data shows up in logs or Sentry, or a safety feature (triage, emergency routing, care circle alerts) gives wrong results.
- Errors in Sentry jump right after the release and we don't know why yet.

Fix forward (a normal pull request to `main`, then a release) when the problem is small and cosmetic, such as a typo or a layout glitch, or when the fix is already known, tested on staging and can be live within 15 minutes.

If in doubt, roll back. It's fast, and the release can go out again once it's fixed.

## Who does it

Gerges does rollbacks and releases. Once the operations guide gives a second person supervised access to Render and Vercel, that person can roll back too, with Gerges on a call. Coding agents never roll back, and never open or merge pull requests into `production`.

Anyone who sees production broken posts in the team chat and tags Gerges.

## Fast rollback

Look up the release in [releases.md](./releases.md) first: the **rollback target** column says which commit to go back to. Roll back only what the release changed: Render if it touched `backend/` or `render.yaml`, Vercel if it touched `frontend/`. If it changed both, roll back both, Render first (the API), then Vercel.

### Render (API): `nabad-backend-nhv5`

1. Open https://dashboard.render.com, the production workspace, and the service **nabad-backend-nhv5**.
2. Open **Events** (Render's docs call this list **Deploys**).
3. Find the deploy whose commit is the rollback target, marked "Deploy live". Choose by commit, not by position: environment variable changes and manual deploys also appear in the list, so "the one below the latest" isn't always the previous release.
4. Click **Rollback** on that deploy, then **Rollback to this deploy** on the confirmation page.
5. Wait for "Deploy live" (usually a minute or two; Render reuses the old build, it doesn't build again).

What Render does when we roll back from the dashboard:

- It runs the old build with that deploy's start command, health check path, instance count and **environment variables**. It does not change the plan, custom domains or disks.
- It **turns Auto-Deploy off** for the service. While it's off, merges to `production` don't deploy the API. We turn it back on once the permanent fix is in (see [Back to normal](#back-to-normal)).
- On our free (Hobby) workspace Render keeps the last **5 builds**, so we can only roll back to one of those. Releasing several times in a row, or redeploying for environment variable changes, pushes older releases out of reach.

### Vercel (web app): https://nabad-psi.vercel.app

1. Open https://vercel.com, team **nabad3**, project **nabad**.
2. On the project's overview, the **Production Deployment** tile has an **Instant Rollback** button. Click it.
3. The dialog shows the current production deployment and the one we can go back to. On our Hobby plan that is **only the deployment that was in production immediately before the current one**. Check its commit is the rollback target before you continue. If it isn't (for example production was redeployed since the release), stop and fix forward or use the revert pull request below: Hobby can't roll back further.
4. Click **Continue**, check the domains listed include `nabad-psi.vercel.app`, then click **Confirm Rollback**. It switches over immediately: Vercel reuses the old build.

What Vercel does:

- It serves the old build exactly as it was built, including the build-time variables baked into it (`BACKEND_URL`, `NEXT_PUBLIC_*`). Environment variables changed in the project settings since then have no effect on it.
- **It turns off automatic assignment of the production domain.** Until we undo that, new merges to `production` still build, but they **don't go live**: `nabad-psi.vercel.app` keeps pointing at the rolled-back deployment. Every later release would silently not reach users. See [Back to normal](#back-to-normal).

### Check it worked

1. https://nabad-psi.vercel.app/api/health/ready returns `{"status":"ready"}` (this goes through Vercel to the API, so it checks both). The API directly: https://nabad-backend-nhv5.onrender.com/api/health/ready.
2. Sign in with your own account on https://nabad-psi.vercel.app, including the 2FA code.
3. Open a key page that uses the API, such as **Medications** or **My health**, and check it loads data.
4. Open whatever the release broke and check it's gone back to how it was.
5. Check Sentry for new errors in the `production` environment over the next few minutes.

### Tell the team

Post in the team chat when you start and when you're done, for example:

> 🔴 Rolling back production: release #212 broke sign-in (Sentry 500s on /api/auth/login). Rolling back Render and Vercel to f9d0d39. Please don't merge to `production`.

> 🟢 Production rolled back to f9d0d39 at 21:40. Health check, sign-in and Medications OK. Auto-deploys are off on Render and Vercel until the fix is released. Revert PR: #213.

## Permanent fix

The rollback only changes what Render and Vercel serve. Git still says the bad release is on `production`, and auto-deploys are off. Fix that the same day.

### 1. Revert the release on `production` (Gerges)

```sh
git fetch origin
git switch -c revert/release-212 origin/production
git revert -m 1 <release merge commit>   # the "production commit" in releases.md
git push -u origin revert/release-212
gh pr create --base production --title "Revert release #212" --body "Rolls back <what>. See the incident in the team chat."
```

Merge it with a **merge commit**. With auto-deploys off, this deploys nothing yet; it only makes git match what's live.

### 2. Bring the revert into `main`

Otherwise the next release brings the bug straight back. Do it by **merging `production` into `main`**, so `main` gets the very same revert commit:

```sh
git switch -c sync/production-into-main origin/main
git merge origin/production
git push -u origin sync/production-into-main
gh pr create --base main --title "Bring the revert of release #212 into main"
```

Then the usual flow: all 7 required checks, merge commit. Staging now matches production again.

Why not just run `git revert` again on `main`? Then `main` and `production` hold two different revert commits. If we later bring the feature back fixed on `main`, the next release merges "production removed it" with "main kept it and changed it", and the feature either conflicts or quietly stays missing from production. Merging `production` into `main` gives both branches the same history, so that can't happen.

### 3. Fix it on `main`

Bring the change back with the fix in a normal pull request to `main`: revert the revert (`git revert <revert commit>`) plus the fix. Test it on staging, then release as usual and add it to [releases.md](./releases.md).

## Back to normal

Once git matches what's live (or the fixed release is merged to `production`), turn automatic deploys back on. **Do this before the next release**, or the release won't reach users.

**Vercel:**

1. On the project overview, the Production Deployment tile shows a **Manage** button (older screenshots call it **Undo Rollback**) while the project is rolled back. Click it.
2. Pick the newest deployment from `production` (the revert, or the fixed release) and click **Confirm**.
3. That promotes it and turns automatic production domain assignment back on. From now on, merges to `production` go live by themselves again.

**Render:**

1. `nabad-backend-nhv5` → **Settings** → **Build & Deploy** → **Auto-Deploy**: set it back to **On Commit**.
2. Click **Manual Deploy** → **Deploy latest commit**, so the service runs the newest `production` commit (the revert or the fixed release), not the rolled-back deploy. Check **Events** shows that commit as "Deploy live".

Then run [Check it worked](#check-it-worked) again.

## What a rollback does NOT undo

- **Environment variables.** Vercel never changes them: if a release came with a Vercel variable change, set it back by hand, then redeploy (build-time variables only change on a new build). Render runs the rolled-back deploy with the variables that deploy had, but check **Environment** afterwards: what it shows is what the next deploy uses. Watch out for secrets rotated since the rollback target (for example after a leak): the rolled-back Render deploy may run with the old value, so rotate it again.
- **`render.yaml` changes** applied with Blueprint **Manual sync**. A Render rollback restores the start command, health check and variables of the old deploy, but not the plan, and the Blueprint still holds the new `render.yaml`. The Blueprint reads `render.yaml` from `main`, so don't **Manual sync** again until step 2 above has brought the revert into `main`.
- **Data in the database.** Code goes back; documents written by the new release stay in `nabad_production`, and so do migrations or index changes it made. Restoring from a backup ([backups.md](./backups.md)) is a **last resort**, only for corrupted or lost data: it throws away everything written since the backup, and it needs Gerges and the private key.

That's why every release must keep working with older code, and the other way round:

- **New code must work with old data**, and **old code must not break on data the new code wrote.** Add fields as optional, with defaults; don't rename or remove a field in the same release that stops writing it; don't tighten a schema validation so far that old documents fail it.
- Removing or renaming something takes two releases: first stop using it (and ship), then remove it in a later release, once we'd never roll back past the first one.
- Mention anything data-related in the release pull request, so whoever rolls back knows what stays behind.

## Rollback drill

We practise a rollback so the first real one isn't the first time. The drill:

1. **Render, on staging:** in the "Nabad Staging" workspace, roll `nabad-backend-staging` back to its previous deploy, check its health URL, then roll forward again (Auto-Deploy back to **On Commit**, **Manual Deploy** → **Deploy latest commit**).
2. **Vercel, on production:** **Instant Rollback** to the previous production deployment, check it, then **Manage** → promote the newest `production` deployment, so automatic deploys are back on.

We time each part: **time to roll back** is from clicking the button until the health check and sign-in work on the old version; **time to roll forward** is the same back to the current release.

| Date | What was rolled back | Time to roll back | Time to roll forward | Issues |
|---|---|---|---|---|
| | | | | |

# Release log

Every release to production, newest first. The release adds a row here (Gerges, or his agent when he asks it for the release) (step 7 of [Releasing to production](./environments.md#releasing-to-production)).

- **Release PR:** the pull request from `main` to `production`.
- **Production commit:** the merge commit that pull request created on `production`. This is what `git revert -m 1` takes in a [permanent fix](./rollback.md#permanent-fix).
- **Rollback target:** the `production` commit that was live before this release, so the deploy to pick in Render and the deployment Vercel offers in **Instant Rollback** ([rollback.md](./rollback.md)).

| Date | Release PR | Production commit | What changed | Rollback target |
|---|---|---|---|---|
| 2026-11-11 | [#210](https://github.com/Nabad-team/Nabad/pull/210) | `2e24edb` | Rate limits use the real client IP behind Vercel and Cloudflare (`frontend/proxy.js` + `API_PROXY_SECRET`; `TRUST_PROXY` removed), per account and network for sign-in, sign-up and reset (#208, #209); OWASP ZAP scanning in CI and site-origin `Access-Control-Allow-Origin` on pages (#206); temporary staging IP diagnostic added and removed (#207); docs (#204, #205). `render.yaml` changed: Blueprint manual sync needed. `API_PROXY_REQUIRED` not set at release | `4aaa01b` |
| 2026-11-10 | [#203](https://github.com/Nabad-team/Nabad/pull/203) | `4aaa01b` | Status page link in the footer and on the Contact page, 99% uptime target docs (#201); calendar contrast token and CI fixes (#202); rollback process, release log and Blueprint manual sync docs (#198, #199, #200). Frontend only: no `backend/` changes, so Render did not redeploy; `render.yaml` changed in comments only, no Blueprint sync needed | `7aeaccf` |
| 2026-11-09 | [#197](https://github.com/Nabad-team/Nabad/pull/197) | `7aeaccf` | Staging support: a separate staging environment, `APP_ENV` checks that keep staging and production databases and secrets apart, staging banner and `noindex` (SCRUM-187) | `f9d0d39` |

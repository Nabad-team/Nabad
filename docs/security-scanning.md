# Security scanning (OWASP ZAP)

We scan Nabad with [OWASP ZAP](https://www.zaproxy.org/), an open-source web security scanner, in two ways:

| | PR scan | Weekly staging scan |
|---|---|---|
| Workflow, job | [zap-pr.yml](../.github/workflows/zap-pr.yml), `zap-pr-scan` | [zap-staging.yml](../.github/workflows/zap-staging.yml), `zap-staging-scan` |
| When | every pull request to `main`, or by hand (**Actions → Run workflow**) | Mondays 03:17 UTC, or by hand |
| Target | a throwaway copy of the whole app, started with Docker Compose like the Selenium job | https://nabad-staging.vercel.app |
| What runs | spider, passive scan and **active scan**, first signed out, then signed in as a fresh test user | spider and **passive scan only**, about 2 requests a second |
| Takes | about 20 minutes | about 5 minutes |
| Never | staging, production, Brevo or Gemini | production; anything in the [exclusion list](#staging-exclusions) |

Everything lives in [security/zap](../security/zap):

- [zap_scan.py](../security/zap/zap_scan.py): the scan driver. It sets ZAP up through its API, runs the scan and prints the summary. It uses only Python's standard library.
- [compose.zap.yml](../security/zap/compose.zap.yml): adds ZAP to `docker-compose.yml`, plus the scan-only backend settings.
- [rules.tsv](../security/zap/rules.tsv): every finding we ignore or downgrade, each with a written reason.
- [staging-exclude.txt](../security/zap/staging-exclude.txt): paths the staging scan never requests.
- [test_zap_scan.py](../security/zap/test_zap_scan.py): unit tests for the driver. Both jobs run them first.

ZAP runs from `ghcr.io/zaproxy/zaproxy:2.17.0`, pinned by digest to the stable build of 2026-10-26. Upstream moves the `2.17.0` tag to every rebuild, so the digest is what pins it. Update it like any other image ([docker.md](./docker.md#updating-an-image)): pick a dated `-stable` build at least two weeks old, then take its digest.

## The PR scan

1. Docker Compose builds and starts the app, with ZAP joined to its private network. ZAP scans `http://frontend:3000`. Email goes to Mailpit and no AI provider is configured, so nothing leaves the runner.
2. A test user (`zap-<random>@example.test`) signs up through the API and is verified through Mailpit. It signs in with a password only, so ZAP can reuse one session cookie: the scan's Compose file sets `TWO_FACTOR_ON_SIGNUP=false` for this run.
3. **Signed out:** ZAP opens every page in `frontend/pages` and the main API reads, sends sample sign-in, verify and reset requests, spiders the app, and runs the passive and active scan.
4. **Signed in:** the same again with the test user's session cookie, plus sample writes (medications, appointments, vitals, symptoms, search and so on), so the active scan has JSON fields to test. The signed-in active scan skips anything that would end its own session or delete the test user: log out, 2FA changes, password reset and deleting the account. At the end the log says whether the session was still valid.
5. ZAP sends `Origin: http://localhost:3000` with every request, as a browser on the app would. Otherwise the API's origin check would refuse every write.

**Scan-only settings** (only in [compose.zap.yml](../security/zap/compose.zap.yml)):

- `TWO_FACTOR_ON_SIGNUP=false`: see step 2.
- `PWNED_PASSWORDS_CHECK=off`: so thousands of scan requests don't each call Have I Been Pwned.
- `SECURITY_SCAN_RELAXED_RATE_LIMITS=true`: multiplies every API rate limit by 1000. Without it, about a fifth of the active scan's requests got `429 Too Many Requests` and never tested anything. Every limiter is created through [backend/src/rateLimit.js](../backend/src/rateLimit.js). The API refuses to start with this setting when `APP_ENV` or `NODE_ENV` is `staging` or `production`, and backend tests check that.

## The weekly staging scan

A passive baseline: ZAP follows links with GET only, never submits forms, and runs no attacks. It is rate-limited to about 2 requests a second with one thread, because staging runs on free plans (Render sleeps, the Atlas cluster is small). It only ever targets `https://nabad-staging.vercel.app`, and `zap_scan.py` refuses any other address.

### Staging exclusions

Staging shares production's Brevo account and its 300 emails a day, and has its own small Gemini quota ([environments.md](./environments.md#limits-we-share-and-rules-that-follow-from-them)). The spider also finds API paths inside the JavaScript bundles, so the scan never requests anything that could send email or call the AI, even with a GET. ZAP excludes these paths from its context, its spider and its proxy ([staging-exclude.txt](../security/zap/staging-exclude.txt)):

| Paths | Why |
|---|---|
| `/api/auth/signup`, `/api/auth/verify-email…` | verification emails |
| `/api/auth/forgot-password`, `/api/auth/reset-password` | password reset emails |
| `/api/auth/login`, `/api/auth/2fa/…` | 2FA codes and lockout alerts |
| `/api/care-circle…` | care circle invitations |
| `/api/account/…` | the "your data was downloaded" email |
| `/api/symptoms…` | a symptom check can send a care circle alert |
| `/api/triage/…` | symptom triage, including the AI assessment |
| `/api/reports/…` | health assistant chat, report analysis and prescription photo reading (AI) |
| `/api/auth/google…` | redirects to Google |

A unit test checks every endpoint above against the list, and checks that public pages are still scanned. If you add an endpoint that sends email or calls the AI, add it to the list in the same pull request.

## Reading the results

The job log and the job summary on GitHub show only a table: **rule ID, name, risk, count, result**. The repository is public, so the scan never prints URLs, parameters or evidence, and uploads no reports.

| Result | Meaning |
|---|---|
| `FAIL` | High or Medium risk. The job fails. |
| `warn` | Low or Informational. Shown, doesn't fail. |
| `warn (rules.tsv)` | Medium or High, downgraded in `rules.tsv` with a reason. Doesn't fail. |
| `ignored (rules.tsv)` | Listed in `rules.tsv` as a false positive, with a reason. Doesn't fail. |

The rule ID is ZAP's, for example `10055-5` for one alert or `10055` for all alerts of that scan rule. Look it up at https://www.zaproxy.org/docs/alerts/ (for example https://www.zaproxy.org/docs/alerts/10055-5/).

**When the scan fails:** run it locally (below) to see where the finding is, then either fix it, or add one line to [rules.tsv](../security/zap/rules.tsv) in the same pull request: the rule ID, `WARN` or `IGNORE`, the scope (`pr`, `staging` or `all`), and a reason that someone else can check. An accepted risk names its follow-up story. Nothing is ignored silently: a line without a reason fails the scan.

Exit codes: 0 means no failing findings; 1 means High or Medium findings; 2 means the scan could not run (for example the app didn't start or sign-up failed). An exit code of 2 is a problem with the scan setup, not a finding.

## Run it locally (full report)

You need Docker Desktop and Python 3.11 or newer.

```sh
export ZAP_API_KEY=$(python -c "import secrets; print(secrets.token_hex(16))")
docker compose -f docker-compose.yml -f security/zap/compose.zap.yml --profile zap up -d --build
python security/zap/zap_scan.py pr --report my-scan          # about 15 minutes
docker compose -f docker-compose.yml -f security/zap/compose.zap.yml --profile zap down -v
```

In PowerShell, set the key with `$env:ZAP_API_KEY = python -c "import secrets; print(secrets.token_hex(16))"`.

`--report my-scan` writes `security/zap/reports/my-scan.html` and `.json`, with every URL, parameter and piece of evidence. The folder is git-ignored, and the script refuses `--report` in CI. Don't commit these reports or post them anywhere public.

For the staging scan, start only ZAP and run `python security/zap/zap_scan.py staging --report staging-scan`. Use the same Compose command, ending with `up -d zap` instead of `up -d --build`. If you run ZAP on a different port, map the same port on both sides (`-p 127.0.0.1:8092:8092` with `-port 8092`): ZAP only answers API calls addressed to its own port.

Run the driver's unit tests with `python -m unittest discover -s security/zap -p "test_*.py"`.

## Making it a required check

The ZAP job is **not** a required check yet. Make `zap-pr-scan` required once it has run green on pull requests for about two weeks, with no false failures and no scan-setup errors (exit code 2). Gerges adds it to branch protection, and [testing.md](./testing.md#branch-rules-and-merging) and both AGENTS.md and CLAUDE.md then list 8 required checks. Never rename the job afterwards. The weekly staging scan stays informational: it checks the live staging setup, not the pull request.

## Known limits

- **Accepted for now:** the CSP allows inline scripts (`10055-5`) and inline styles (`10055-6`), both `WARN` in `rules.tsv`. The follow-up story removes `'unsafe-inline'` from `script-src`.
- `40014-2` (Low, a warning): text a user saves, such as an appointment title, comes back unchanged in the API's JSON. That is expected. The frontend renders it through React, which escapes it, and never as raw HTML (there is no `dangerouslySetInnerHTML`), and the API answers with `application/json` and `nosniff`.
- The active scan takes the parameters it can see. Endpoints that only accept a precise JSON shape get fewer meaningful attacks than form-style inputs.
- File uploads (medical documents, report analysis) are seeded only as plain requests, and the AI endpoints answer 503 locally because no AI provider is configured.
- The staging scan sees only public pages. It doesn't sign in, so the scan doesn't need a staging account or password.

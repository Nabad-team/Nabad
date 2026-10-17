# Backend load test

## JMeter website capacity ramp

Use [`loadtest/nabad.jmx`](./loadtest/nabad.jmx) with Apache JMeter 5.6.3 or newer to exercise the local website (`/`), anonymous session API, and API health endpoint. The wrapper increases concurrent visitors in stages and stops when the health check fails, sample errors reach 5%, or p95 response time reaches 2 seconds. It writes each stage's CSV and a summary under `loadtest/jmeter-results/` (ignored by Git).

1. Start the app locally and confirm `http://localhost:3000` and `http://localhost:3000/api/health` work. The frontend's `/api` rewrite must point at the running backend.
2. Install Apache JMeter, then run from the repository root:

   ```powershell
   node loadtest/jmeter-ladder.js
   ```

   The default stages are 10, 25, 50, 100, 200, and 500 visitors, with a 30-second ramp and 60-second hold per stage. JMeter must be on `PATH`; otherwise set `$env:JMETER` to its executable path. JMeter can also open `loadtest/nabad.jmx` in its GUI for a smaller manual run.

Options: `$env:LEVELS='10,25,50'`, `$env:RAMP_SECONDS='15'`, `$env:HOLD_SECONDS='30'`, `$env:ERROR_STOP_PCT='5'`, `$env:P95_STOP_MS='2000'`, and `$env:HOST`/`$env:PORT`/`$env:PROTOCOL` (defaults: `localhost`/`3000`/`http`). Non-local targets are refused unless `$env:ALLOW_EXTERNAL_TARGET='true'` is explicitly set. Only load test systems you own or have permission to test. A load test identifies a performance limit; it cannot guarantee a universal audience count because hardware and deployment capacity affect the result.

k6 scripts in [`loadtest/`](./loadtest) simulate three kinds of traffic against a local backend, stepping from 10 to 500 simultaneous virtual users (each waits 1 s between actions, like a person).

| Script | What a user does |
|---|---|
| `public-pages.js` | Opens a public page: `GET /api/auth/session` (401 when signed out, called by every page) and `GET /api/health` |
| `signup-login.js` | Signs up a new account, then logs in with it |
| `me.js` | Is signed in; the page calls `GET /api/auth/me` |

## How to run

```bash
winget install GrafanaLabs.k6                 # once
node loadtest/start-backend.js                # terminal 1: backend on http://localhost:5100
node loadtest/run-all.js                      # terminal 2: about 12 minutes, prints the table below
```

Options: `LEVELS=10,50`, `DURATION=30s`, `SCENARIOS=me`, `K6="C:\Program Files\k6\k6.exe"` if k6 is not on PATH yet. Raw k6 summaries go to `loadtest/results/` (not committed).

**Isolation.** `start-backend.js` starts its own throwaway MongoDB (mongodb-memory-server) with database `nabad_loadtest` and deletes it on exit. Every setting is passed explicitly, so nothing from `backend/.env` (real `MONGO_URI`, SMTP, Google) is used.

**Rate limits.** The backend allows e.g. 5 signups per hour per IP, and all k6 users come from 127.0.0.1, so the test would only measure `429 Too many attempts`. `start-backend.js` swaps `express-rate-limit` in Node's module cache for a wrapper that keeps every limiter but raises its limit to 10⁹, before the backend code loads. Only that one process is affected: `backend/src` is unchanged, and `npm start` or Render always use the real limits.

**Outside services.** `start-backend.js` also turns off the Have I Been Pwned check (`PWNED_PASSWORDS_CHECK=off`): a load test must not send thousands of requests to a public service, and the network time would hide the server's own work.

## Results

Laptop, 12 cores, Node 24, one backend process, MongoDB local, k6 on the same machine. Each level: 5 s ramp-up + 30 s hold. "Successful/s" counts only correct answers (401 counts as correct for a signed-out visitor).

### Password hashing: Argon2id vs bcryptjs (2026-10-12)

Both runs on the same laptop on the same day, with the same k6 scripts: the old code (`main` before the change, bcryptjs) and the new code (Argon2id with `@node-rs/argon2`, old hashes checked with `@node-rs/bcrypt`). Logins and signups per second are counted separately from the k6 summaries.

| Users | bcryptjs logins/s | Argon2id logins/s | bcryptjs login p95 | Argon2id login p95 | bcryptjs signups/s | Argon2id signups/s |
|---:|---:|---:|---|---|---:|---:|
| 10 | 1.0 | 6.1 | 5.4 s | 505 ms | 1.0 | 6.1 |
| 50 | 1.1 | 12.0 | 22.6 s | 2.4 s | 1.1 | 12.0 |
| 100 | 0.2 | 12.9 | 21.6 s | 5.2 s | 0.2 | 12.9 |
| 250 | 0.0 | 12.2 | 30.0 s | 15.5 s | 0.0 | 12.2 |
| 500 | 0.0 | 3.9 | timeout | 30.0 s | 0.0 | 11.4 |

At 10 users each user waits 1 s between rounds, so 6 logins/s is all they ask for: nothing queues. From 50 users on, the backend is at its ceiling of about **12 logins and 12 signups per second, roughly 11× the bcryptjs code**, which managed about 1 of each per second on this day. (The earlier run below reached about 2 of each per second; this laptop was slower on 2026-10-12, which is why both were measured again side by side.)

The new k6 table for this scenario:

| Scenario | Users | Requests/s | Successful/s | p95 response time | Error rate |
|---|---:|---:|---:|---|---:|
| signup-login | 10 | 12 | 12 | signup 116 ms, login 505 ms | 0.0% |
| signup-login | 50 | 24 | 24 | signup 1.2 s, login 2.4 s | 0.0% |
| signup-login | 100 | 26 | 26 | signup 2.8 s, login 5.2 s | 0.0% |
| signup-login | 250 | 24 | 24 | signup 9.8 s, login 15.5 s | 0.0% |
| signup-login | 500 | 23 | 15 | signup 21.5 s, login 30.0 s | 32.8% |

**The scripts were broken before this run.** Their password, "Load test password 123!", contains the account's name ("Load Test"), which the password policy added since the earlier run refuses. Every signup was answered `400` in 3 ms and nothing was hashed. The scripts now use a password that passes the policy.

### Earlier run (all scenarios, bcryptjs)

`public-pages` and `me` don't hash passwords, so the Argon2id change doesn't affect them; they were not run again.

| Scenario | Users | Requests/s | Successful/s | p95 response time | Error rate |
|---|---:|---:|---:|---|---:|
| public-pages | 10 | 18 | 18 | session 2 ms, health 2 ms | 0.0% |
| public-pages | 50 | 91 | 91 | session 2 ms, health 2 ms | 0.0% |
| public-pages | 100 | 183 | 183 | session 3 ms, health 2 ms | 0.0% |
| public-pages | 250 | 457 | 457 | session 3 ms, health 3 ms | 0.0% |
| public-pages | 500 | 915 | 915 | session 4 ms, health 3 ms | 0.0% |
| signup-login | 10 | 4 | 4 | signup 2.4 s, login 2.0 s | 0.0% |
| signup-login | 50 | 4 | 4 | signup 18.2 s, login 15.7 s | 0.0% |
| signup-login | 100 | 5 | 4 | signup 30.0 s, login 23.4 s | 23.8% |
| signup-login | 250 | 8 | 0 | signup 30.0 s, login 30.0 s | 97.6% |
| signup-login | 500 | 177 | 0 | signup 30.0 s, login 0 ms | 99.9% |
| me | 10 | 8 | 8 | me 9 ms | 0.0% |
| me | 50 | 38 | 38 | me 19 ms | 0.0% |
| me | 100 | 75 | 75 | me 21 ms | 0.0% |
| me | 250 | 192 | 192 | me 28 ms | 0.0% |
| me | 500 | 381 | 381 | me 47 ms | 0.0% |

30.0 s is k6's timeout: those requests never got an answer. At 500 users the high request count is misleading: almost all are connection attempts refused instantly and retried.

Mixed run (100 users on `/me` while 20 users sign up at the same time): `/me` p95 stayed at 16 ms (18 ms without signups); signups took about 5–6 s each.

## Where it breaks, and why

**Browsing and signed-in pages are fine up to 500 users.** `/session` and `/me` check a signature, and `/me` makes one small database lookup. That takes milliseconds, and response times barely moved from 10 to 500 users.

**Signup and login are limited by password hashing**, which is *designed* to be slow so stolen hashes are hard to crack.

- **Before (bcryptjs):** one bcrypt (cost 12) took about 225 ms of CPU, in pure JavaScript on Node's single main thread. All hashing happened on **one core**, so the backend topped out at about 4 bcrypt operations per second, and every other request waited behind them.
- **Now (Argon2id):** new passwords use Argon2id (19 MiB, 2 iterations), about **15 ms** per hash or check, in native code on a background thread pool, off the main thread.
- **What a login costs now:** an Argon2id check plus a **bcrypt-cost dummy check** (about 170 ms, also native and off the main thread). The dummy is there so the time a sign-in takes never shows whether an account still has an old bcrypt hash (one that hasn't signed in since the change). It is now most of the cost of a login. A signup is a single Argon2id hash.
- **Where the ceiling comes from:** the thread pool has 4 threads by default (`UV_THREADPOOL_SIZE`), so the ~12 logins + ~12 signups per second here are roughly 4 threads kept busy, not 12 cores.

What users see past the ceiling is the same as before, just about 11× later. Requests queue, and from about 250 users many wait longer than 30 s. At 500 users some logins time out while their signup is still queued.

**Production will be much weaker than this laptop.** Render's free plan gives about 0.1 CPU. A login's ~185 ms of CPU is then roughly 2 s there (an estimate, not measured), and a signup about 150 ms. Atlas also adds network latency to every database call, which a local database does not have.

## Top 3 improvements

1. **Retire the old bcrypt hashes.** Once most active accounts have signed in (and so moved to Argon2id), ask the rest to reset their password by email, then remove bcrypt checking and the timing dummy. A login then costs about 15 ms instead of about 185 ms, which is roughly 10× more logins again.
2. **Fail fast instead of queueing forever.** Limit how many password hashes run or wait at once (for example, a small multiple of the thread pool size). Answer extra signups and logins right away with `503 Try again in a moment` instead of letting them wait 30 s and then be thrown away. That keeps the server responsive and stops CPU being wasted on abandoned requests. The existing per-IP rate limits stay as the first line of defence.
3. **Give the backend real CPU.** The free Render instance (0.1 CPU, and it sleeps when idle) is the biggest limit in production. A paid instance with at least 0.5–1 CPU raises the ceiling 5–10×, and with more cores `UV_THREADPOOL_SIZE` can be raised to match. If the backend is ever scaled to more than one instance, move the rate-limit counters into a shared store (MongoDB or Redis), because today each process counts separately.

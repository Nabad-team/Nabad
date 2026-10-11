# Backend load test

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

## Results

Laptop, 12 cores, Node 24, one backend process, MongoDB local, k6 on the same machine. Each level: 5 s ramp-up + 30 s hold. "Successful/s" counts only correct answers (401 counts as correct for a signed-out visitor).

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

**Signup and login break almost immediately, at about 10 users.** Both run bcrypt, which is *designed* to be slow so stolen password hashes are hard to crack. Here one bcrypt operation (cost 12) takes about **225 ms of CPU**. The backend uses the pure-JavaScript `bcryptjs`, which runs on Node's single main thread, so all hashing happens on **one CPU core** no matter how many cores the machine has. The backend process sat at 98–100 % of one core during these runs. That caps it at roughly 4 bcrypt operations per second, which is about **2 complete signup + login per second** in total.

What users see as load grows:
- **10 users:** requests queue behind each other; each signup takes about 2 s.
- **50 users:** the queue is 18 s long, but everything still succeeds.
- **100 users:** waits pass 30 s and requests start failing.
- **250 users:** almost nothing succeeds.
- **500 users:** the server is so busy it can't even accept new connections, so the operating system refuses them ("connection actively refused"). A signup that the browser has given up on is still hashed to the end, so the server keeps burning CPU on work nobody will receive.

bcryptjs does pause between chunks of work, so light requests (`/me`, `/health`) still get through at moderate signup load (see the mixed run). Only under a very long queue did `/health` slow to 3.5 s.

**Production will be much weaker than this laptop.** Render's free plan gives about 0.1 CPU, so one bcrypt is roughly 2 s there (an estimate, not measured). A handful of people signing up at the same moment would already wait many seconds. Atlas also adds network latency to every database call, which a local database does not have.

## Top 3 improvements

1. **Make password hashing cheaper and use more cores.** Replace `bcryptjs` with the native `bcrypt` package. It writes the same hash format, so existing passwords keep working, runs about 2–3× faster, and hashes on a background thread pool instead of the main thread. Separately, the team can decide whether cost 11 or 10 is enough (each step down halves the CPU; OWASP's minimum is 10). This raises the ~2 signups/s ceiling the most.
2. **Fail fast instead of queueing forever.** Limit how many password hashes run at once (for example, twice the CPU count). Answer extra signups and logins right away with `503 Try again in a moment` instead of letting them wait 30 s and then be thrown away. That keeps the server accepting connections and stops CPU being wasted on abandoned requests. The existing per-IP rate limits stay as the first line of defence.
3. **Give the backend real CPU.** The free Render instance (0.1 CPU, and it sleeps when idle) is the biggest limit in production. A paid instance with at least 0.5–1 CPU raises the ceiling 5–10×. If the backend is ever scaled to more than one instance, move the rate-limit counters into a shared store (MongoDB or Redis), because today each process counts separately.

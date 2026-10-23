# Testing Nabad

Nabad has three layers of automated tests. All three run on every pull request to `main` ([.github/workflows](../.github/workflows)).

| Layer | Where | Runs with | What it checks |
| --- | --- | --- | --- |
| Backend | [backend/tests](../backend/tests) | Node's built-in test runner (`node --test`), against a temporary in-memory MongoDB | The API: sign-up and sign-in, 2FA, sessions, profiles, medications, health data, triage rules, rate limits, error messages, and what error reports send to Sentry (to a fake Sentry server) |
| Frontend | [frontend/\_\_tests\_\_](../frontend/__tests__) | Jest and React Testing Library, in jsdom | Pages and components on their own, with the API mocked |
| End-to-end | [tests/test_nabad.py](../tests/test_nabad.py) | Python `unittest` and Selenium, in Chrome | The whole app as a user sees it: the real frontend, API, database and email, started with Docker Compose |

## Backend and frontend

```bash
cd backend && npm ci && npm test
cd frontend && npm ci && npm test
```

The backend tests download a MongoDB binary the first time (mongodb-memory-server). Nothing else needs to be running. `npm test` runs at most 4 test files at a time (`--test-concurrency=4`). Each file starts its own MongoDB, and starting one per CPU core at once makes them time out on Windows. Four is still as fast as Node's default on GitHub's 4-core runners.

## End-to-end (Selenium)

The suite was written by Leen El Baba. It drives a real Chrome against a throwaway copy of the app from [docker-compose.yml](../docker-compose.yml), never production.

### Run it locally

You need Docker Desktop (running), Python 3.11 or newer and Google Chrome. Selenium downloads the matching ChromeDriver itself.

```bash
docker compose up -d --build
pip install -r tests/requirements.txt
python tests/test_nabad.py
```

Wait until http://localhost:3000 opens before starting the tests (the first build takes a few minutes). To watch the browser, set `NABAD_HEADLESS=0`. When you're done, `docker compose down -v` removes the containers and the local database.

| Setting | Default | |
| --- | --- | --- |
| `NABAD_BASE_URL` | `http://localhost:3000` | The app under test (the Docker Compose frontend) |
| `NABAD_MAILPIT_API` | `http://localhost:8025/api` | Mailpit's API, where the tests read the verification link and 2FA code |
| `NABAD_HEADLESS` | `1` | `0` shows the browser window |
| `NABAD_WAIT_SECONDS` | `20` | How long each explicit wait lasts before a test fails |
| `NABAD_ARTIFACTS_DIR` | `tests/artifacts` | Where failure screenshots and page URLs are saved (git-ignored) |

### How a run works

1. **Setup.** A new account (`selenium-<time>-<random>@example.test`) is signed up through the sign-up page. The suite opens the verification link from the email in Mailpit, signs out through the account menu, and signs in again with the 6-digit code from the second email, ticking "Remember this device". If any of this fails, the whole run fails: nothing is skipped.
2. **One sign-in for the whole run.** Each account can be sent at most 5 sign-in codes an hour, so the suite signs in with a code only once. The other tests reuse the session cookie, and if it has ended, sign in again with the password on the remembered device (no new code).
3. **Tests**, in this order: the public pages signed out, then the signed-in workflows.
4. **Teardown.** The last test deletes the account through the "Delete my account" dialog on the profile page, then checks that it can no longer sign in.

Every failure saves a screenshot and the page URL to `NABAD_ARTIFACTS_DIR`. The tests use explicit waits only (no fixed sleeps) and find elements by id, label, ARIA role or accessible name rather than by CSS class.

### What it covers

- **Public pages:** page titles, the 404 page, wrong password, the sign-up password check, forgot password, the inactivity sign-out message, and that signed-in pages (including `/symptoms`) redirect to the login page with a `next` link back to the page.
- **Account:** sign-up, email verification, sign-out, sign-in with an emailed 2FA code and a remembered device, and account deletion.
- **Dashboard:** the greeting and the links to symptoms, My health, Medications, Water and sleep, and My profile (in the account menu).
- **Symptoms and safety check:** symptoms are saved on the unified `/symptoms` page (the old `/triage` page was retired), and the urgency result shows how soon and what to do, with a "Read aloud" control.
- **Medications:** add, edit the dose, mark as discontinued, and delete (and it stays gone after a reload).
- **Family members:** add a linked profile (a child), switch to it in the header, add a medication for them, switch back, and check it is not in the user's own list.
- **My health and water:** a height is saved and still there after a reload; a glass of water is added and a daily goal is set.
- **Profile and security pages** open for the signed-in user.
- **Notifications:** an appointment due in 5 minutes with a 15-minute reminder is saved; within about a minute the API's reminder job notifies it, the header bell shows it as unread, `/notifications` lists it (without the appointment's title), the bell's panel marks everything read, and the profile page shows emergency and urgent caregiver alerts as always on.
- **Care circle:** user A invites user B by email; B opens the link from the email in Mailpit, signs in and accepts; A runs an emergency symptom check; B's bell shows the care circle alert (with A's name and the level, not the symptoms) and a Call button for A's phone.
- **Download my data:** on the profile page, confirm with the password; the browser saves `nabad-data-YYYY-MM-DD.json`, which must be valid JSON for this account (and not contain a password hash), and the account gets the "A copy of your Nabad data was downloaded" email.

### Never against production

The tests that sign up, add or delete anything refuse to run when `NABAD_BASE_URL` points at the live site (https://nabad-psi.vercel.app), with a message saying so. Only the read-only public page tests run there.

### In CI

[e2e.yml](../.github/workflows/e2e.yml) runs the suite on every pull request: `docker compose up -d --build`, wait until the frontend and `/api/health/ready` answer, install Python and `tests/requirements.txt`, run the suite in headless Chrome, upload the failure screenshots and the Docker Compose logs as the `e2e-artifacts` artifact, then `docker compose down -v`.

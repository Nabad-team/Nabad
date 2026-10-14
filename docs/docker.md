# Running Nabad locally with Docker

One command starts the whole app on your machine: the web app, the API, a MongoDB database and a local email inbox. Nothing here touches production: the API still deploys to Render ([render.yaml](../render.yaml)) and the web app to Vercel.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, macOS or Linux), started and running. It includes Docker Compose.
- Free ports on your machine: 3000, 5000, 8025 and 27018.

No Node.js, MongoDB or email account is needed on your machine.

## Start

From the repository root:

```bash
docker compose up
```

The first run builds the images and takes a few minutes. It is ready when the `frontend` container logs `Ready`. Add `-d` to run in the background (`docker compose logs -f` shows the logs), and `--build` after you change code, so the images are rebuilt.

Stop with `Ctrl+C`, or `docker compose down` if it runs in the background. Your data is kept.

## URLs

| What | URL |
| --- | --- |
| Nabad (the app) | http://localhost:3000 |
| API (readiness check) | http://localhost:5000/api/health/ready |
| Mailpit inbox (every email the app sends) | http://localhost:8025 |
| MongoDB (for Compass or `mongosh`, optional) | `mongodb://localhost:27018/nabad_development` |

All ports are bound to `127.0.0.1`, so nothing is reachable from other machines on your network.

## Trying the full flow

1. Open http://localhost:3000 and sign up with any email address (for example `you@example.test`). No real email is sent.
2. Open the Mailpit inbox at http://localhost:8025, open "Verify your Nabad email" and follow the link.
3. Sign out and sign in again. Locally, new accounts have email two-factor authentication on (`TWO_FACTOR_ON_SIGNUP=true`), so Nabad asks for a code: it is in Mailpit under "Your Nabad verification code".
4. Every page works: profiles and linked profiles, medications, water and sleep, My health, symptoms and triage. "Forgot password" emails also arrive in Mailpit.

Google sign-in is off locally unless you add your own OAuth client (see Configuration).

## How it fits together

| Service | Image | What it does |
| --- | --- | --- |
| `frontend` | built from [frontend/Dockerfile](../frontend/Dockerfile) | Next.js app on port 3000. Its `/api/*` rewrite forwards to `http://backend:5000`, set at build time through the `BACKEND_URL` build argument. |
| `backend` | built from [backend/Dockerfile](../backend/Dockerfile) | Node/Express API on port 5000, in `APP_ENV=development`. Starts once MongoDB is healthy. |
| `mongo` | `mongo:8.0` | Database `nabad_development`, stored in the `mongo-data` volume. |
| `mailpit` | `axllent/mailpit` | Catches all email (SMTP on 1025, inside the network only) and shows it at port 8025. |

The services talk to each other by name on a private Compose network. Both app images run as the unprivileged `node` user. See [architecture.md](./architecture.md#local-development-docker-compose) for a diagram.

## Configuration

The backend reads [.env.docker.example](../.env.docker.example): safe local placeholders only (a local-only `JWT_SECRET`, Mailpit's placeholder login, 2FA on at signup). Service addresses (MongoDB, Mailpit, `CLIENT_ORIGIN`) are set in [docker-compose.yml](../docker-compose.yml).

To change something, copy the file to `.env.docker` (git-ignored) and edit only the lines you need, then run `docker compose up -d` again. For example, `PWNED_PASSWORDS_CHECK=off` to work fully offline, or your own Google OAuth client:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Never put real secrets in `.env.docker.example` or anywhere else in git. The production startup checks are unchanged: with `APP_ENV=production` the API still refuses to start without every required secret.

## Reset the local database

This deletes every local account and all local health data (only on your machine):

```bash
docker compose down -v
docker compose up
```

`-v` removes the `mongo-data` volume. To empty only the Mailpit inbox, use "Delete all" in the Mailpit web page (it is also emptied whenever the `mailpit` container is recreated).

## Troubleshooting

- **"port is already allocated"**: something else uses 3000, 5000, 8025 or 27018 (often `npm run dev` or a local backend). Stop it, or change the left-hand port in `docker-compose.yml` (for example `"127.0.0.1:3001:3000"`). If you change the app port, also set `CLIENT_ORIGIN` in `docker-compose.yml` to match, or every sign-in is refused with "Origin is not allowed".
- **`docker` is not recognized / cannot connect to the Docker daemon**: start Docker Desktop and wait until it says it is running.
- **The backend stays "unhealthy" or the frontend never starts**: run `docker compose logs backend`. A `startup_failed` line names the problem, for example a value in your `.env.docker` that is too short (`JWT_SECRET` and `TWO_FACTOR_CODE_SECRET` need at least 32 characters).
- **No email in Mailpit**: check `docker compose logs backend` for `email_failed`. Codes can be re-sent at most once a minute and 5 times an hour.
- **Code changes don't show up**: rebuild with `docker compose up --build`.
- **Sign-in codes stop working after a restart**: only if you removed `TWO_FACTOR_CODE_SECRET` from your settings. Ask for a new code.
- **Start completely fresh**: `docker compose down -v --rmi local` removes the containers, the database volume and the built images.

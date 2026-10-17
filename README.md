# Nabad

## Run it locally

With Docker Desktop running, `docker compose up` from the repository root starts the whole app: http://localhost:3000, with every email (verification, reset, 2FA codes) in a local inbox at http://localhost:8025. See [docs/docker.md](./docs/docker.md).

## Testing

Backend, frontend and Selenium end-to-end tests run on every pull request. [docs/testing.md](./docs/testing.md) explains each layer and how to run the end-to-end suite locally against Docker.

## Architecture

[docs/architecture.md](./docs/architecture.md) describes production (Vercel, Render, MongoDB Atlas, Brevo, Google sign-in, GitHub Actions) and local development, with diagrams, the backend modules and the security layers.

## Deployment

The frontend is live at **https://nabad-psi.vercel.app** (Vercel project `nabad`).

To redeploy to production, run this from the repository root:

```bash
npx vercel --prod
```

(On Windows PowerShell, use `npx.cmd vercel --prod` if `npx` is blocked.) The first time on a new machine, run `npx vercel login`, then `npx vercel link --project nabad` to connect the repository to the project. The Vercel project root is configured as `frontend/`.

The browser only talks to the frontend: `frontend/next.config.js` forwards every `/api/*` request to the backend, so the login cookie stays on the frontend site. Set `BACKEND_URL` in the Vercel project (Settings → Environment Variables) to the backend origin without `/api`, e.g. `https://nabad-backend-nhv5.onrender.com`, then redeploy; the rewrite is fixed at build time. Locally it defaults to `http://localhost:5000`.

The backend runs on Render from [render.yaml](./render.yaml) (Blueprint). Secrets (`MONGO_URI`, `JWT_SECRET`, `TWO_FACTOR_CODE_SECRET`, SMTP) are entered in the Render dashboard, never committed.

## Authentication configuration

The backend requires `MONGO_URI` and a random `JWT_SECRET` of at least 32 characters. Set `CLIENT_ORIGIN` to the frontend origin. Password reset and two-factor codes are sent by email and require `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` (optionally `SMTP_SECURE=true`; the older name `MAIL_FROM` still works). Two-factor codes are stored as an HMAC keyed with `TWO_FACTOR_CODE_SECRET` (at least 32 random characters, required in production; elsewhere a random key per process is used if it is unset). With `APP_ENV=production` the server refuses to start if any required variable is missing and logs the missing names (never their values). Google sign-in is optional: without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` the server logs a `google_signin_disabled` warning and the Google routes answer 503, but setting only one of the two stops startup.

When the backend sits behind the Vercel rewrite and a host load balancer, set `TRUST_PROXY=2` so rate limits count each visitor separately. See [manual-test-plan.md](./manual-test-plan.md) for release checks. Triage has one engine: the safety rules in `backend/src/triage/urgency.js`, plus an optional AI assessment turned on by the `LLM_*` variables (production uses Google Gemini through its OpenAI-compatible endpoint; see [architecture](./docs/architecture.md) and the optional [self-hosted AI](./docs/self-hosted-ai.md)).

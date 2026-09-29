# Nabad

## Deployment

The frontend is live at **https://nabad-psi.vercel.app** (Vercel project `nabad`, team `nabad3`).

To redeploy to production, run this from the `frontend/` folder:

```bash
npx vercel --prod
```

(On Windows PowerShell, use `npx.cmd vercel --prod` if `npx` is blocked.) The first time on a new machine, run `npx vercel login`, then `npx vercel link --project nabad` to connect the folder to the project. You need to be a member of the `nabad3` Vercel team.

## Authentication configuration

The backend requires `MONGO_URI` and a random `JWT_SECRET` of at least 32 characters. Set `CLIENT_ORIGIN` to the frontend origin. Password reset email also requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` (optionally `SMTP_SECURE=true`). Two-factor authentication requires `TOTP_ENCRYPTION_KEY`, a 32-byte key encoded as 64 hex characters; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and keep it in the deployment secret store. Back up that key securely: losing it makes enrolled authenticator secrets unreadable.

### googleId index fix (runs automatically)

Older databases have a `googleId_1` index that allowed only one email/password user, so the second signup failed with `E11000 duplicate key ... googleId: null`. On startup the backend now checks for that old index. If it finds it, it drops it and creates the correct one (unique only for users that have a Google ID), and logs `Replaced old googleId_1 index with a partial unique index.` You don't need to do anything: just restart the backend once. Once the index is fixed, the check does nothing. The code is in `backend/src/migrations/fixGoogleIdIndex.js`.

### Backend tests

From `backend/`, run `npm test`. The tests start an in-memory MongoDB (the first run downloads a MongoDB binary), so no local database is needed.

Set `NEXT_PUBLIC_API_URL` in the frontend deployment to the backend API URL. See [manual-test-plan.md](./manual-test-plan.md) for release checks and known triage/routing blockers.

# Elias Sprint 1 integration

These changes extend the existing Express, Mongoose and JWT implementation. The standalone SQLite project is not added to this repository. Existing authentication and logout routes remain the single implementation.

| Assignment | Existing work and integration |
|---|---|
| #6 Logout | Existing `/api/auth/logout` preserved. Auth-version revocation signs out all devices. Old cookies no longer revoke newer sessions, and a database failure no longer reports a successful logout. |
| #11 Emergency contact | Replaces the Profile page placeholder with a real form. GET/POST `/api/profile/emergency-contact` persist a name and phone on the authenticated User. Concurrent duplicate submissions return 409. |
| Database schema | Existing User model extended with a validated embedded contact. `LinkedProfile` defines the caregiver-owned dependent schema for the profile API teammate. Password-only users omit Google ID so the sparse unique index permits multiple accounts. |
| Authentication service | Existing password, Google and email-2FA implementation reused. Signed 2FA challenges cannot act as access cookies. Reset consumes its token atomically and revokes sessions and old challenges. Backend tests cover the integrated flows. |
| #86 Environments | `backend/src/config.js` and separate example files validate origins, secrets, secure cookies and explicitly selected database names. |
| Health check | `/api/health` remains liveness. `/api/health/ready` pings MongoDB and returns 503 when unavailable. |
| #89 Error logging | Structured stdout logs record request ID, route template, status, duration and error type. Unexpected errors return a generic response with the same request ID. Credentials, contact data and raw exception details are excluded. |

## Run and test

Use Node.js 24. From `backend/`, run `npm ci`, configure a private `.env` from `.env.example`, and run `npm start`. Use a local MongoDB instance or the team's configured database. From `frontend/`, run `npm ci` and `npm run dev`. Set `NEXT_PUBLIC_API_URL` to the backend base including `/api`, for example `http://localhost:5000/api`.

Run `npm test` in each folder and `npm run build` in `frontend/`. Backend integration tests launch temporary MongoDB through mongodb-memory-server; the first run downloads a MongoDB binary. They never read a production `.env` or connect to the team's database. The PR workflow runs both suites and builds the frontend.

For non-browser API clients, send `Origin` equal to `CLIENT_ORIGIN` on writes. Browser requests from the configured frontend already do this. CORS alone does not protect cookie-authenticated writes; other origins are rejected by the backend.

## Staging and production

Use `backend/config/staging.env.example` and `production.env.example` as templates in separate hosting services. Supply secrets through the host's secret manager. Set `APP_ENV` to staging or production, `NODE_ENV=production`, and an HTTPS `CLIENT_ORIGIN`. Use different database credentials, JWT secrets, mail accounts and Google callbacks for the two services.

With explicit hosted `APP_ENV`, `MONGO_DB_NAME` must end in `_staging` or `_production` respectively. This prevents accidentally copying the production database name into staging. Existing deployments without APP_ENV retain their URI-selected database. Before enabling explicit isolation for an existing deployment, back up and migrate its data to the chosen database name; simply changing the variable does not move data.

Route health probes to `/api/health/ready`; configure log collection/rotation, backups and restricted database access on the host. Cookie SameSite=Lax remains the existing behavior. Host frontend and API on the same site, or review the cookie/CSRF design before using unrelated domains. No cloud environments are provisioned by these files.

## Integration boundaries

The contact is for the signed-in account and does not follow the frontend's mock dependent-profile switcher. Editing/removing contacts is story #12 and is not introduced here. The existing profile edit, dependent CRUD, picture and account-deletion UI still use `frontend/lib/profileApi.js` localStorage mocks; this integration does not claim those features are backed by MongoDB. The new LinkedProfile model is a schema foundation and has no CRUD endpoints yet. Future account deletion must also remove owned LinkedProfile documents; MongoDB references do not cascade automatically.

No new email-verification flow is added to signup, because that is another teammate's story and the current frontend expects immediate signup login. The existing email-2FA flow is preserved. Live Google OAuth, SMTP delivery and hosted database configuration require their real credentials for release testing.

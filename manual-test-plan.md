# Manual release test plan

Run these checks in staging before each release. Record build/commit, browser and device, tester, date, result, and any defect ID for every case. Use test accounts and synthetic health details only. Confirm email links arrive in the staging mailbox. Do not use real patient data.

## Signup and account access

1. Sign up with a new valid email, a name, and an 8+ character password. Confirm the account is created and the user lands on onboarding.
2. Complete each onboarding step, use Back, then finish. Confirm the dashboard appears. Repeat using Skip.
3. Try invalid email, missing fields, short password, and an already registered email. Confirm useful validation and no duplicate account.
4. Log out or use a private browser and sign in with the correct password. Confirm access to the dashboard. Try a wrong password and an unknown email; confirm the same generic credential error.
5. Submit five incorrect passwords for a test account. Confirm temporary lockout, then verify a correct password cannot bypass it until the lock expires.
6. Confirm the auth cookie is HttpOnly, Secure in production, SameSite=Lax, and expires as configured. Confirm unauthenticated requests to protected API routes are rejected.

## Password recovery

1. Request a reset for a registered staging user. Confirm a reset email arrives with a one-hour link.
2. Request a reset for an unknown address. Confirm the page displays the same generic response and does not reveal account existence.
3. Open a valid link, set a new password, and sign in with it. Confirm the previous password no longer works.
4. Try an expired, modified, and already-used link, plus a password shorter than eight characters. Confirm each is rejected and can’t change the account password.

## Two-factor authentication

1. Sign in, open Profile → Account security, and begin setup. Add the displayed secret to an authenticator app.
2. Submit an incorrect code; confirm setup stays disabled. Submit a valid current code; confirm the UI reports enabled.
3. Sign out and sign back in. Confirm the password alone does not create a session; a valid authenticator code completes login.
4. Try an incorrect code and an expired challenge. Confirm no authenticated session is issued.
5. Disable 2FA with the correct password and code. Confirm incorrect password or code is rejected and subsequent sign-in no longer prompts for 2FA.

## Triage and emergency routing — release gate

The current workspace has no triage or emergency-routing implementation. These checks are blocked until those features are available in the release candidate. Once available, define approved test scenarios with the clinical/product owner and then verify:

1. A non-emergency symptom scenario produces the expected urgency guidance and safety wording.
2. A red-flag scenario produces the configured emergency guidance without delaying the user with unnecessary steps.
3. Emergency routing uses the correct location, facility capability, availability, and destination; missing location or routing data produces a clear fallback.
4. Confirm no scenario is presented as a definitive diagnosis, and verify the emergency contact instructions against the approved regional configuration.

Do not approve a release containing triage or routing changes while the corresponding scenarios are blocked or failing.

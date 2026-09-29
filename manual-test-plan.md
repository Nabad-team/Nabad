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

1. Sign in, open Profile → Account security, and begin setup. Confirm a 6-digit code is emailed to the account address.
2. Submit an incorrect code. Confirm setup remains disabled. Submit the valid code and confirm 2FA becomes enabled.
3. Sign out and sign back in. Confirm password alone does not create a session and a valid emailed code completes login.
4. Confirm each 2FA code expires after 10 minutes, succeeds only once, and cannot be reused after successful verification.
5. Enter an incorrect code five times. Confirm the current code is cancelled and a new code is required.
6. Request a replacement code twice within 60 seconds. Confirm the second request is rejected with a retry message. After 60 seconds, confirm a new code can be requested.
7. Disable 2FA with the correct password. Confirm subsequent sign-in no longer prompts for a code.

## Google sign-in

1. From the login page, select Continue with Google and choose a Google account.
2. Confirm the OAuth callback creates or links the Nabad account using the verified Google identity and signs the user in.
3. Confirm the OAuth state is required and an invalid state cannot complete sign-in.
4. For an account with 2FA enabled, confirm Google sign-in still requires the Nabad email verification code before a session is issued.

## Triage and emergency routing

1. Open **Symptom triage** while authenticated and submit a short symptom description. Confirm the assessment endpoint returns guidance without presenting a diagnosis.
2. Verify an empty or overlong description is rejected with a clear validation message.
3. With an approved staging `TRIAGE_RULES_JSON`, test one routine, one urgent, and one emergency scenario. Confirm the configured rule determines the returned level.
4. For an emergency result, confirm the emergency contact and instructions are shown immediately and the user is offered a nearby emergency-department search.
5. Test emergency routing directly and confirm an unauthenticated request is rejected.
6. Test an approved non-Lebanon configuration and confirm the fallback tells the user to contact local emergency services rather than inventing a facility or number.
7. Confirm no scenario is presented as a definitive diagnosis and that all clinical rules used in staging have been approved by the clinical/product owner.
8. Do not approve a release if the clinical rule configuration is missing, invalid, or has not been reviewed and approved.

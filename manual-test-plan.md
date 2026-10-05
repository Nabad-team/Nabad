# Manual release test plan

Run these checks in staging before each release. Record build/commit, browser and device, tester, date, result, and any defect ID for every case. Use test accounts and synthetic health details only. Confirm email links arrive in the staging mailbox. Do not use real patient data.

## Signup and account access

1. Sign up with a new valid email, a name, and a passphrase of at least 12 characters (for example "my cat sleeps on the sofa"; no mix of character types is needed). Paste it in and use Show password to check it. Confirm the checklist ticks off as you type, the account is created, and the user lands on onboarding.
2. Complete each onboarding step, use Back, then finish. Confirm the dashboard appears. Repeat using Skip.
3. Try invalid email, missing fields, an already registered email, and passwords that are: shorter than 12 characters, common ("password1234"), containing your name, your email name or "Nabad", known from a data leak (only with PWNED_PASSWORDS_CHECK on), and very long (37 Arabic letters). Confirm each shows its own plain message (never the browser's "match the requested format") and no account is created.
4. Log out or use a private browser and sign in with the correct password. Confirm access to the dashboard. Try a wrong password and an unknown email; confirm the same generic credential error.
5. Submit five incorrect passwords for a test account. Confirm temporary lockout, then verify a correct password cannot bypass it until the lock expires.
6. Confirm the auth cookie is HttpOnly, Secure in production, SameSite=Lax, and expires as configured. Confirm unauthenticated requests to protected API routes are rejected.

## Email verification

1. Sign up with a new address. Confirm a "Verify your Nabad email" message arrives in the staging mailbox with a link to `/verify-email?token=...` and that the dashboard shows the "Please verify your email" banner.
2. Open the link (also try it on a different browser or device where you are not signed in). Confirm "Your email is verified" appears, and that the dashboard banner is gone after reloading.
3. Open the same link again. Confirm it is rejected as invalid or expired and nothing changes.
4. On a new unverified account, select Resend verification email twice within a minute. Confirm the second attempt asks you to wait, and that after a minute a new email arrives. Confirm the older link no longer works and the newest one does.
5. Edit one character of a link's token, and remove the token from the address. Confirm both show a plain error and the account stays unverified.
6. Confirm a Google sign-in account never shows the banner, and that completing a password reset or entering an emailed 2FA code also clears it.

## Emergency contact

1. On Profile with no contact saved, add a name and a Lebanese phone number. Confirm it shows with Edit contact and Remove contact buttons and survives a page reload.
2. Select Edit contact. Confirm the form is pre-filled. Change both fields, save, and confirm the new values show and survive a reload. Repeat, but select Cancel, and confirm nothing changed.
3. While editing, enter an invalid phone ("abc") and an empty name. Confirm each shows a plain message, the typed values stay in the form, and the saved contact is unchanged after a reload.
4. Select Remove contact, then Keep contact. Confirm the contact is still there. Select Remove contact, then Yes, remove. Confirm the add form returns empty and the contact is gone after a reload.
5. Add a new contact after removing one. Confirm it saves normally.

## Password recovery

1. Request a reset for a registered staging user. Confirm a reset email arrives with a one-hour link.
2. Request a reset for an unknown address. Confirm the page displays the same generic response and does not reveal account existence.
3. Open a valid link, set a new password, and sign in with it. Confirm the previous password no longer works.
4. Try an expired, modified, and already-used link, plus passwords that are too short, common, contain the account's name or email name, or are too long. Confirm each is rejected with a plain message and can’t change the account password, and that a valid link still works afterwards.
5. Sign in as a user created before the 12-character rule with their old shorter password. Confirm they can still sign in and are not asked to change it.

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

## Triage and emergency routing — release gate

The current workspace has no triage or emergency-routing implementation. These checks are blocked until those features are available in the release candidate. Once available, define approved test scenarios with the clinical/product owner and then verify:

1. A non-emergency symptom scenario produces the expected urgency guidance and safety wording.
2. A red-flag scenario produces the configured emergency guidance without delaying the user with unnecessary steps.
3. Emergency routing uses the correct location, facility capability, availability, and destination; missing location or routing data produces a clear fallback.
4. Confirm no scenario is presented as a definitive diagnosis, and verify the emergency contact instructions against the approved regional configuration.

Do not approve a release containing triage or routing changes while the corresponding scenarios are blocked or failing.

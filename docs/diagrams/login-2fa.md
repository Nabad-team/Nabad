# Sign-in with password and two-factor authentication

Signing in with an email and password on [/login](../../frontend/pages/login.js), with email 2FA, "Remember this device" and the two lockouts. The code: [routes/auth.js](../../backend/src/routes/auth.js) (`POST /api/auth/login`, `/2fa/verify`), [twoFactorProtection.js](../../backend/src/twoFactorProtection.js), [passwordHashing.js](../../backend/src/passwordHashing.js) and [session.js](../../backend/src/session.js). PNG: [png/login-2fa.png](./png/login-2fa.png).

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as Login page<br/>(browser)
    participant PX as /api proxy<br/>(Next.js rewrite)
    participant AU as Auth route<br/>/api/auth
    participant DB as MongoDB
    participant EM as Email<br/>(Brevo)

    U->>FE: Email and password
    FE->>PX: POST /api/auth/login { email, password }
    PX->>AU: Forwards (20 sign-in requests per 15 min per IP)
    AU->>DB: Find the user by email

    alt Unknown email
        AU->>AU: Same Argon2id work as a real account
        AU-->>FE: 401 Invalid email or password
    else Account locked (5 wrong passwords)
        AU-->>FE: 423 Account temporarily locked, try again later
    else Wrong password
        AU->>DB: failedLoginAttempts + 1, at 5: lock for 15 min
        AU-->>FE: 401 Invalid email or password (same message)
    else Right password
        AU->>DB: Reset the failed-attempt count
        alt 2FA on and no valid trusted-device cookie
            AU->>AU: 2FA step locked? Then 429, no code is sent
            AU->>DB: Store HMAC of a 6-digit code, valid 10 min<br/>(1 per minute, 5 per hour)
            AU-)EM: Email the code
            EM-)U: Your Nabad verification code
            AU-->>FE: twoFactorRequired + challenge (10-min signed token)
            U->>FE: Enters the code, ticks Remember this device
            FE->>PX: POST /api/auth/2fa/verify { challenge, code, rememberDevice }
            PX->>AU: Forwards
            AU->>AU: Check the challenge, the account and the lock
            alt Wrong code, 10th wrong code in an hour
                AU->>DB: Lock the 2FA step for 30 min
                AU-)EM: Security alert email to the user
                AU-->>FE: 429 Too many attempts, locked
            else Wrong code
                AU->>DB: Count the wrong code (5 on one code cancel it)
                AU-->>FE: 401 Invalid verification code
            else Right code
                AU->>DB: Clear the code atomically (works once)
                opt Remember this device
                    AU->>DB: Store hash of a new device token (max 10 devices)
                    AU-->>FE: Trusted-device cookie, 30 days
                end
                AU-->>FE: Session cookie: signed JWT, httpOnly, SameSite=Lax
            end
        else 2FA off, or a remembered device
            AU-->>FE: Session cookie: signed JWT, httpOnly, SameSite=Lax
        end
    end
    FE-->>U: Dashboard (session: 30 min idle, 12 h maximum)
```

- **Two lockouts.** 5 wrong passwords lock the account for 15 minutes (423). 10 wrong 2FA codes in an hour lock the 2FA step for 30 minutes (429) and email a security alert; while it is locked no code is checked, not even a right one.
- **Nothing to guess from.** An unknown email and a wrong password get the same answer in the same time; 2FA is only mentioned after the right password.
- **Stored as hashes only.** The code is stored as an HMAC keyed with `TWO_FACTOR_CODE_SECRET`, trusted-device tokens as SHA-256; the browser holds the only copy of each.
- **Sessions.** Sign-out and password reset increase the user's `authVersion`, which ends every session and every pending 2FA challenge.

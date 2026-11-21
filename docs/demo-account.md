# Demo account

The demo account contains clearly fake, resettable sample data. Its name is **Maya Example**, its email must use the reserved `example.invalid` domain, and every record uses labels such as “Example” or “Sample”. Never copy real patient data into it.

Run `npm run demo:seed` from `backend/` with `MONGO_URI`, `DEMO_ACCOUNT_EMAIL` (optional; defaults to `demo@example.invalid`) and `DEMO_ACCOUNT_PASSWORD`. The command is idempotent: it updates the account and replaces only that account's sample health facts, medication, appointment, vital, water and sleep records. It refuses any email outside `example.invalid` and never prints the password.

Production use is an operations action: obtain approval before running it against production, pass credentials through the protected dashboard or shell rather than source control, and share the password only through the team's approved secret channel. Re-run the command to reset modified sample records and rotate the password.

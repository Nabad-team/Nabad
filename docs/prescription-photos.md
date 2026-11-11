# Adding medicines from a prescription photo (SCRUM-146)

> As a user, I want to upload a photo of a prescription so that my medication list updates automatically.

On **Medications**, **Add from a prescription** opens a panel:

1. The person takes or chooses a photo (JPG, PNG, WebP) or a PDF of the prescription, and agrees to send it to the configured AI provider. Large phone photos are made smaller in the browser first (at most 2000 px, JPEG), because the server accepts 3 MB.
2. `POST /api/prescriptions/read` sends it to the model (the same one, and the same `LLM_VISION_ENABLED` switch, as test-report photos) and returns the medicines it found, already compared with the active medications on that profile's list:
   - **New**: ticked.
   - **Changed** (same name, different dose, unit, form or schedule): ticked; adding it replaces the old entry, which is marked **discontinued** so the history of the dose change stays, and the new entry keeps the old one's reminder times.
   - **Already on the list**: not ticked.
   - **Check this**: the model said part of it was illegible, or the dose or schedule is missing. Not ticked until the person checks it.
3. The person corrects anything, picks the start date (a course "for 7 days" gets its end date), and **Add N medicines** calls `POST /api/prescriptions/apply`.

## Why there is a review step

The list fills itself in and updates with one tap, but nothing is saved before the person sees it. A handwritten prescription can be misread, and a wrong dose would then appear on the emergency card, the visit prep sheet and in reminders. The model is also given the prescription as untrusted data: text on the paper can't change what it does, and its answer is checked like a form typed by hand.

## Safety and privacy

- The photo is never stored or logged. Logs say only `prescription_read` with `success:<count>` or a failure code, and `prescription_applied` with counts. Never a medicine name or dose.
- Every field is checked against the same limits as the medication form (`readMedication` in `routes/medications.js`). A line with no readable name is left out; an overlong field is emptied, never cut.
- `apply` checks every medicine before saving any, and can only replace an **active** medication on the same profile's own list (another account's or a discontinued one answers 409).
- Limits: 10 prescriptions read and 30 applies per account per 15 minutes; up to 15 medicines per prescription; the usual 200 medications per profile.
- Works for linked profiles, like the rest of the medication list.
- The model calls count against the usage limits of SCRUM-310 (`docs/ai-fallback.md`).

## Tests

- `backend/tests/prescriptions.test.js`: reading the model's answer (illegible fields, links and markup, duplicates, limits, not a prescription), matching with the list, and both routes over HTTP with a fake vision model (consent, a photo over the usual 100 KB limit, errors, nothing logged, replacing, all-or-nothing, profiles, the 200 limit).
- `frontend/__tests__/prescriptionScan.test.js` and the last test in `frontend/__tests__/medications.test.js`.

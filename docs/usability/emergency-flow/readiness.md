# Technical readiness record — not participant evidence

Checked 8 November 2026 against app commit `cec67bf` (offline emergency-card merge). This record describes automation only. **Human sessions completed: 0/5.** The five-person pilot/study must still be scheduled and observed.

| Check | Actual result |
| --- | --- |
| `python tests/usability/emergency_study.py --check` | Passed in real headless Chromium. Synthetic phone/SMS anchor clicks were prevented across two fresh documents. No participants or calls/messages. |
| `python tests/usability/emergency_study.py --base-url https://nabad-psi.vercel.app --check` | Refused with the local-origin validation error before opening a browser. |
| `node --test backend/tests/rulesOnlyEmergency.test.js backend/tests/emergencyCard.test.js` | 12 passed, 0 failed, using disposable MongoDB. |
| `npm --prefix frontend test -- --runInBand __tests__/emergencyPopup.test.js __tests__/emergencyLocationShare.test.js __tests__/emergencyCard.test.js __tests__/offlineEmergency.test.js` | 62 passed across four suites. |
| Python syntax / CSV shape / links | Checked during kit preparation; see PR validation. |

The API tests cover all 20 canonical emergency rules with AI absent/invalid/unavailable, follow-up emergencies, quota/context failure behavior, profile isolation and emergency-card fields. The component tests cover the popup, emergency actions, contact/location error paths, card rendering and offline saving/removal. They are useful preflight evidence, not measurements of whether a person understands the flow or can get help quickly.

Re-run the guard check and manual fixture preflight before **every** session. Confirm the actual deployment/commit and device; this record does not establish staging/production readiness, actual call connection, GPS/SMS delivery or clinical effectiveness. The headless guard check is not a moderator pilot. Run the pilot before starting P01.

# UI quality audit

Audited 21 November 2026 against the shared components, page tests and signed-in browser coverage. This is an engineering audit, not a WCAG conformance claim; the manual assistive-technology work in [accessibility.md](accessibility.md) still applies.

## 24-point checklist

Every page was checked for: (1) one matching title and H1, (2) a useful lead, (3) a clear primary action, (4) semantic landmarks and heading order, (5) keyboard access, (6) visible focus, (7) labelled controls, (8) hints connected with `aria-describedby`, (9) required/optional fields stated, (10) validation beside the relevant field, (11) invalid focus management, (12) submit busy/disabled state, (13) success feedback, (14) actionable error feedback, (15) errors that do not expose private data, (16) a stable loading state, (17) a one-sentence empty state, (18) a useful filtered-empty state, (19) retry or recovery from failed reads, (20) destructive confirmation, (21) responsive layout and 200% text, (22) reduced motion/high contrast, (23) dates, times and units in the agreed format, and (24) no health meaning conveyed by colour, shape or an unlabeled number alone.

## Page coverage

| Area | Pages audited | State coverage and result |
| --- | --- | --- |
| Public and authentication | `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/providers`, `/providers/[id]`, `/contact`, `/privacy`, `/terms`, `/404`, `/500` | Forms, validation, busy feedback, public loading/errors and no-result recovery are covered by page tests and public browser scans. Pass. |
| Core signed-in flow | `/dashboard`, `/symptoms`, `/health-assistant`, `/notifications`, `/onboarding` | Loading, failure and first-use states are explicit. Dashboard progress was fixed in this audit: plain sentences replace empty rings, and missing water/sleep is stated as “not logged yet” instead of displaying zero. Pass after fix. |
| Care and tracking | `/appointments`, `/medications`, `/medication-overview`, `/water-and-sleep`, `/wellbeing`, `/team-dashboard` | Add/edit forms, confirmation, optimistic rollback, empty lists, partial failures and permission states are covered. Pass. |
| Records | `/my-health`, `/my-history`, `/vitals`, `/medical-documents`, `/visit-prep`, `/visit-prep-share/[token]`, `/emergency-card` | Loading, empty, filters, invalid input and save/export feedback are explicit. Documents gained a safe Preview action in this audit; unsupported active formats remain download-only. Pass after fix. |
| Account and sharing | `/profile`, `/security`, `/care-circle`, `/care-circle/accept` | Profile forms, upload limits, invitation errors, empty membership, security busy states and destructive confirmations are covered. Pass. |

## Follow-up evidence

Frontend Jest, backend API tests, the production build, axe browser scans and Selenium remain the executable evidence. Manual screen-reader, zoom, forced-colours and mobile checks must be recorded separately rather than inferred from automated tests.

# Accessibility: WCAG 2.2 AA target

Nabad targets WCAG 2.2 Level AA for screen-reader, keyboard and low-vision use. This is a working engineering target, **not a claim of complete conformance or certification**. Automated checks cover selected pages/states; actual assistive-technology testing and the manual checks below remain necessary.

## Using the app

- The first keyboard link skips navigation and moves focus to the main content. Standard links/buttons support Tab, Shift+Tab and Enter/Space as appropriate. The header search supports Down Arrow to results and Escape back to the input.
- Emergency alerts and confirmation dialogs use native modal dialogs, named headings, contained focus, an inert background and focus restoration. Dismissible confirmation dialogs close with Escape. The privacy timeout warning stays until **Stay signed in** is chosen or the session ends; it is keyboard operable.
- In **My profile → Accessibility**, choose larger text, high contrast or simplified mode. These remain usable for the current session if browser storage is unavailable; the app explains when preferences cannot be saved. Corrupt/invalid stored values fall back to supported defaults.
- The layout reflows at narrow widths; the tested core pages avoid whole-page horizontal scrolling at 320 CSS pixels, 200% text enlargement and a 320px/extra-large-text combination. Two-dimensional data such as calendars/tables may scroll inside labelled containers. Browser zoom and forced-colors modes remain supported; reduced-motion preferences disable nonessential motion.
- Forms have associated labels, hints and error descriptions. Status/error messages and emergency alerts use semantic roles. Icons that duplicate text are hidden from assistive technology; buttons/links expose names and purposes.

## Issues corrected in this change

| Finding | Change | Verification |
| --- | --- | --- |
| Small dashboard call-caption contrast was 4.41:1, below 4.5:1 | Removed text opacity, increased caption size and retained full-contrast button text | Browser axe contrast scan |
| Skip-link destination lacked explicit focusability | Main landmark has tabindex=-1, without an extra sequential tab stop | Unit check and real Tab/Enter/Tab navigation |
| Shared div dialogs did not make their background inert | Native modal top layer, controlled Escape dismissal, focus containment/restoration and bounded scrolling | Component tests plus real-browser background-focus rejection and keyboard checks |
| Enlarged header text/hidden desktop labels and a narrow dashboard action could expand the page | Wrapping workspace navigation, semantic group labels and stacking progress content at narrow widths | 320px, 200% text and 320px/125% browser checks |
| Blocked storage could crash accessibility/profile preference handling | Validated settings, guarded reads/writes and session-only fallback with status | Preference and profile-switch tests |
| Suggested questions used an aria-label on an unnamed generic div | Named semantic group | Axe/manual ARIA review |
| Shadow-only focus rings disappear in OS forced-colors mode; assistant focus outlines were faint | Real system Highlight outlines in forced colors and stronger theme-color assistant focus indicators | Browser forced-colors keyboard checks |
| Gradient support surfaces prevented deterministic contrast calculation | Flat theme-token surfaces preserve legibility in normal/high-contrast modes | Browser scan and manual-review report |

## Automated regression checks

The existing Selenium job installs an isolated, exact-pinned **axe-core 4.10.3** using `tests/accessibility/package-lock.json`. It is test tooling only, not part of the production bundle. Version 4.10.3 was published 5 March 2025; no new runtime dependencies or external accessibility-reporting service are used.

```sh
npm ci --prefix tests/accessibility --ignore-scripts --no-audit --no-fund
python tests/test_nabad.py
```

Use the existing disposable Docker setup in [testing.md](testing.md); signed-in tests refuse production. Public scans cover login, signup, password reset entry, the directory and offline help. Signed-in scans cover Dashboard, symptoms, medications, appointments, documents, profile, emergency card, health facts, vitals, visit preparation, water/sleep, security, notifications, medication overview, care circle and the health assistant. Additional states cover forms, invalid input, header results, confirmation/emergency modals and high contrast.

The audit runs WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tagged rules without disabling contrast or other rules. It waits for loaders/fonts/finite transitions to settle and fails on every confirmed violation. It writes rule IDs, impact and counts to `tests/artifacts/axe-*.json` (or `NABAD_ARTIFACTS_DIR`); reports omit page HTML, field values, names and record IDs. `manualReview` entries are retained, **not treated as proof of a pass**. Incomplete cases can include SVG-backed text, decorative symbols, native date controls or browser-dependent rendering.

## Manual and assistive-technology acceptance — pending

These checks require real observation; do not mark them passed based on axe alone. Record the app commit, OS, browser, assistive technology/version, settings, task, outcome and any issue. Use synthetic data and never initiate emergency calls during testing.

| Area | Required acceptance check | Status |
| --- | --- | --- |
| Desktop screen reader | NVDA with Firefox or Chrome: headings/landmarks, names/roles/states, form hints/errors, search results, dialog announcements and focus restoration | NOT RUN with actual screen-reader users |
| Apple/mobile screen reader | VoiceOver/Safari and TalkBack/Chrome: navigation order, controls, emergency alert and saved offline card | NOT RUN |
| Low vision | Real browser zoom to 200%/400%, text spacing overrides, OS forced colors, long/translated text, populated tables/charts and contrast review of every incomplete result | Partial automated browser coverage; manual combinations pending |
| Keyboard | Complete sign-in, profile selection, error recovery, search, medications, privacy timeout and emergency flow without a pointer; no lost or obscured focus | Automated core checks; full manual task review pending |
| Touch/alternative input | Target spacing, switch/voice input and mobile magnification | NOT RUN |
| Content/cognition | Understandable errors, urgency/contact distinctions and offline stale-copy warnings | Use the [facilitated study](usability/emergency-flow/README.md); human sessions remain unrun |

Coverage is sampled: a clean scan of an empty list does not establish accessibility of all data, validation paths, uploaded documents or future content. Do not suppress a finding simply to make CI green. File unresolved issues with steps, affected criteria, severity and an owner, fix blockers, then retest the affected state and assistive-technology combination. Five-person usability preparation or automated browser sessions are not a substitute for testing with people who use assistive technology.

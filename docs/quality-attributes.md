# Quality attributes and architecture decisions

Sprint 5, SCRUM-351. Reviewed against the application code on 20 November 2026.

## Quality attributes

| Attribute | Scenario and expected behavior | Implementation and evidence | Limit |
| --- | --- | --- | --- |
| Availability | A production readiness request succeeds while the API and its database are usable. Target is 99% each calendar month. | Database ping with a deadline in `backend/src/routes/health.js`; 5-minute UptimeRobot checks through Vercel, Render and Atlas. See [uptime](uptime.md) and the [measurement report](availability-response-time.md). | A short outage between checks can be missed. AI and email failures are outside readiness. Free services provide no SLA. |
| Performance | Users can search and browse providers without transferring the entire directory. | MongoDB text and 2dsphere indexes, server-side filters and pagination in `backend/src/providers/search.js`; map clustering in `frontend/lib/providerMap.js`. Existing JMeter [results](../loadtest/jmeter/README.md) separate browse-heavy and sign-in-heavy traffic. | Local Docker capacity does not establish staging or production capacity. Password hashing deliberately consumes CPU. |
| Security | Authentication and profile ownership are checked before private records can be read or changed. | Argon2id for new passwords and migration of old bcrypt hashes in `backend/src/passwordHashing.js`; session and origin checks; `backend/src/middleware/profileAccess.js`; request limits; allowlisted error reports. See the [security layers](diagrams/security-layers.md). | Controls require correct environment settings. Operator 2FA and restore drills need dashboard evidence. |
| Privacy | Health content is limited to the requested operation, and failure reporting excludes personal data. | Profile-scoped APIs, encrypted backups, explicit sharing links, allowlisted Sentry fields in `backend/src/errorTracking.js`, and opt-in coordinate sharing for driving estimates. The [privacy policy](../frontend/pages/privacy.js) explains external processing. | Selected symptoms, questions and reports can be sent to the configured AI. Maps request third-party tiles. |
| Safety | An emergency cannot be downgraded by the AI or by an AI outage. | Rules establish an urgency floor, emergency help remains visible, and unavailable AI falls back to rules. Published provider capabilities are distinct from live availability. See [triage safety](../backend/tests/triageSafety.test.js). | Automated tests and published directory sources do not establish clinical validation or live hospital capacity. |
| Accessibility and usability | Users can reach primary actions with a keyboard and understand loading, error and empty states. | Shared controls and labels, keyboard search shortcuts, reduced-motion styles, contrast and automated browser checks. See [testing](testing.md) and [design system](design-system.md). | Automated checks cover a subset of accessibility. The Sprint 5 NVDA pass and usability fixes are separate tasks. |
| Maintainability | Each change has repeatable checks, an owner and a recoverable release path. | A single frontend/API repository, shared UI and access helpers, pull requests into main with seven required checks, and a separate production release branch. See [environments](environments.md) and [rollback](rollback.md). | CI cannot prove that operator secrets or a third-party service are configured correctly. |

## Decision records

These records describe decisions already reflected in the repository.

### ADR-01 Keep browser API traffic on the same origin

The frontend and API have different hosts, while sessions depend on cookies. The browser calls `/api` on the frontend and Next.js forwards those calls to Render. This keeps session cookies first-party and gives the API a single browser origin to validate.

The frontend proxy strips visitor-supplied client-IP headers and sends the trusted address with a shared secret. Both environments need matching proxy configuration. The extra proxy hop and cross-region database connection affect response times.

Evidence is in `frontend/proxy.js`, `frontend/next.config.js`, `backend/src/clientIp.js` and [environment configuration](environments.md#client-ip).

### ADR-02 Use deterministic safety rules alongside optional AI

Natural-language guidance benefits from AI, while emergencies need a predictable minimum response. Rules set the minimum urgency, and AI can raise that urgency. AI failures use the existing rules fallback.

This provides guidance during an AI outage, but rule coverage and wording still require review. Test-set results describe tested cases rather than clinical accuracy across all patients.

Evidence is in `backend/src/triage/urgency.js`, `backend/src/triage/ai/aiTriage.js`, [AI fallback](ai-fallback.md) and the clinical safety tests.

### ADR-03 Query provider data through MongoDB indexes

The directory combines text, location and capability filters. A text index handles keyword matches, and `$geoNear` uses the 2dsphere index for distance. When both are needed, text-matched IDs become a condition on the geospatial query because both indexed operators require the first stage.

Pagination bounds the returned list. Database indexes add storage and must exist before efficient queries can run. Unlocated facilities remain searchable but cannot receive a fabricated map position or driving estimate.

Evidence is in `backend/src/models/Provider.js`, `backend/src/providers/search.js` and [provider integration](provider-directory.md).

### ADR-04 Separate staging changes from production releases

Every merged feature reaches a test environment before a release. Main and production use separate databases and secrets. Gerges releases through a main-to-production pull request after checking staging.

This reduces accidental exposure of test data and gives the team a release checkpoint. Changes on main can be complete before they appear on production. Free-tier cold starts and manual operator steps remain part of the operating model.

Evidence is in [environments](environments.md), [operations](operations.md), [release history](releases.md) and the [rollback procedure](rollback.md).

### ADR-05 Use external webpack scripts for the strict script policy

The Turbopack production output included an inline chunk loader. The webpack build emits same-origin runtime scripts, allowing `script-src 'self'` and `script-src-attr 'none'` while retaining static Pages Router pages.

This follows the documented ZAP follow-up without introducing per-request rendering or nonce management. Production must use the package build command. The separate inline-style exception remains documented for styled-jsx and Leaflet.

Evidence is in `frontend/package.json`, `frontend/next.config.js`, the CSP regression tests and [security scanning](security-scanning.md).

### ADR-06 Keep operational evidence separate from product promises

Readiness checks, load-test percentiles and uptime ratios measure different things. The report records the target, environment, sample period and source with each result. Live directory status, historical load-test results and safety test counts are not treated as guarantees.

This makes limitations visible in the final presentation and allows new JMeter results to be compared with their original scenario settings.

Evidence is in [the measurement report](availability-response-time.md) and [the JMeter methodology](../loadtest/jmeter/README.md).

## Code and dependency review

SCRUM-347 removed the unreferenced `HealthCard` and `WellbeingCard` components. The current dashboard uses `ProgressSummary` and `useDashboardData`. Imports, tests, scripts, evaluation tools and framework entry points were checked before removing files.

All remaining direct dependencies have runtime, test, framework, CLI or asset-generation uses. In particular, bcryptjs is needed by legacy-hash tests, franc-min by the offline evaluation adapter, sharp by asset-generation scripts, and nodemon by local development. Next.js is pinned to the patched 16.4.5 release following the November security advisory. This review does not establish that the entire dependency tree is free of advisories.

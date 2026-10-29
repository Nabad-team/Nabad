# Provider directory visit reports and insurance

This change implements the remaining provider-directory work assigned to Elias in the Sprint 3 plan: insurance filtering, services source review, visit feedback, recent waiting-level estimates, incorrect-information reports, and a public provider detail page. It extends the existing directory, database seed, authentication and design components. It does not change triage assessment or emergency-routing logic.

## Provider pages and insurance

Every result links to /providers/:id. Detail pages are public and include sourced facility information, services, insurance, directions, anonymous rating totals and recent waiting levels. A read-only share link and copy button use the canonical provider ID, without search coordinates or account information. Retired IDs resolve to their existing canonical facility.

The directory accepts an insurance filter in its existing public API and shareable URL, for example /providers?insurance=nssf. Insurance queries use a MongoDB index and combine with specialty, service, location, distance and pagination filters.

Seven facilities have sourced insurance or payer lists in this snapshot: AUBMC, Bellevue Medical Center, Hotel Dieu de France, Ain W Zain Medical Village, Aboujaoude Hospital (existing slug hopital-abou-jaouke), Khalaf Al Habtoor Hospital and Clemenceau Medical Center. Sources and separate check dates are displayed. Lists include NSSF, COOP, named private insurers, and clearly labelled third-party administrators where published. No payer list is invented for the remaining facilities.

A published insurer or administrator relationship is not a promise that every policy, procedure or doctor is covered. The interface asks users to confirm their policy, approvals and costs directly.

## Services source review

The directory still contains 176 distinct listings: 174 hospitals and 2 clinics. All 90 records that previously had empty service lists were reviewed. Published service information is now available for 153 listings, compared with 86 before this change. The remaining 23 stay unknown.

MoPH facility pages provide laboratory and general-radiology licences and published bed categories. Positive bed counts are represented as broad medical, surgical, pediatric, obstetric/gynecologic or critical-care categories; they are not treated as proof of CT, MRI, a cath lab or live operating capacity. Syndicate profiles and hospital or institutional pages provide additional named services. Planned equipment purchases and services at another campus are not assigned to a facility.

Each reviewed listing has serviceSources and servicesReviewedAt. When a review finds no usable capability data, the seed can advance those review fields without replacing curated facility fields or advancing the complete verifiedAt snapshot. Ordinary complete updates retain the existing strictly-newer verifiedAt rule. No new provider identities or duplicate facilities are added.

All dates are source-review dates, not guarantees of present staffing, equipment operation or access. Call before travelling, and do not delay emergency assistance while consulting the directory.

## Visit feedback and waiting reports

Signed-in users can save, update or remove one current review per account and canonical facility. A review contains a rating from 1 to 5, a valid past-or-current visit date, and an optional private note of up to 1000 characters. Public pages show only aggregate ratings, without author names, account IDs, visit dates or notes. Visits are self-reported, not independently verified measures of clinical quality.

An optional waiting observation must be explicitly confirmed as observed within the last two hours, with a consistent visit date. The server sets its timestamp. It is short (under 30 minutes), moderate (30 to 60), or long (over 60). The observation stops contributing exactly two hours later. At least three reporting accounts are needed to show a level; otherwise it stays unknown. The displayed level is the upper median of recent observations and includes the report count and latest observation time.

A unique compound index prevents repeated or concurrent saves from multiplying one account's vote. Counts and waiting distributions are aggregated in MongoDB. Public APIs never load or expose private notes for summaries. Directory and detail pages refresh reports every minute; a failed detail refresh returns its displayed waiting level to unknown.

The estimate is a community report, not a live queue or a prediction of an individual's wait. Emergency care is prioritized clinically and must not be delayed because a hospital appears busy.

## Incorrect information reports

Signed-in users can report a problem with a name, address/location, telephone, hours/emergency status, insurance, services or another field. Suggestions are private, limited to 1000 characters and stored as pending. Submitting again for the same facility and field replaces that account's earlier suggestion; it does not create duplicates. Users can see their own reports and withdraw them.

Reports never automatically overwrite the published directory. An authorized directory operator can inspect up to 100 pending suggestions from the backend's existing database environment:

    node scripts/provider-corrections.js

The command is read-only and does not contact Jira. It omits author identity from the review output. Do not paste raw report text into public tickets; it may contain information a user should not have included. Verify proposed changes against an authoritative source, apply the existing curated-data update process and advance the appropriate source-check date.

## Security and account data

Only browsing and aggregate summaries are public. Feedback and correction endpoints use existing authentication and same-origin enforcement, plus account-based submission limits. Payload keys and scalar types are allowlisted; clients cannot choose an owner, submission timestamp or review status. Concurrent upserts have unique indexes and duplicate-key handling.

Users' own contributions are included in Download my data, without other accounts' submissions. Deleting an account removes its feedback and correction reports; removing a dependent does not remove account-level directory contributions. The privacy page explains the new storage and visibility.

Jira remained read-only throughout this work. No tickets, comments, assignments, priorities or statuses were changed. No hosting service, external analytics or new secret is introduced.

## Validation

- Backend: 783 tests passed, including insurance queries, aliases, concurrent feedback/report writes, authentication/origin enforcement, malformed input, expired/future reports, median thresholds, export privacy and deletion.
- Frontend: 550 tests passed across 59 suites, including detail load errors, public browsing, share links, insurance URL round trips, editing/removing feedback, failed writes, private correction status and withdrawal.
- Next.js 16.4.3 production build passed with /providers/[id].
- A Selenium regression covers saving/reloading/removing feedback and saving/reloading/withdrawing a correction through the real UI in the throwaway Docker test environment. GitHub CI records its result on the pull request.
- Existing triage, favorites, geospatial filtering, source updates and unrelated features remain covered by the full suites.

The uploaded files must match these tested sources. GitHub check and merge/deployment status are recorded on the pull request.

## Listings whose services remain unverified

The reviewed public sources do not establish a usable service/equipment list for these facilities. Unknown is retained instead of treating a hospital name, a proposed purchase, an insurer network listing or an unsupported assumption as a verified capability. These data gaps need an authoritative published update or confirmation from the facility; they are not resolved by the software implementation.

- Hermel Governmental Hospital (hermel-governmental): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84382/hermel-governmental-hospital
- Qana Governmental Hospital (qana-governmental): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84387/kana-governmental-hospital?facility_type=1
- Beirut Eye Specialist Hospital (beirut-eye-specialist-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84547/beirut-eye-specialist-hospital?facility_type=8
- Hopital DAR AL Raheme? (hopital-dar-al-raheme): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84612/hopital-dar-al-raheme-?facility_type=8
- Kalout Hospital (kalout-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84620/kalout-hospital?facility_type=8
- Ghossein Hospital (ghossein-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84624/ghossein-hospital?facility_type=8
- Abed El Rahman Al Nakib Hospital (abed-el-rahman-al-nakib-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84659/abed-el-rahman-al-nakib-hospital?facility_type=8
- Fakih Hospital (fakih-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84660/fakih-hospital?facility_type=8
- Iben Sinna Hospital (iben-sinna-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84666/iben-sinna-hospital?facility_type=8
- Al Assi Hospital (al-assi-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84668/al-assi-hospital?facility_type=8
- Mortada Hospital (mortada-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84673/mortada-hospital?facility_type=8
- Universal Hospital (universal-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84674/universal-hospital?facility_type=8
- Temnine General Hospital (temnine-general-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84675/temnine-general-hospital?facility_type=8
- Tannourine governmental hospital (tannourine-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84373/tannourine-governmental-hospital?facility_type=1
- Ehden governmental hospital (ehden-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84380/ehden-governmental-hospital?facility_type=1
- Orange Nassau governmental hospital (orange-nassau-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84381/orange-nassau-governmental-hospital?facility_type=1
- sour governmental hospital (sour-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84386/sour-governmental-hospital?facility_type=1
- Daher elbachek governmental hospital (daher-elbachek-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84389/daher-elbachek-governmental-hospital?facility_type=1
- Machghara Governmental Hospital (machghara-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84392/machghara-governmental-hospital?facility_type=1
- Kherbet Kanafar Governmental Hospital (kherbet-kanafar-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84393/kherbet-kanafar-governmental-hospital?facility_type=1
- Family Medical Center (family-medical-center): https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/7802
- Martyr Salah Ghandour Hospital (martyr-salah-ghandour-hospital): https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/7911
- Al Jabal Hospital (al-jabal-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84570/al-jabal-hospital?facility_type=8

The source review does not establish whether any facility is currently reachable, open, staffed or fully operating. In particular, damage reports and reopening announcements must not be read as proof of current capacity.

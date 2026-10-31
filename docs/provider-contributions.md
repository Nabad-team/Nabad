# Provider directory visit reports and insurance

This change implements the remaining provider-directory work assigned to Elias in the Sprint 3 plan: insurance filtering, services source review, visit feedback, recent waiting-level estimates, incorrect-information reports, and a public provider detail page. It extends the existing directory, database seed, authentication and design components. It does not change triage assessment or emergency-routing logic.

## Provider pages and insurance

Every result links to /providers/:id. Detail pages are public and include sourced facility information, services, insurance, directions, anonymous rating totals and recent waiting levels. A read-only share link and copy button use the canonical provider ID, without search coordinates or account information. Retired IDs resolve to their existing canonical facility.

The directory accepts an insurance filter in its existing public API and shareable URL, for example /providers?insurance=nssf. Insurance queries use a MongoDB index and combine with specialty, service, location, distance and pagination filters.

Eight facilities had sourced insurance or payer lists before the 31 October network review: AUBMC, Bellevue Medical Center, Hotel Dieu de France, Ain W Zain Medical Village, Aboujaoude Hospital (existing slug hopital-abou-jaouke), Khalaf Al Habtoor Hospital Clemenceau Medical Center and Beirut Eye Specialist Hospital. Sources and separate check dates are displayed. Lists include NSSF, COOP, named private insurers, and clearly labelled third-party administrators where published. No payer list is invented for the remaining facilities.

A published insurer or administrator relationship is not a promise that every policy, procedure or doctor is covered. The interface asks users to confirm their policy, approvals and costs directly.

## Services source review

The directory still contains 176 distinct listings: 174 hospitals and 2 clinics. All 90 records that previously had empty service lists were reviewed. Published service information is now available for 155 listings, compared with 86 before this change. The remaining 21 stay unknown.

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
- Kherbet Kanafar Governmental Hospital (kherbet-kanafar-governmental-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84393/kherbet-kanafar-governmental-hospital?facility_type=1
- Family Medical Center (family-medical-center): https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/7802
- Martyr Salah Ghandour Hospital (martyr-salah-ghandour-hospital): https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/7911
- Al Jabal Hospital (al-jabal-hospital): https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84570/al-jabal-hospital?facility_type=8

The source review does not establish whether any facility is currently reachable, open, staffed or fully operating. In particular, damage reports and reopening announcements must not be read as proof of current capacity.


## Additional primary-source review (30 October 2026)

The existing Beirut Eye Specialist Hospital record is matched to BESH by its Beirut location and MoPH telephone, 01 423 111. The hospital's own website, https://besh.com.lb/, describes ophthalmology and ENT care, outpatient consultations and surgical inpatient care. Its coverage page, https://besh.com.lb/patient-information/third-party-coverage/, names Social Security, Ministry of Health, Army and COOP/MFE. These map to existing filters. Its general claim about private insurance does not name individual insurers, so none are inferred.

Machghara Municipality's institutional page, https://www.machghara.com/en/government-institutions/machghara-governmental-hospital, matches the existing hospital name, road and telephone. It documents intensive care, CT imaging, general radiology and inpatient medical care. These existing service slugs are added. Neonatal care is not interpreted as a NICU, and investment plans do not establish additional capabilities.

Both records have newer complete snapshot and service-review timestamps so the existing seed propagates the updates. No new facility, location, specialty slug or insurance slug is created. Emergency opening hours remain unknown for both facilities. Published services do not guarantee live staffing, equipment availability or individual policy coverage.

Coverage: 176 distinct listings; 155 have at least one sourced service, 21 still have unknown service lists; 8 have sourced named payer lists. The remaining unknowns above require further authoritative evidence. Jira remains read-only; no tickets or statuses have changed.

Validation for this follow-up: all 893 backend tests across 59 suites passed against main at 761f8fa plus this change. The new regression restores prior empty records, reapplies the seed twice, checks payer search and confirms unique identities and conservative unknowns. A static comparison confirmed that only the two intended provider records changed and every slug already has an English label. No frontend source or dependency changed. GitHub upload and deployment are not confirmed for this follow-up because the local credential helper failed before authentication.


## Insurer network follow-up (31 October 2026)

The insurer's published network at https://victoire.com.lb/hospital/ was checked against existing directory names, locations and telephone numbers. Victoire is added for 69 existing hospital listings. Source links and check dates accompany every match. Existing payer lists are retained. There are now 72 listings with at least one sourced named payer.

Four apparent telephone matches were excluded: the two AUBMC clinic/department listings, Rida Mroue Hospital and Hopital Francais St Lourdes. A shared telephone number does not establish that a network contract covers another facility or department. The Arz Hospital match uses the hospital entry, not a physician listing on the same page. BESH is independently matched to its own official hospital information.

The existing English label catalogue gains the insurer name; the existing URL filter, database query and provider facts renderer handle it without a second implementation. No facilities are added. A published network entry is not a guarantee of an individual policy, approval, procedure or current payment agreement; patients must confirm coverage.

The 21 empty service lists remain unresolved. Older assessment reports, proposed equipment procurement and accounts of damage or reopening are insufficient to establish present capabilities. No CT, MRI, ICU or other service is added solely to make the completion count reach 176.

Jira is read-only by the user's explicit instruction. Bug-report drafts may be prepared locally, but actual Jira logging and status changes are excluded. GitHub publishing requires a working account connection; neither local test success nor an exported patch confirms a merge or deployment.


## Follow-up validation (31 October 2026)

Against main at b3f653e plus this follow-up, all 916 backend tests across 59 suites and all 616 frontend tests across 62 suites passed. The backend regressions check seed propagation, repeatability, exact insurer filtering, combined city filters, source metadata and exclusion of shared-telephone mismatches. Static checks confirm unchanged provider IDs/order, only permitted fields changed in 70 existing records, and English labels for every service, specialty and payer slug.

Frontend verification used identical sources in the clean mirror (203 tracked frontend files compared after line-ending normalization). Test discovery required a fresh workspace cache and disabled Watchman; no application configuration changed for this workaround. Existing feedback, correction, analytics, reliability and English regressions remain in the complete suites. Production readiness and a public directory request returned HTTP 200.

Four bug-report drafts and a 21-facility service-verification queue are saved locally for team review. They are not Jira tickets. This follow-up has not been confirmed on GitHub or production: publishing requires a working authenticated GitHub connection.

The Next.js 16.4.3 production build also passed, including the directory and provider-detail routes. This confirms local buildability, not deployment.

# Hospital directory source review

Reviewed 19 October 2026. The directory contains **174 hospital listings and 2 clinics**. Of the hospital listings, **162 have sourced coordinates and 12 have no verified map location**. These are published listings, not confirmation of current operation, live capacity or emergency readiness.

## Sources and identity matching

- [MoPH private hospital locator](https://www.moph.gov.lb/en/HealthFacilities/index/3/188/8/health-facility-locator): all five pages, 141 rows.
- [MoPH governmental hospital locator](https://www.moph.gov.lb/en/HealthFacilities/index/3/188/1/health-facility-locator): both pages, 33 rows.
- [MoPH facility map layer](https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0): hospital-only query returned 157 records, including duplicates and obvious test/placeholder records.
- [CMSM hospital network](https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1): four pages, used to resolve selected facility coordinates when MoPH pins contradicted the facility address.

The original import represented 167 of 174 table rows. This review adds Al Jabal and Al Koura after resolving their conflicting locations, and matches Hospital Almarkazi to the existing Mazboud Central record. Four table rows remain held below. Najem is consolidated into Lebanese Italian Hospital rather than counted twice. Six identities originally came from the MoPH map: Khalaf Al Habtoor, Lebanese Italian, LAU Saint John, Family Medical Center, Salah Ghandour and Mazboud Central. Existing favorites are migrated to canonical identities. The two AUB clinics remain clinics and are excluded from hospital counts.

Each imported record links to its own MoPH detail or map-feature page. Identity matches were reviewed explicitly, not accepted from fuzzy name matching. Older spelling variants such as Nine/Nini, Jeatawi/Geitaoui and Beirut Governmental/Rafic Hariri reuse existing records. District names are normalized separately from cities. Fakih's Saksakiyeh address/map places it in Saida; Qana belongs to Tyre. The conflicting table district labels are not copied blindly.

## Location and capability rules

No placeholder pins or district centroids were added. Obvious map test entries (test, fdfa, fddfsfd, errds, To be changed), repeated placeholder coordinates, and duplicate aliases are not separate facilities. Conflicting pins for Rassoul Al Aazam, Dar Al Amal, Rayan, Keserwan Medical Center, Family Medical Center, Batroun and Salah Ghandour use the matching CMSM facility location instead. Al Batoul and Universal now use explicitly approximate OpenStreetMap campus points matching the ministry names, municipalities and public contact details; the contradictory old map pins are not used.

Unknown coordinates are null, with no GeoJSON point. The public list and favorites still work; the map, directions and distance searches omit unlocated facilities. A newer source snapshot can add or withdraw a location without retaining a stale point. Location backfill only runs on numeric coordinate pairs.

The original PDF comparison added 42 hospitals to the earlier 17 providers before the broader MoPH import. Hermel Governmental uses a UNDP facility location. Clemenceau, Qana and Bchamoun retain explicitly approximate community-map locations with their source URLs. Review dates describe source checks, not a telephone confirmation of current operation.

No specialties, services, opening hours or 24/7 ER claims are inferred from a hospital's name or size. Clemenceau's published ER and Al Salam's published burn unit are sourced; other unverified capabilities stay empty/null. The directory must not be interpreted as an exhaustive list of operational emergency destinations.

## District coverage

Counts are hospitals only, including unlocated listings. A district includes towns outside its namesake city. For example, Saida district has 12 listings, while the exact Saida city filter has 5. Tripoli district has 14 listings and 10 currently assigned to Tripoli city. Choosing a city and a district combines both restrictions.

| District | Hospital listings |
| --- | ---: |
| Akkar | 5 |
| Aley | 7 |
| Baabda | 16 |
| Baalbek | 8 |
| Batroun | 2 |
| Beirut | 19 |
| Bint Jbeil | 3 |
| Bsharri | 1 |
| Chouf | 6 |
| Hasbaya | 1 |
| Hermel | 4 |
| Jbeil | 4 |
| Jezzine | 1 |
| Keserwan | 7 |
| Koura | 3 |
| Marjayoun | 2 |
| Metn | 20 |
| Minieh-Dinnie | 3 |
| Nabatieh | 7 |
| Rachaya | 2 |
| Saida | 12 |
| Tripoli | 14 |
| Tyre | 7 |
| West Bekaa | 5 |
| Zahle | 10 |
| Zgharta | 5 |

The source does not support more than ten hospitals in every district. Counts are not inflated by moving facilities, duplicating aliases or calling clinics hospitals.

## Review outcomes and remaining holds

- Al Jabal is added in Kornayel, Baabda. Ministry identity/contact data, the community-map campus and the public procurement address agree; the table's Aley/Falougha labels are not used. Procurement of a scanner does not establish an installed CT service.
- Al Koura is added in Btouratij, Koura. Its own published departments establish the listed services and 24-hour ER; the unrelated Aaba pin is rejected.
- Hospital Almarkazi is Mazboud Central (matching Arabic name, address and phone). Its ministry source is attached to the existing record.
- Najem is the existing Lebanese Italian Hospital: the ministry Arabic name, association contact details and insurer network explicitly link these names. `najem-hospital` is a retired alias of `lebanese-italian-hospital`; it is not a separate facility.
- [Hospital al Hajj](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84598/hospital-al-hajj?facility_type=8) remains held: its ministry record says closed, and current reopening/identity is unconfirmed.
- [Miniyeh Hospital](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84632/miniyeh-hospital?facility_type=8) remains held: its address overlaps the existing governmental listing; no separate identity is established.
- [Ehden Hospital](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84648/ehden-hospital?facility_type=8) remains held: shared public contact details suggest overlap, but the [CDR Zgharta report](https://www.cdr.gov.lb/CDR/media/CDR/StudiesandReports/Roads%20and%20Employment/Caza/Zgharta_Final-ESMP.pdf) lists private and governmental hospitals separately. Neither a new duplicate nor a forced merge is justified.
- [Kharroubi Hospital](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84649/kharroubi-hospital?facility_type=8) remains held: older open and later closed listings conflict.

## Capability and contact review

All ministry detail pages were re-read. Hospital identities were explicitly matched to their [Syndicate of Hospitals profiles](https://www.syndicateofhospitals.org.lb/), using name, municipality/address and public facility contacts. Only explicit service/imaging descriptions were used: bed counts, `all services`, residential supervision and 24-hour laboratory coverage do not establish particular capabilities or 24-hour ER. No new capability is copied from ministry records marked closed, under renovation or under construction. Al Rahban is also excluded from capability enrichment because the CDR report describes it as closed.

100 hospital records now have at least one sourced specialty, 86 have at least one published service, and 160 have a public facility phone. The remaining empty fields mean unverified. Association profiles can describe historical equipment: this review confirms what the cited source publishes, not that the equipment is currently operational. Al Koura's 24-hour ER is supported separately by its own department page. Nader Saab's published Monday–Saturday 08:00–20:00 schedule is separate from ER status, which remains unknown.

22 previously unlocated hospitals gained explicitly approximate campus/map points from owner-published map links or OpenStreetMap features matched to official identity/address information. Najem's duplicate unlocated listing was retired. Two newly resolved hospitals have mapped locations. Owner map links for Nader Saab, Toni Nassar and the Specialized Medical Rehabilitation Hospital use their facility place coordinates, not map viewport centers or unrelated branches.

The following 12 hospital listings still lack a sufficiently reliable coordinate pair. No town center, guessed entrance or conflicting pin was substituted:

- Palestinian Red Crescent Society Nazareth Hospital (Zahle)
- Osman Hospital (Chouf)
- SACH Medical Co.Bitar Hospital (Metn)
- Hopital Notre dame pour les Malade Cronique (Metn)
- Kalout Hospital (Nabatieh)
- Al Hikme Hospital (Nabatieh)
- Ghossein Hospital (Nabatieh)
- Social Services Association - Dar Al Ajaza Hospice (Tripoli)
- Al Rahban Hospital (Zgharta)
- Abed El Rahman Al Nakib Hospital (Saida)
- Salman Zainndine (Tyre)
- Iben Sinna Hospital (Hermel)

Direct confirmation from the facility or an updated authoritative record is still required for these locations, current operation where sources conflict, and unpublished clinical capabilities/hours. This web review did not telephone facilities.

## Validation

Provider tests cover repeatable/newer-only seeding, stable favorites, indexed text and distance queries, whole-directory pagination, Saida city versus district, unknown ER status and unlocated facilities gaining/losing map coordinates. Data checks verify at least 100 hospitals, unique slugs/MoPH identities and no repeated hospital pin coordinates. GitHub CI must pass for the final PR head before merging.

On 19 October 2026, a signed-in live browser check saved a previously unsaved hospital, reloaded, confirmed persistence, found it through the saved-only filter, removed it and confirmed removal after another reload. The account's original favorite state was restored. Regression tests cover canonical/legacy favorite URLs, migration without duplicate favorites, repeated/concurrent seeding and rejection of conflicting alias ownership.

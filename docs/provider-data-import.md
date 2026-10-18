# Hospital directory source review

Reviewed 18 October 2026. The directory contains **173 hospital listings and 2 clinics**. Of the hospital listings, **138 have sourced coordinates and 35 have no verified map location**. These are published listings, not confirmation of current operation, live capacity or emergency readiness.

## Sources and identity matching

- [MoPH private hospital locator](https://www.moph.gov.lb/en/HealthFacilities/index/3/188/8/health-facility-locator): all five pages, 141 rows.
- [MoPH governmental hospital locator](https://www.moph.gov.lb/en/HealthFacilities/index/3/188/1/health-facility-locator): both pages, 33 rows.
- [MoPH facility map layer](https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0): hospital-only query returned 157 records, including duplicates and obvious test/placeholder records.
- [CMSM hospital network](https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1): four pages, used to resolve selected facility coordinates when MoPH pins contradicted the facility address.

167 of the 174 table rows are represented using stable identities; seven are held below. Six additional hospital identities come from the MoPH map: Khalaf Al Habtoor, Lebanese Italian, LAU Saint John, Family Medical Center, Salah Ghandour and Mazboud Central. Existing hospital slugs and favorites are preserved. The two AUB clinics remain clinics and are excluded from hospital counts.

Each imported record links to its own MoPH detail or map-feature page. Identity matches were reviewed explicitly, not accepted from fuzzy name matching. Older spelling variants such as Nine/Nini, Jeatawi/Geitaoui and Beirut Governmental/Rafic Hariri reuse existing records. District names are normalized separately from cities. Fakih's Saksakiyeh address/map places it in Saida; Qana belongs to Tyre. The conflicting table district labels are not copied blindly.

## Location and capability rules

No placeholder pins or district centroids were added. Obvious map test entries (test, fdfa, fddfsfd, errds, To be changed), repeated placeholder coordinates, and duplicate aliases are not separate facilities. Conflicting pins for Rassoul Al Aazam, Dar Al Amal, Rayan, Keserwan Medical Center, Family Medical Center, Batroun and Salah Ghandour use the matching CMSM facility location instead. Al Batoul and Universal remain unlocated because available location evidence conflicts.

Unknown coordinates are null, with no GeoJSON point. The public list and favorites still work; the map, directions and distance searches omit unlocated facilities. A newer source snapshot can add or withdraw a location without retaining a stale point. Location backfill only runs on numeric coordinate pairs.

The original PDF comparison added 42 hospitals to the earlier 17 providers before the broader MoPH import. Hermel Governmental uses a UNDP facility location. Clemenceau, Qana and Bchamoun retain explicitly approximate community-map locations with their source URLs. Review dates describe source checks, not a telephone confirmation of current operation.

No new specialties, services, opening hours or 24/7 ER claims are inferred from a hospital's name or size. Clemenceau's published ER and Al Salam's published burn unit are sourced; other unverified capabilities stay empty/null. The directory must not be interpreted as an exhaustive list of operational emergency destinations.

## District coverage

Counts are hospitals only, including unlocated listings. A district includes towns outside its namesake city. For example, Saida district has 12 listings, while the exact Saida city filter has 5. Tripoli district has 14 listings and 10 currently assigned to Tripoli city. Choosing a city and a district combines both restrictions.

| District | Hospital listings |
| --- | ---: |
| Akkar | 5 |
| Aley | 7 |
| Baabda | 15 |
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
| Koura | 2 |
| Marjayoun | 2 |
| Metn | 20 |
| Minieh-Dinnie | 3 |
| Nabatieh | 7 |
| Rachaya | 2 |
| Saida | 12 |
| Tripoli | 14 |
| Tyre | 8 |
| West Bekaa | 5 |
| Zahle | 10 |
| Zgharta | 5 |

The source does not support more than ten hospitals in every district. Counts are not inflated by moving facilities, duplicating aliases or calling clinics hospitals.

## Held table rows

- [Al Jabal Hospital](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84570/al-jabal-hospital?facility_type=8): MoPH Al Jabal location/district conflicts with insurer listing; identity/location require confirmation.
- [Hospital Almarkazi](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84588/hospital-almarkazi?facility_type=8): Almarkazi may refer to Mazboud Central; identity unresolved.
- [Hospital al Hajj](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84598/hospital-al-hajj?facility_type=8): Hospital al Hajj may overlap a renamed Keserwan facility; identity unresolved.
- [Hopital Al Koura](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84629/hopital-al-koura?facility_type=8): Al Koura has conflicting source locations (Btouratij versus Aaba); identity/location require confirmation.
- [Miniyeh Hospital](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84632/miniyeh-hospital?facility_type=8): Miniyeh Hospital could overlap existing government/Al Kheir listing; identity unresolved.
- [Ehden Hospital](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84648/ehden-hospital?facility_type=8): Ehden Hospital may duplicate Ehden Governmental; identity unresolved.
- [Kharroubi Hospital](https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84649/kharroubi-hospital?facility_type=8): MoPH listing conflicts with a later published closure listing; current operation needs confirmation.

## Validation

Provider tests cover repeatable/newer-only seeding, stable favorites, indexed text and distance queries, whole-directory pagination, Saida city versus district, unknown ER status and unlocated facilities gaining/losing map coordinates. Data checks verify at least 100 hospitals, unique slugs/MoPH identities and no repeated hospital pin coordinates. GitHub CI must pass for the final PR head before merging.

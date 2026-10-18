# Hospital directory expansion — 18 October 2026

The supplied `lebanon_healthcare_directory_verified_partial_2026.pdf` is a
candidate list, not evidence of current operating status. Its 55 hospital rows
were reconciled against the existing directory and public sources. The 22
primary healthcare centers are outside this hospital import.

## Outcome

- Preserve all 17 existing records and their stable slugs, favorites and review dates.
- Add 42 hospitals: 59 providers total (57 hospitals and 2 clinics).
- Represent 53 of the PDF's 55 hospital rows: 11 already present, 42 newly added.
- Saida now has Hammoud and Saida Governmental, under South governorate.
- Hold two records pending a reliable facility-specific location: Al Hikme in
  Nabatieh and Janoub–Nabatieh. Do not substitute Dar El Hikmeh in Baalbek or
  Al-Janoub/Shuayb in Saida; those are different facilities.

The API still paginates at 20 results by default. The map displays the current
result page. The total count is the total matching the selected filters.

## Evidence and uncertainty

35 new locations use the [MoPH facility locator](https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0).
Only HOSPITAL records were considered; similarly named vaccination/health-center
records were excluded. Each seed record includes the public source URLs and a
source-review date. This date does not certify the hospital is operating today.

- Hermel: MoPH identity and the [UNDP CEDRO hospital project map](https://www.cedro-undp.org/projects-implementations/hermel-public-hospital).
- Beirut General, Najjar and Al Najdeh: facility-specific map pins in the
  [CMSM provider network](https://www.cmsm.org.lb/index.php/providers), cross-checked
  against MoPH or the German Embassy hospital network list.
- Clemenceau, Qana and Bchamoun: institutional identity corroboration plus
  OpenStreetMap-derived Mapcarta locations. These three are marked
  `locationApproximate: true`; they are not verified entrance coordinates.
  Map data credit: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
  ([ODbL](https://opendatacommons.org/licenses/odbl/1-0/)). Links to each map appear
  in the records' `sources` arrays.
- Jezzine and Marjayoun locator street-address text incorrectly says Roumieh;
  retain the matching town, district and map pin, omitting that conflicting text.
- Al Salam / Hopital de la Paix are one hospital, confirmed by its official
  website. The official site confirms its burn department.
- Clemenceau's official site explicitly states its emergency department is 24/7.
  This is published service information, not a live capacity check.

All other newly added capabilities remain empty, ER status null and hours
unknown until sourced. These hospitals can be found by name/city/governorate,
but are not silently treated as matching a specialty or emergency requirement.
No specialties or services were inferred merely from the word “hospital.”

## Existing identity matches (no duplicate inserts)

| PDF name | Existing slug |
| --- | --- |
| Baalbek Governmental | `baalbek-governmental` |
| Nabatiyeh Governmental | `nabih-berri-hospital` |
| Nini | `nini-hospital` |
| Albert Haykel | `albert-haykel` |
| Notre Dame des Secours | `notre-dame-des-secours` |
| Bellevue | `bellevue-medical-center` |
| AUBMC | `aubmc` |
| Saint George University Medical Center | `saint-george-beirut` |
| LAU Rizk | `lau-rizk` |
| Geitaoui | `geitaoui` |
| Chtoura | `chtoura-hospital` |

## Deployment and checks

The existing startup seed inserts missing slugs and updates only newer source
snapshots. No schema migration, route duplication or manual database deletion
is needed. Existing records keep their timestamps and are not overwritten by
this import. The production API total changes after the backend deployment
successfully connects to MongoDB and runs the seed.

Backend integration tests cover repeat seeding, preservation of edits, two
Saida results, pagination without duplicate/lost records, distance ordering and
radius exclusion, unknown capabilities, and explicit 24/7 ER filtering.

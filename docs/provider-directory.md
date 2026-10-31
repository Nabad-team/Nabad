# Provider directory integration

`/providers` is public. Favorites, visit feedback and correction submissions require a signed-in account. The read API is
`GET /api/providers`; PUT/DELETE `/api/providers/:id/favorite` keep the existing
authentication, origin checks and rate limits.

## Triage URL contract

Use `frontend/lib/providerFilters.js` to build links. Example:

`/providers?specialty=emergency-medicine&emergency24h=true`

Supported public URL fields: `q`, `specialty`, `service`, `city`, `governorate`,
`insurance`, `openNow`, `emergency24h`, `emergencyNeeds`, `favorites`, `page`. Boolean values are `true`/`false`.
The directory restores these on load and browser back/forward navigation. GPS
coordinates are intentionally kept out of shareable URLs; the API additionally
accepts `lat`, `lng`, `radiusKm`, and `limit` for distance searches.

Emergency triage results keep `careTypeId=emergency-department` and additionally
return `emergencyNeeds`, an allow-listed array chosen by the server from positive
matched safety rules. The frontend never parses model prose or symptoms into
filters. The link carries only capability IDs, for example
`/providers?emergency24h=true&emergencyNeeds=cardiac%2Cstroke`; GPS and symptom text
are never put in shareable URLs. Older results without requirements still offer
broad ER browsing, explicitly labelled as not condition-specific.

| Requirement | Positive rule/context | Required published capabilities |
| --- | --- | --- |
| cardiac | Chest pain / suspected heart attack | Cardiology and catheterization lab |
| stroke | Stroke signs / suspected stroke / thunderclap headache | Neurology and CT |
| trauma | Current major injury | Surgery, CT and ICU |
| burns | Current severe, serious or chemical burn | Burn unit and ICU |
| surgical | Sudden testicular pain / swallowed battery or magnets | Surgery |
| maternity | Reduced baby movements with explicit pregnancy/fetal context | Obstetrics-gynecology and maternity |
| pediatric | Baby not moving with explicit newborn/after-birth/infant-age context | Pediatrics |

These are conservative directory capability requirements, not a diagnosis,
certification of a specialist center, or a transport/treatment protocol. Ambiguous
or unmapped emergencies (including model-only escalation) retain general ER
browsing and the emergency call instruction; the application does not guess a
specialized destination. The clinical/product owner should review the requirement
mapping before release, as with the existing triage safety rules.

`GET /api/providers` accepts scalar `emergencyNeeds` as comma-separated IDs.
Unknown, nested or repeated values return 400. Every selected requirement and any
additional user filters must match: the database requires **hospital**, published
**24/7 ER**, and **all** required specialties/services before distance sorting,
counting and pagination. Setting `emergency24h=false` cannot bypass requirements.
Unverified capabilities and unknown ER status do not qualify.

On the directory, “Find nearest matching hospital” asks for location permission
and immediately sorts matching hospitals by geodesic distance. Only the first
located match on the first page is labelled closest; distance is straight-line,
not travel time. Without GPS, matches stay alphabetical without a nearest claim.
Unlocated facilities can appear in non-geographic browsing but cannot be selected
as a nearest match. No matches or denied GPS never relax capability requirements.
The page preserves a prominent call-140 link and advises emergency services to
coordinate a destination: the directory cannot confirm current staff, beds or
equipment. It does not replace emergency dispatch or delay seeking care.

Canonical specialty slugs currently seeded:
`cardiology`, `dermatology`, `emergency-medicine`, `ent`, `family-medicine`,
`internal-medicine`, `neonatology`, `nephrology`, `neurology`,
`obstetrics-gynecology`, `oncology`, `ophthalmology`, `orthopedics`, `pediatrics`,
`psychiatry`, `radiology`, `surgery`.

Service slugs: `ct`, `mri`, `cath-lab`, `nicu`, `icu`, `burn-unit`, `dialysis`,
`maternity`. The original twelve specialty slugs remain unchanged. Added directory
specialties have both display labels and sourced provider matches, checked by a
contract test. Aref confirmed that triage has no specialty list; any future rule-ID
mapping must use supported slugs and preserve emergency guidance.

## Data and update rules

The curated seed contains 176 entries (174 hospital listings and 2 clinics) across nine governorates. See `provider-data-import.md` for source review, district counts and unresolved data. Each entry includes
its sources and a source-check timestamp. MoPH supplies facility coordinates;
hospital, hospital-syndicate and institutional partner pages supply capabilities.
This remains a curated directory, not a complete national registry or live routing
guarantee. An empty capability list means unverified, not unavailable. Published
equipment does not establish staffing, bed availability or present operability.

New slugs are inserted. Existing records are updated only when the incoming
`verifiedAt` is strictly newer, using an atomic conditional update. Equal/older
snapshots preserve curated changes. To publish a correction, verify the sources
and advance that record's timestamp. Never advance dates without checking sources.
Defaults clear old optional fields when a newer curated snapshot omits them.
Unique slugs prevent duplicate records. Verified duplicate identities use `legacySlugs`: seed migration replaces retired favorite IDs with the canonical slug, removes duplicate favorites and retires the duplicate provider. Legacy favorite PUT/DELETE URLs resolve to the same canonical provider and retain authentication, origin checks and limits. A known retired slug is skipped when an older snapshot is seeded. Alias ownership is validated before any writes.

## Database search and deployment

Provider locations are GeoJSON Points in `[longitude, latitude]` order, indexed
with `2dsphere`. Startup backfills missing geometry from existing coordinates.
`$geoNear` performs radius filtering and distance ordering. A MongoDB text index
searches names, specialties, services and cities. This is word-based search rather
than arbitrary substring matching. Query operators in user text are not executed.

MongoDB requires both `$text` and `$geoNear` to be first indexed stages. Combined
queries first obtain matching IDs through the text index, then pass those IDs to
`$geoNear`. Only IDs, not complete provider documents, are materialized for this
intersection. Very broad combined searches may eventually warrant a search engine
with native geographic/text intersection. Other filters, schedule matching, total
counts and pagination execute in MongoDB. Only the returned page is formatted in JS.

Indexes are created during seed initialization, including when autoIndex is off.
Database credentials must allow index creation and normal provider writes. The
existing startup catch still logs seed/index failures without taking down unrelated
backend features. Check logs for `provider_seed_failed` after deployment; a failed
index migration must be resolved before treating directory search as ready.

No new secret or environment variable is needed. Deploy backend and frontend from
the same merged commit. Verify public browsing, URL links, service and geographic
filters, maps/directions, and authenticated favorite persistence after deployment.

## Provider detail and contribution features

See [provider-contributions.md](provider-contributions.md) for public /providers/:id pages, sourced insurance filtering, the completed service-source review, private feedback/correction storage, recent waiting aggregates, account export/deletion and validation. No Jira changes are made.

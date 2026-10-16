# Provider directory integration

`/providers` is public. Only favorites require a signed-in account. The read API is
`GET /api/providers`; PUT/DELETE `/api/providers/:id/favorite` keep the existing
authentication, origin checks and rate limits.

## Triage URL contract

Use `frontend/lib/providerFilters.js` to build links. Example:

`/providers?specialty=emergency-medicine&emergency24h=true`

Supported public URL fields: `q`, `specialty`, `service`, `city`, `governorate`,
`openNow`, `emergency24h`, `favorites`, `page`. Boolean values are `true`/`false`.
The directory restores these on load and browser back/forward navigation. GPS
coordinates are intentionally kept out of shareable URLs; the API additionally
accepts `lat`, `lng`, `radiusKm`, and `limit` for distance searches.

The existing triage result links emergency cases to published 24/7 ER facilities,
without replacing the instruction to call emergency services. Non-Lebanon results
do not link to this Lebanon-only directory. The symptom-entry result also links
to the directory, explicitly labelled as facilities in Lebanon. Triage returns
urgency and localized careType prose, not a specialty. Emergency links use only
`emergency24h=true`; other results offer unfiltered browsing. No specialty is
inferred from symptom text or rule IDs, and clinical recommendations are unchanged.

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

The curated seed contains 17 entries across nine governorates. Each entry includes
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
Unique slugs prevent duplicate records and preserve existing favorite references.

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

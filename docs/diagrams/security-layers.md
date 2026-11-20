# Security layers

Sprint 5, SCRUM-351. This is a view of the existing application boundaries.

```mermaid
flowchart TD
    user["Browser<br/>HTTPS, same-origin API calls<br/>permission prompts for location and microphone"]
    web["Vercel / Next.js<br/>CSP, anti-framing and nosniff headers<br/>strip spoofed IP headers"]
    boundary["Render API boundary<br/>trusted proxy secret and client IP<br/>origin checks, body limits and rate limits"]
    session["Authentication<br/>signed session cookie<br/>password / Google sign-in and 2FA controls"]
    owner["Authorization<br/>self or owned linked profile<br/>404 for inaccessible private records"]
    domain["Domain validation<br/>allowlisted inputs and capability filters<br/>triage rules set urgency floor"]
    db[("MongoDB Atlas<br/>separate staging and production databases")]
    ai["Configured AI service<br/>selected symptoms, questions and report content"]
    routing["HeiGIT<br/>requested starting and destination coordinates"]
    tracking["Sentry / request logs<br/>allowlisted error metadata and request IDs"]
    backup[("Private B2 backup storage<br/>encrypted production backup")]
    public["Public directory routes<br/>read-only facility information"]

    user --> web --> boundary
    boundary --> session --> owner --> domain --> db
    boundary --> public --> db
    domain --> ai
    public -->|"explicit driving-time request"| routing
    boundary -. "scrubbed failures" .-> tracking
    db -->|"scheduled authorized backup workflow"| backup
```

The public facility directory and its driving-time endpoint work without sign-in. Favorites and contribution writes require a signed-in account. The ownership layer applies to private patient data.

Google sign-in and email introduce additional service boundaries documented in [architecture](../architecture.md). The [privacy policy](../../frontend/pages/privacy.js) describes what each external service receives.

Pull-request checks protect the change path before the running system. Separate database credentials, required environment validation, the release branch, readiness checks, monitoring and restore drills cover deployment and recovery. See [quality attributes](../quality-attributes.md), [backups](../backups.md) and [operations](../operations.md).

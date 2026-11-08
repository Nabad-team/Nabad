# Header search (SCRUM-298)

Signed-in users can search from the header on desktop and mobile. Enter at least two characters; results appear after a short typing pause, or submit with Search. Matches are grouped as pages, medications, documents, appointments and hospitals. Each group shows up to six results and indicates when the query should be refined. Clear, loading, no-match and retry states are explicit.

Private results belong only to the profile currently selected in the header. Switching profiles clears the query/results and cancels the old request; signing out removes search. Hospitals use the public directory, and pages use fixed navigation labels and common keywords. Search text is case-insensitive and literal: multiple words must all match. There is no AI, fuzzy matching or search of document contents.

Medication names, document filenames/types, appointment titles/hospitals/locations, and hospital names/locations/specialties/services are searchable. Notes, document bytes, extracted reports and other accounts' or profiles' records are excluded. Results contain a label, brief context and an internal link. Private record links reveal and focus the matching list item, including discontinued medications inside the archive. These links do not download files or initiate calls.

Tab/Enter work with normal result links; Down Arrow from the input reaches the first result. Escape closes the panel and returns focus to the input. Clicking or tabbing outside closes it. Results remain scrollable within the viewport on phones.

## Privacy and API

`POST /api/search?profileId=self` accepts `{ "q": "..." }`. The existing authentication, same-origin policy and profile ownership checks apply. Queries must be strings of 2–80 characters; extra body keys, control characters and invalid profile selections are rejected. Search uses escaped literal regexes, bounded result sets, database time limits and an account-based rate limit (60/minute). Failures return an error rather than a misleading empty result.

Search text is sent in the request body, never in URLs, browser history, referrers, local storage or application logs. Responses are `no-store`; queries/results are not saved. Existing error tracking discards request bodies. Stale responses and aborted requests cannot replace the current query/profile results. No models, dependencies, credentials or notifications are added.

## Validation

Backend tests cover every result group, page aliases, account/profile isolation, minimal payloads, validation, literal regex characters, multi-word matching, empty states, result caps, hospital-only directory results, failures, query logging and rate limiting. Frontend tests cover debounce, grouping, links, keyboard/focus, retry/clear, stale responses, profile reset, aborts and record reveal.

The Selenium suite creates synthetic medications/documents/appointments, finds each through the header, checks record focus after navigation, follows a page result and a hospital result, then removes its fixtures. Manual acceptance should also check mobile width, archived medication reveal, switching the selected profile mid-search, typing a newer query before the previous response arrives, and retrying after a network failure.

# Offline emergency information

The public offline help page always provides Lebanon's Lebanese Red Cross **140** and National Lifeline **1564** (psychological support/suicide prevention). It labels their purposes and sources. Telephone calls still require a working phone network. These numbers are for Lebanon; use local emergency services when elsewhere.

While online and signed in, open **Emergency information card**, review the selected person's information and choose **Save for offline use**. This is optional and explicit. One card is saved per browser/device; saving another person's card replaces it. The copy includes identity, blood type, recorded conditions, allergies/reactions, active medications/doses/frequency and that profile's emergency contact. Its save time is displayed. Changes are not synced automatically: refresh the online card and save again to update the offline copy.

Use **Open emergency help** or `/offline.html` when the connection fails. A previously installed service worker also serves this page when normal navigation cannot connect. It works on reload and in a new tab without the React app, profile APIs or signing in. The first preparation requires internet, HTTPS (or localhost) and service-worker/browser storage support. Private/incognito restrictions, clearing site data or browser eviction can remove the copy; saving reports failures instead of claiming availability. Printing the emergency card remains an alternative.

## Device privacy

Anyone using this browser can view an explicitly saved copy without authentication. The save controls explain this; use a trusted personal device. Snapshots are stored in local storage, not encrypted, and include the account email only to reconcile account changes. They contain no credentials, documents, extracted report text, hidden facts, server responses or other profiles' information. Rendering uses text nodes and validates telephone links.

Remove the copy from either the online emergency card controls or the offline page. Signing out, inactivity/session sign-out and account deletion sign-out remove it before any network request; this also updates other tabs. Loading a different account or detecting a removed linked profile removes an incompatible copy. Source-record updates or deletion elsewhere do not remotely wipe a device that is offline; remove/replace its saved copy when reconnecting.

The service worker caches only `/offline.html` and `/offline-emergency.js`. It never caches API responses or signed-in pages, and never queues offline writes. Saving first prepares public offline resources, then stores the card. Failed preparation, unavailable storage or a profile change during preparation cannot report/save an incorrect new snapshot. The old snapshot is retained on a failed update.

## Verification

Unit/component tests cover allowlisted storage, no automatic saving, corruption, unsafe telephone links, text-only rendering, account/profile cleanup, sign-out despite network failure, storage/cache failures, cancelled/late saves, preparation timeouts, offline removal and public-only worker caching. The full frontend suite and production build are checked.

Selenium saves a synthetic card online, disables the browser network, opens and reloads offline help, checks both public numbers and the saved card, removes the copy offline and confirms removal survives reload. Additional real-browser checks cover saved medication/contact calls, fresh offline tabs, mobile width and normal navigation with the frontend server stopped. No calls or messages are initiated.

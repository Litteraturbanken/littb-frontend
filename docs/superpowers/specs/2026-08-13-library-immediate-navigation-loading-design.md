# Library Immediate Navigation Loading Design

## Problem

Client navigation from an About page to `/bibliotek` leaves the About page visible until the
Library backend requests finish. The Library page currently awaits its options and initial-data
`useAsyncData` calls during setup. Nuxt therefore keeps the preceding page mounted through the
page suspense boundary instead of mounting the Library's existing loading UI.

This makes a successful navigation feel unresponsive even though the Library already has an
accessible loading indicator for result requests.

## Desired behavior

- Client navigation to a Library route mounts the real Library shell immediately.
- Until initial results settle, the active result region is empty and shows its existing spinner
  and `Laddar resultat` status.
- The route, heading, mode, filter text, and other state derivable safely from the URL are visible
  without waiting for backend data.
- Backend-derived options and results replace their initial empty state only after the matching
  requests settle.
- A direct document request remains fully server rendered with its initial Library results.
- Leaving the Library aborts its active requests and discards its page data. Returning later starts
  with the spinner again; complete Library results are not retained across routes.
- Existing in-page Library navigation continues to own stale-request rejection and may retain its
  committed rows under a spinner where that is already the established behavior.

## Architecture

Keep loading ownership inside `app/pages/bibliotek.vue`. Do not introduce a duplicate route-level
skeleton and do not prefetch from the site navigation.

Split initial setup into two paths:

1. On the server, await the option and initial-result pipeline as today so SSR produces complete
   content and retains canonical redirect behavior.
2. On the client, start the same pipeline without suspending route navigation. Initialize the page
   from safe URL-derived state, empty response models, and `loading = true`; mount the real Library
   components immediately.

Remote option data remains authoritative for validating option-dependent route values such as
chronology and About-author filters. The initial client pipeline must not send unvalidated values.
It first accepts the option response, derives the fully validated route state, then requests the
matching result page and summary. The response is committed only if its route identity and request
generation still own the page.

The initial client request and existing in-page requests share the page's abort/version ownership
rules so a late initial response cannot overwrite newer Library interaction.

## Loading, success, and failure states

The initial client state uses the existing empty response constructors. The active Library result
component receives `loading = true`, which exposes exactly one existing
`[data-library-loading][role="status"]` spinner and no stale result rows.

When the matching initial request succeeds, commit its validated mode, controls, results, and
summary atomically, then clear loading. When it fails, commit the existing failed response model and
clear loading so the current Library error message is shown. Abort caused by leaving the route must
not publish an error.

Option failures retain the current bounded fallback behavior. Advanced controls that require remote
options remain unavailable until those options are accepted; no invalid option-dependent query is
forwarded while they are pending.

## Cache and lifecycle policy

Do not preserve complete Library results in application memory after the page unmounts. On unmount:

- abort option, initial-page, summary, and in-page requests owned by the instance;
- invalidate request generations;
- clear any Nuxt async-data entries introduced for the Library instance so a later visit cannot
  restore its complete results from the client payload cache.

The server-rendered payload may hydrate the initial direct page load, but it does not become a
cross-route Library history cache.

## Verification

Add a real Chromium regression that:

1. loads `/om/ide` and waits for its managed content;
2. configures delayed Library option/result responses;
3. clicks the site-shell `Biblioteket` link;
4. proves the URL, Library heading, Library body class, and exactly one accessible result spinner
   appear before the delayed response is released;
5. proves there are no result rows during that initial pending state;
6. releases the response and proves the expected results replace the spinner;
7. leaves the Library, returns, and proves a new request and spinner occur rather than restoring the
   prior complete result state.

Retain or add SSR authority proving a direct `/bibliotek` response still contains its complete
initial results. Run the focused Library behavior suite, affected unit/SSR suites, lint, typecheck,
and production build before deployment.

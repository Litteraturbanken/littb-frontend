# Immediate Route Shell Loading Design

## Problem

Several Nuxt pages await their first remote request during `<script setup>`. On client navigation,
Nuxt keeps the preceding route mounted until that setup promise settles. The URL changes, but the
old page remains visible and the destination's own loading UI cannot render.

Stage reproduces the problem on an author link from the Library: with the author request delayed,
the URL becomes `/författare/SöderbergH` while the Library heading and title remain visible. The
same setup pattern exists in other route families identified by the route audit.

## Desired behavior

- A client navigation mounts the destination's real page shell immediately.
- The shell exposes one page-owned, accessible loading status while its initial data is pending.
- The preceding page is no longer visible once navigation is accepted.
- Route-derived state may render immediately; backend-derived content remains empty until the
  matching request succeeds.
- Direct document requests retain complete SSR output, response status, SEO metadata, and
  server-side canonical redirects.
- Leaving a pending page aborts or invalidates its requests. Late results cannot update another
  route or a newer request generation.
- This work adds no global page-result cache and no new cross-route retention of heavy payloads.

## Approaches considered

### 1. Route-owned client loading with SSR awaiting — selected

Each affected page keeps its existing data loader and result model. The server awaits the initial
loader. The client starts the same loader without suspending navigation and renders a page-owned
pending state until the matching result arrives.

This preserves route-specific redirects, status codes, stale-request protection, and error UI. It
also lets pages with an existing spinner reuse it rather than inventing a second skeleton.

### 2. A global Nuxt suspense fallback

A global fallback could replace the old route immediately, but it would show a generic screen
instead of the destination shell. It cannot safely express route-specific controls, validation,
errors, or redirects, and it would duplicate existing loading UI.

### 3. Prefetch or retain every destination payload

Prefetching may hide latency on some links but does not cover direct or unanticipated navigation.
Retaining complete result sets increases memory usage and conflicts with the established Library
lifecycle decision. Neither approach fixes loading ownership.

## Architecture

Do not create a universal data-fetching abstraction. The shared contract is behavioral, while each
route continues to own its API types, validation, redirects, and accepted-result identity.

For each affected route:

1. Derive safe route state synchronously.
2. Create an empty or null accepted-result state and expose `pending` to the template.
3. On the server, await the initial loader and preserve existing status/redirect behavior.
4. On the client, start the initial loader after setup can return, allowing the page shell to mount.
5. Commit only a result whose route identity and request generation still own the page.
6. Render existing error UI when the owned request fails; an abort caused by navigation publishes no
   error.
7. Abort and invalidate page-owned work on route leave or unmount.

Where `useAsyncData(..., { lazy: true })` already provides this split safely, retain it. Where
post-fetch logic performs a canonical redirect or handoff, move that logic into an owned result
settlement path so server redirects remain blocking and client redirects happen after the shell has
mounted.

## Scope and delivery waves

### Wave 0: Library

Implement the already approved Library design in
`2026-08-13-library-immediate-navigation-loading-design.md` and its implementation plan. The real
Library controls and existing result spinner mount immediately. Completed Library results are not
retained after leaving the route.

### Wave 1: Author routes

Cover:

- `/författare/:author`
- `/författare/:author/dramawebben`
- `/författare/:author/biblinfo`

The ordinary and Dramawebben profiles share author-profile response and handoff semantics, but each
keeps its own canonical route. A pending route renders the author-page owner with a loading status;
profile-derived headings, biography, links, and metadata remain absent until accepted.

Biblinfo keeps its existing `Laddar bibliografisk databas` status and makes it reachable during
client entry. Its profile and bibliography sequence remains one owned pipeline so partial data does
not masquerade as a complete bibliography response.

### Wave 2: Backend-heavy tools and catalogs

Cover:

- `/sök`: chronology or advanced option loading must not block the Search shell. Primary results are
  already lazy. Option-dependent controls remain pending or disabled until authoritative options
  arrive.
- `/om/statistik`: mount `AboutPageShell` immediately and show a content status while summary,
  popular works, and popular EPUB requests settle. Successful sections may commit together to avoid
  rearranging the page three times.
- `/dramawebben/pjäser`: mount `DramawebbenShell` immediately. Catalog results and an initially
  requested source-information dialog have separate owned pending states.
- `/id/:id`: make the existing lookup loading status represent initial route lookup as well as later
  form submissions.
- `/editor/:lbid/ix/:ix/:mediatype`: mount the editor-reader owner and show a page-loading status until
  the initial page is accepted. Optional source information and hit search stay subordinate to that
  accepted page identity.

### Wave 3: Reader aliases and managed content

Cover:

- Reader source-information aliases under `/författare/:author/titlar/:title` and `/info`: render
  their existing `Hämtar läsarsidan` status while resolution is pending, then perform the owned
  canonical redirect.
- Direct Reader routes opened with `?om-boken`: the main Reader page is already lazy; source
  information must not extend route setup suspense.
- `/om/:page`: mount `AboutPageShell` immediately and place a loading status in the managed-content
  region.
- `/`: mount the static Home shell before managed Home content settles.
- `/presentationer/...`: mount a presentation owner with a localized loading region while its
  document and optional background settle. Do not fake document headings before content exists.

## Routes that require no change

- Author `Verk` and `Mer` pages already use lazy loading and accessible pending states.
- Author documents and articles already use lazy loading.
- Normal Reader page data already uses lazy loading.
- Reader media shorthand routes already mount a pending status and resolve asynchronously.
- Ordinary Dramawebben documents already use lazy loading.
- Static Contact, History, and similar pages do not suspend on initial remote work.

## Loading and accessibility

Every affected route must expose exactly one initial page-content status. Reuse existing spinners
where present. New statuses use `role="status"`, polite announcements, hidden decorative spinner
icons, and concise Swedish text owned by the page, such as `Laddar författarsidan` or
`Laddar statistik`.

Do not add a global visible focus treatment or generic full-screen loading overlay. Pending markup
must preserve the production visual shell and avoid layout shifts where the destination has stable
navigation or controls.

## Cache and lifecycle policy

No wave introduces a new store or application-level result cache. Existing SSR hydration data may
be consumed for the initial document. Existing small, intentional route handoffs may remain when
required for a canonical redirect, but they must be single-use and identity checked.

Fresh client entries start from empty accepted data unless a currently documented hydration or
single-use handoff owns the exact identity. On unmount, abort active transports where supported and
invalidate every generation so non-cooperative late settlements are inert.

## Errors and redirects

- Preserve existing SSR 404/503 mappings and canonical redirect codes.
- Client request failure replaces pending UI with the route's existing controlled error state.
- Client canonicalization happens only after validating the response and confirming route ownership.
- Aborts caused by navigation do not generate visible errors or observability noise.
- A stale request cannot redirect, publish data, or clear a newer request's spinner.

## Verification

Each wave starts with a real Chromium RED using delayed real fixture responses:

1. Navigate from a stable preceding route.
2. Delay the destination's first request.
3. Click or push the real destination route.
4. Before releasing the response, assert the destination URL, body/page owner, stable shell, exactly
   one accessible loading status, and absence of old-page content and stale result rows.
5. Release the response and assert the correct data replaces the status.
6. Navigate away while a request is pending and prove late settlement is inert.

Retain SSR authority for complete direct responses, controlled failures, and canonical redirects.
Run the focused unit/SSR/browser suites for each route family before its commit, followed by scoped
lint and typecheck. Run the full production build and the relevant desktop/mobile navigation suite
before the final handoff.

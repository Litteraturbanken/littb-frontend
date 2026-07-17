# Nuxt Reader shorthand route design

## Goal

Port the legacy Reader entry route

```text
/författare/{author}/titlar/{title}/{mediatype}?{query}
```

without changing its visible destination. The route must resolve the work's
start page and replace itself with the canonical Nuxt Reader route:

```text
/författare/{author}/titlar/{title}/sida/{startPage}/{mediatype}?{query}
```

This closes the live 404 currently reached from Library EPUB rows, history,
ID lookup, and Author Works title links. It is an architectural/route change;
it introduces no new layout or styling.

## Legacy authority

Angular matches `/författare/:author/titlar/:title/:mediatype` as a Reader
route. Its Reader metadata lookup prefers the requested representation but
falls back to the first returned representation when that media type is
absent. An etext representation without pages inherits pages from a sibling
with the same `lbworkid`. When the URL has no `/sida/` segment, Angular replaces
the URL with the selected representation's `startpagename`. Query state such
as bare `?om-boken` survives that replacement.

The existing Nuxt canonical Reader page already owns
`/sida/{page}/{mediatype}` and fetches live HTML. This slice must resolve into
that page rather than duplicate it.

## Chosen architecture

### Strict server resolver

Add a Nuxt server endpoint at:

```text
GET /api/reader/resolve/{author}/{title}/{mediatype}
```

It uses the same configured `readerSourceBase` and exact legacy
`/api/get_work_info` request as the canonical Reader endpoint. That upstream
request contains only `authorid`, `exclude=content_vector`, and `titlepath`; it
never forwards public shorthand query state. Metadata fetch and validation
move into a small server utility shared by the resolver and canonical Reader
handler so the two paths cannot drift.

The resolver accepts only `etext` in this slice because the canonical Nuxt
Reader currently supports only `etext`. It deliberately tightens Angular's
missing-media fallback: absent exact etext is `404`, never an implicit
faksimil selection. For an exact etext without pages, it retains Angular's
sibling inheritance by accepting strictly validated pages from a
representation with the same `lbworkid`. It requires a non-empty string
`startpagename`, verifies that start page exists in the resulting page list,
and returns a typed resolution containing the canonical encoded path. It must
not fetch page HTML.

Failure semantics:

- invalid or unsupported route identity: `404`;
- absent exact representation or absent start page: `404`;
- unavailable source: `502`;
- malformed source payload: `502`.

Both the resolver and canonical Reader endpoint remain `cache-control:
no-store`.

### Page-local redirect

Add the Nuxt page route:

```text
app/pages/författare/[author]/titlar/[title]/[mediatype].vue
```

Its `<script setup>` performs the one-use fetch directly with
`useRequestFetch`; no composable is introduced. On the server, setup awaits
the resolver and `navigateTo`, producing an SSR redirect. On the client, setup
starts the same async function without making setup itself async, so the
shorthand page immediately replaces the previous page with the bounded
preloader instead of remaining behind Nuxt page suspense. It strictly
validates the returned identity and canonical path before calling `navigateTo`
with `replace: true` and an SSR redirect status.

The page key is the requested `route.fullPath`. Client completion is guarded
by that captured identity and invalidated on route leave. A delayed response
therefore cannot redirect after the user has left or let an older shorthand
request win.

The existing Library EPUB title is changed from a plain internal `<a>` to
`<NuxtLink>` with the same href, classes, text, and rendered `<a>` DOM. This
restores the Angular SPA-navigation behavior without a visual change and gives
the shorthand page a real production client-navigation caller.

The page appends the raw query suffix exposed by the captured
`route.fullPath`, rather than reconstructing `route.query`, so bare versus
empty values, ordering, repeated keys, plus signs, spaces, and retained percent
spellings are not normalized by application code. The route renders no durable
UI: successful SSR requests redirect before HTML, and client navigation owns
only a bounded legacy-style preloader until it replaces the shorthand history
entry with the canonical Reader.

## Rejected alternatives

### Client-only redirect

An `onMounted` lookup would leave direct requests as empty or 404 HTML, cause
visible delay, and make canonical identity depend on hydration. It conflicts
with the hybrid/SSR requirement.

### Duplicate Reader implementation

Rendering the Reader directly at both shorthand and canonical URLs would
duplicate the largest page's state, history, search-hit, stylesheet, and error
logic. It would also leave two public identities for one page.

### FastAPI endpoint in this slice

The existing Reader metadata and HTML boundary already lives in Nuxt Nitro and
is not part of the generated v2 FastAPI client. Moving the entire Reader source
contract to FastAPI is valuable later, but doing it only for this redirect
would duplicate the live metadata provider and widen this narrowly scoped
repair. The new Nitro response is still explicitly typed and strictly
validated.

## Query and modal scope

The raw `?om-boken` query is preserved exactly so the destination contract is
ready for the Reader source-information modal. The modal itself is not
implemented in this slice; it requires a separately typed source-information
model and faithful HeadlessUI dialog port. Other Reader follow-up work remains
explicitly deferred: faksimil rendering, contents/sidebar, page chooser,
keyboard controls, editor/source branches, and additional history behavior.

## Verification

Tests must prove:

1. the resolver sends exactly one `get_work_info` request containing only the
   exact encoded `authorid`, `exclude=content_vector`, and `titlepath`, never
   forwards public query state, and never fetches Reader HTML;
2. exact `etext` metadata returns the validated start page and canonical path;
3. exact etext can inherit strictly valid sibling pages with the same work ID,
   while requested-media fallback remains intentionally rejected;
4. unsupported media, missing representations/pages, identity mismatches, and
   malformed payloads fail with the specified status;
5. a direct shorthand request returns an SSR redirect to the canonical Reader
   path while preserving bare/empty values, `+`/`%20`, repeated keys, and
   retained percent spellings from `route.fullPath`;
6. delayed client navigation from the existing Library EPUB title link shows
   only the shorthand preloader, replaces the shorthand history entry, renders
   the canonical Reader, and cannot redirect after the user leaves; a direct
   Vue Router navigation separately exercises the stronger raw-query spellings;
7. canonical Reader, Reader search-hit, Library, Author Works, typecheck,
   production build, Reader-hit desktop/mobile visual authority, and diff/API
   checks remain green.

No new visual baseline is required because the new page has no successful
visual state; the canonical Reader's existing visual and behavior authority
remains controlling.

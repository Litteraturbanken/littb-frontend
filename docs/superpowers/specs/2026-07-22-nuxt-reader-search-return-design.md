# Nuxt Reader contextual search navigation design

Status: auto-approved under the active AngularJS-to-Nuxt migration goal.

## Goal

Restore the two contextual Reader handoffs that remain inert or absent in
Nuxt:

1. return from a full-text-search hit to the exact originating `/sök` URL; and
2. open advanced full-text search scoped to the Reader's author.

This is an architectural port, not a redesign. It keeps the existing Reader
toolkit, ordering, copy, classes, typography, and responsive behavior.

## Authority and deliberate correction

Angular stores `window.location.search` in a session-global
`SearchStateService` when leaving `/sök`, then renders an ordinary anchor named
`Tillbaka till sökningen`. That preserves the original query during one SPA
session but disappears after reload or direct entry and can point at a stale,
unrelated search.

Three approaches were considered:

1. Recreate the session-global store. This is closest to Angular internals but
   is incompatible with SSR, reloads, shared URLs, and per-tab provenance.
2. Reverse the existing `s_*` Reader parameters. This is stateless, but those
   parameters intentionally omit arbitrary source keys, `avancerad`, `fuzzy`,
   and the raw query representation, so it cannot restore the exact source.
3. Carry the validated source full path in the generated Reader link. This is
   the selected approach because provenance remains explicit, reload-safe,
   per-navigation, and compatible with Nuxt history while preserving the
   complete source query.

The reload-safe behavior is a deliberate architectural correction to the
legacy session-memory defect. Visible behavior and copy remain unchanged.

## Search-origin contract

`text-search.ts` owns two pure functions:

```ts
attachTextSearchReturnHref(readerHref: string, searchFullPath: string): string
parseTextSearchReturnHref(query: TextSearchRouteQuery): string | null
```

The attachment function accepts only a bounded relative full path whose
decoded pathname is exactly `/sök`, which has no fragment, backslash, control
character, credentials, host, or pre-existing `s_return` parameter and whose
`fras` value is a valid non-empty search phrase. It appends one encoded
`s_return` parameter to the already validated Reader link. Invalid input leaves
the Reader link unchanged.

The parser accepts exactly one string-valued `s_return`, applies the same
validation, and returns the original relative full path byte representation.
Array values, malformed encoding, recursive origins, non-search paths, absolute
or protocol-relative URLs, fragments, overlong values, and invalid phrases
produce `null`. The maximum source full-path length is 8,192 UTF-16 code units.

The Search page computes the origin from the current client browser pathname
and search string. Reader hrefs remain based on the accepted result payload and
requested semantic state, while the `s_return` value is attached at render
time. A change to an unrelated source query key therefore updates the return
target without refetching search results or leaving a stale origin in cached
view data.

## Reader behavior

The Reader parses `s_return` page-locally and renders a normal `NuxtLink` named
`Tillbaka till sökningen` after `Stäng träffvisningen`, matching the live
legacy ordering. Clicking it performs a push navigation. Browser Back restores
the exact Reader hit URL, hit index, marker, and scroll history.

The return link appears only while the Reader URL still contains an active
search-shaped `q` and `hit` pair plus a valid explicit origin. Closing hit
view removes `q` and `hit`, so the return link disappears even though opaque
origin parameters remain preserved. Reader-local work searches and direct
Reader URLs do not invent an origin and do not show the link.

For a faksimil result carrying a valid explicit origin, Nuxt renders the same
toolkit list with close and return controls without fetching e-text hits. This
restores the navigation handoff while leaving OCR/search-overlay work in its
separate deferred slice.

The existing sidebar row `Sök i författarens texter` becomes a `NuxtLink` to
`/sök?avancerad&forfattare={authorId}`. The author identifier is obtained from
the accepted typed Reader model and encoded by Vue Router. The link uses the
existing list item and inherits all current visual styles.

## Errors and safety

Invalid provenance is ignored rather than surfaced to the user or navigated.
No external URL, redirect, decoded traversal, duplicate origin, or recursive
origin can become a return link. No backend call, composable, store, cookie, or
browser storage is introduced.

## Verification

Pure unit tests cover exact raw-query preservation and every rejected origin
class. Playwright covers a filtered, paginated Search-to-Reader-to-Search flow,
Back restoration, reload durability, unrelated raw query keys, absence for
direct and Reader-local searches, the faksimil return-only toolbar, and the
author-scoped Search link.

The Angular and Nuxt Reader toolkits are compared at the same desktop viewport
with deterministic hit fixtures. The new rows must inherit the existing legacy
markup/CSS with no stylesheet changes or pixel movement outside the additional
authority-owned text row.

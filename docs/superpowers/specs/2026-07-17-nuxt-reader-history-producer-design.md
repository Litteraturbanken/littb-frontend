# Nuxt Reader History Producer Design

**Date:** 2026-07-17

## Goal

Make every successfully hydrated Nuxt Reader page update the existing `/historik`
consumer using the legacy `localStorage.lastPageViews` contract. This is a
behavior-only migration step: it must add no request, server-side side effect,
shared composable, store, or visual change.

## Legacy contract

AngularJS writes a JSON array to `localStorage.lastPageViews`. Each record has
the following exact shape:

```ts
type LastPageView = {
  pageix: number
  pagename: string | undefined
  timestamp: string
  mediatype: "etext" | "faksimil"
  lbworkid: string
  author: string
  label: string
  url: string
}
```

The legacy writer deduplicates by `(lbworkid, mediatype)`, moves the new record
to the front, and retains at most 50 entries. E-text and facsimile records for
the same work are therefore independent. The public Reader route stores its
route author rather than substituting a metadata author, and its resume URL is
the current route URL.

## Chosen design

### Page-local client writer

The Reader page owns one small `writeLastPageView` function in its existing
`<script setup>`. On `onMounted`, after the existing successful `useAsyncData`
boundary, it builds the record entirely from already-normalized Reader data:

- `pageix`: `reader.value.pageIndex`
- `pagename`: `reader.value.pageName`
- `timestamp`: `new Date().toISOString()`
- `mediatype`: `reader.value.mediaType`
- `lbworkid`: `reader.value.workId`
- `author`: the public route's decoded `authorParam`
- `label`: `reader.value.title`, already normalized as short title or full title
- `url`: `route.fullPath`

No writer runs during SSR. No additional request is made, and no backend or
shared model abstraction is introduced.

### Defensive persistence

The writer wraps the complete read/parse/normalize/write operation in
`try/catch`. Missing storage, malformed JSON, a non-array value, blocked storage,
and quota failures must never interrupt a successfully rendered Reader.

A malformed or non-array stored value is treated as an empty history. Valid
object entries are retained without imposing the `/historik` consumer's display
validation; replacement only examines string `lbworkid` and `mediatype` fields.
The current record is prepended, all existing records with the same work/media
key are removed, and `.slice(0, 50)` enforces a strict cap even if legacy data
was already oversized.

This deliberately improves on AngularJS's unsafe exception handling and its
one-item-only oversized-array trim while preserving the externally meaningful
record format, ordering, and deduplication semantics.

## Behavioral verification

Browser tests cover:

1. A fresh successful Reader visit writes all eight fields, an ISO timestamp,
   the decoded route author, and the exact percent-encoded `route.fullPath`
   resume URL produced by Nuxt at runtime.
2. Existing e-text and facsimile records for the same work remain independent;
   only the matching e-text record is replaced and moved to the front.
3. An existing oversized array is normalized to a strict 50-entry cap.
4. Following ordinary next-page navigation updates the same work/media entry
   rather than duplicating it.
5. Malformed JSON, a non-array payload, and throwing `getItem` or `setItem`
   implementations do not produce page errors or break Reader rendering.
6. A failed Reader response leaves existing history unchanged.
7. Reader-to-`/historik` navigation produces the existing visible resume row
   and author-resolution request.

Existing Reader SSR and visual behavior remain unchanged. No visual baseline is
created or updated for this behavior-only slice.

## Explicitly deferred

This slice does not add facsimile rendering, analytics logging, history deletion
or dates, cross-device persistence, consent/deployment policy, a shared history
store, or in-place SPA Reader navigation. When Reader routing becomes reactive
without full page mounts, the fetch and history write must be revisited together.

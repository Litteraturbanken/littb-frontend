# Nuxt Reading History Design

## Goal

Port the existing `/historik` page as a small, read-only Nuxt route without
pulling the deferred Reader into scope. Preserve the current appearance and
valid `lastPageViews` records while replacing the legacy full-author download
with a strict, generated FastAPI v2 contract.

## Scope

The slice owns only:

- `POST /v2/authors/resolve` for resolving the author names needed by history;
- the exact Nuxt route `/historik`;
- safe client-side reading of existing `localStorage.lastPageViews` data;
- deterministic behavior, SSR, and representative desktop/mobile parity tests.

It does not write history, port Reader or Editor routes, add deletion controls,
restore the global `h` shortcut, add new copy, or redesign the page.

## Backend contract

`POST /v2/authors/resolve` accepts a strict body containing 1–50 distinct,
trimmed author IDs. Empty, duplicate, oversized, or extra input is rejected
with the standard v2 validation response.

The provider queries only `authorid`, `full_name`, and `surname`, using an exact
`authorid.raw` terms query and `show_only=False` for legacy parity. The response
is `items: AuthorSummary[]`, ordered like the request. Unknown IDs are omitted.
Malformed, duplicate, or out-of-request provider documents produce the generic
v2 500 response; OpenSearch failures produce the standard typed 503 response.

The endpoint is registered in the canonical v2 OpenAPI snapshot and consumed
through the checked-in generated Nuxt client.

## Nuxt page and data flow

SSR renders the existing shell, title `History | Litteraturbanken`, body classes
`focus page-history ready`, wrapper, and heading `Senast lästa verk`. It makes no
author request because browser storage is unavailable on the server.

After mount, page-local code reads `lastPageViews`, safely parses it, and keeps
the first 50 valid records in storage order. A valid record needs a non-empty
`author`, non-empty `label`, and a safe same-origin path in `url`. URLs with a
scheme, different origin, protocol-relative prefix, backslash, control
character, or invalid syntax are rejected. The page never rewrites or clears
storage and preserves each accepted URL byte-for-byte, including query and
fragment.

The page sends one request containing distinct author IDs. On success it renders
all valid records in their original order. Unknown authors keep their row with
blank author text, matching Angular's visible behavior. On request failure the
list stays hidden. Missing, inaccessible, invalid, or empty storage produces
the heading-only page without an API request or visible error.

Fetching and lifecycle handling stay inside `<script setup>`; no one-use
composable is added. Links are ordinary `<a>` elements because Reader and Editor
destinations are not yet Nuxt-owned.

## Visual contract

Reuse the existing Angular markup and copied global styles without new page
styling. The body class activates the existing `.page-history` logo rule.

Capture one populated Angular authority at desktop and mobile widths using
deterministic storage and author data. The records include two media types for
one work and a long title so ordering, wrapping, and link text are visible.
Compare Nuxt against those two baselines with the repository's normal exact
visual matcher. Empty, invalid-storage, partial-author, and request-failure
states are behavioral tests rather than additional screenshot matrices.

## Verification boundary

Backend tests cover strict models, exact provider selection/querying,
request-order transformation, unknown/malformed data, endpoint serialization,
errors, and OpenAPI generation. Frontend tests cover the fixture operation,
zero-request SSR/empty storage, safe filtering, one request, preserved row/link
order, blank unknown authors, failure/unmount handling, no storage mutation, and
desktop/mobile parity.

This intentionally small slice is complete when valid existing history renders
with Angular visual parity and no Reader, full-author-catalog, or unrelated page
work has entered the diff.

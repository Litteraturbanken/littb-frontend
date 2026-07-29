# Nuxt Library filtered-result parity and staging task design

**Date:** 2026-07-29

## Goal and authority

Restore the remaining filtered Library behavior visible at
`/bibliotek?filter=strindberg` without changing the design, while keeping the
Nuxt frontend on its typed FastAPI V2 boundary. The Angular Library controller
and templates remain the behavioral and visual authority. The deployed red
site is comparison evidence; the V2 models and generated TypeScript schema are
the contract authority after this change.

This slice also adds an explicit Invoke staging task. Adding the task does not
authorize or trigger a deployment. Backend or frontend staging deployment must
not run until the user asks for it.

## Library modes are distinct

The ordinary Library and source-material download workflow must not be
conflated:

- `nedladdning=1` is the specialist bulk/source-export workflow. It forces the
  Works view, adds work selection and format export controls, and retains the
  existing source-material semantics.
- EPUB and PDF are ordinary Library tabs. They are available from the normal
  `/bibliotek` experience without any flag and show downloadable works in the
  selected format.
- `/epub` remains the standalone download-oriented shell that reuses the same
  typed EPUB/PDF result ownership. It is not the `nedladdning=1` bulk workflow.

On every committed ordinary Library filter change, Works, Parts, Authors,
EPUB, and PDF summaries are refreshed for the same immutable filter identity.
The active result request remains independently owned. Selecting EPUB or PDF
fetches that tab's rows whether or not `nedladdning` is present. Inactive count
requests must never replace active rows or surface their failure as an active
result error.

For the authority query `filter=strindberg`, the V2 count API already reports
136 EPUB works and 265 PDF works. The missing labels are therefore a frontend
orchestration defect, not empty backend data.

## Author-result semantics

The Authors tab is not the unfiltered union of everybody attached to a work or
part that happened to match the free-text query. It is the eligible author
union after applying the legacy author-name filtering behavior.

The backend continues to derive the eligible population from the distinct
authors attached to matching Works and Parts, then joins those identifiers to
author documents. When a free-text query exists, the joined authors are
filtered against their full name and pseudonym names. Query tokens use the
legacy matching rule: each token is compared case-insensitively through both
the existing normalized-author spelling and Scandinavian `æ/ø` folding, and
an author is retained when at least one query token matches. Gender and the
other advanced predicates continue to constrain the eligible Works and Parts
before the author union is built.

The filtered list is deduplicated by author ID before sorting and limiting.
`total_authors` describes the filtered, deduplicated list, not the pre-filter
eligible union. For `filter=strindberg`, both the Authors tab label and the
Authors view must report the seven legacy-authority matches rather than 120.

## Unknown lifespan values

The search index uses numeric zero as an unknown-year sentinel in some author
documents. Zero is not a historical year and must not escape through the V2
contract.

The backend normalizer converts non-positive birth and death values to `null`.
The Pydantic model expresses known author years as positive integers. The Nuxt
view model also treats non-positive values defensively as absent so a stale or
older backend cannot render `0–0` or `0–`. A lifespan is blank when both values
are unknown and preserves an open range only when one real value is known.

## Typed and safe relevance highlights

OpenSearch already returns relevance highlight fragments, but the current V2
search envelope drops hit metadata before item normalization. Returning raw
trusted HTML to Vue would recover the old appearance at the cost of an unsafe
and weakly typed boundary, so V2 will expose structured highlight data instead.

Each mixed-result item has an ordered list of highlight fragments. A fragment
contains ordered segments, and every segment contains plain text plus a
boolean indicating whether it is a hit. The backend recognizes only the
OpenSearch emphasis marker, strips or converts all other markup to text, and
selects the legacy-authority fields appropriate to each result kind and in the
same display order. No arbitrary tag, attribute, URL, event handler, or style
crosses the API.

Nuxt renders segment text normally and wraps hit segments in
`<em class="hit">`. Fragments retain the legacy surrounding quotation and
ellipsis presentation. This avoids `v-html`, makes the generated TypeScript
contract statically analyzable, and preserves the visible highlight behavior.
Malformed highlight metadata omits only the malformed fragment; it does not
discard an otherwise valid result row.

## Request ownership and failure behavior

All summary and active-row requests use the existing latest-intent and abort
discipline. A response may commit only when its complete filter identity still
matches the route-owned state. Back, Forward, SSR, and reload reconstruct the
same filters and selected mode.

An unavailable inactive count leaves that tab's count unlabeled but does not
disable unrelated results. A malformed active response retains the existing
closed error state. No count is inferred from an unrelated response, and the
Authors label is never reconstructed from raw Works/Parts author-ID counts on
the client.

## Invoke staging task

The frontend `tasks.py` gains a root `stage` task. When explicitly invoked, it
runs the existing backend staging script first and the existing frontend
staging script second:

```text
/Users/johan/dev/lb-backend/scripts/deploy-stage.sh <backend-ref>
<frontend-root>/scripts/deploy-stage.sh <frontend-ref>
```

Both refs default to `HEAD` and can be overridden independently. The task uses
the configured `LB_BACKEND_DIR`, validates that both scripts exist, and stops
immediately if backend deployment fails. It does not duplicate Git, image,
Nomad, cleanliness, or health logic owned by those scripts. The task has no
default collection behavior and cannot run as a side effect of quality,
code-generation, development-server, or test tasks.

The task will be exercised only with command discovery/help or unit-level
command construction during this implementation. It will not be invoked
against staging until the user gives a separate deployment instruction.

## Test strategy and completion evidence

Strict TDD covers the behavior at the owning boundary:

1. Backend model/provider/API tests prove positive-or-null years, seven filtered
   Strindberg authors, pseudonym and Scandinavian matching, typed highlight
   segmentation, field ordering, malformed metadata handling, and unchanged
   result-row normalization.
2. OpenAPI regeneration and the frontend contract compile test prove the new
   highlight structure and lifespan constraints flow into generated
   TypeScript.
3. Frontend unit tests prove year formatting and safe structured highlight
   mapping without `v-html`.
4. SSR tests prove ordinary `/bibliotek?filter=strindberg` labels Authors,
   EPUB, and PDF from their own typed responses and renders hit emphasis.
5. Browser tests prove filter changes refresh all summaries, EPUB/PDF tabs open
   without `nedladdning`, tab switches fetch and render rows, stale counts
   cannot win, Authors contains seven matching entries, and unknown lifespans
   are blank.
6. The focused Library quality gate, frontend lint/typecheck, backend V2 checks,
   and production build pass.
7. Fresh browser comparison against the red authority confirms copy, count
   labels, author rows, and highlight presentation.

Completion of the code and tests is not permission to deploy. Staging remains
unchanged until the user explicitly requests `invoke stage` or an equivalent
deployment action.

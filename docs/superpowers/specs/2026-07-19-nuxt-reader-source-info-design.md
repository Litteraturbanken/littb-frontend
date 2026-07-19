# Nuxt Reader Source Information Design

**Date:** 2026-07-19

**Status:** Auto-approved under the active full-site Nuxt migration goal.

## Goal

Restore the Reader's legacy “Om boken” experience and all public book-info
aliases without changing its appearance. The implementation must replace the
untyped Angular `/get_work_info` dependency with a strict FastAPI v2 contract,
generate the Nuxt client from OpenAPI, keep page-only data fetching inside the
canonical Reader page's `<script setup>`, and render the existing source-info
layout in a Headless UI dialog.

This slice owns:

- `/författare/:author/titlar/:title`;
- `/författare/:author/titlar/:title/info`;
- `/författare/:author/titlar/:title/info/:mediatype`;
- direct canonical or shorthand Reader URLs containing bare `?om-boken`;
- the Reader title, sidebar “Mer om boken”/“Mer om pjäsen”, and `o`/F18
  entrances;
- the complete normal-work and Dramawebben source-information body; and
- exact Angular dialog/query/history/focus/visual behavior.

Similar-work recommendations remain excluded because the Reader metadata
request intentionally excludes `content_vector`. Download analytics remain
excluded in local development, matching current Angular development behavior.

## Authority and current gap

Angular route ownership is in `app/scripts/app.js`. The bare-title and `/info`
routes resolve the first viable representation and replace history with the
canonical start-page Reader plus a bare `om-boken` query key. The media-specific
alias first chooses the requested representation, then uses the same canonical
resolver. Incoming query state is discarded on all three aliases.

The dialog authority is:

- `app/scripts/components/reader/reading_controller.js` for URL ownership,
  metadata, keyboard actions, and close behavior;
- `app/scripts/components/reader/reader.html` for title/sidebar entrances and
  modal chrome;
- `app/views/sourceInfo.html` for content order and exact Swedish copy;
- `app/styles/_modals.scss` plus Bootstrap modal rules for layout; and
- `test/e2e/playwright_e2e.spec.js` for the approximately 600px desktop dialog,
  visible shadow, and error-free source-info rendering.

Nuxt already resolves shorthand e-text/faksimil routes and renders the canonical
Reader, contents dialog, page/part navigation, and copied legacy modal styles.
It does not own the three aliases, does not interpret `om-boken`, exposes no
source-information DTO, and leaves its title and “Mer om boken” row inert.

## Chosen architecture

### Typed FastAPI source-information projection

Add one synchronous operation:

```text
GET /v2/works/{author_id}/{title_path}/source-info?media_type=etext|faksimil
```

`media_type` is optional. `(author_id, title_path)` is not unique in production,
so selection reproduces Angular's grouping precisely: preserve raw provider
insertion order of `(title_path, work_id)` groups; within each group put the
requested media first when present, then use `etext`, `faksimil`, `pdf`,
`infopost`; select the first group-main matching the request, or the first
group-main when the requested media is absent. With no media request, select the
first raw group and its standard-order main. The response identifies the
selected media and the selected representation's canonical first/main author
so every alias can redirect to a canonical Reader route that Nuxt will accept.
Using the canonical selected author instead of retaining an ambiguous editor
lookup ID is a deliberate routing repair for strict Reader identity.

The provider extends the neutral `elasticapi.get_work_by_titlepath` helper to
accept explicit source includes/excludes, then calls it once by author/title. It
must never return raw
OpenSearch records, `content_vector`, page text, page maps, parts, or unrelated
metadata. It validates the complete provider container before normalization and
maps provider unavailability to the standard non-leaking `503`, absent work to
`404`, invalid request to `422`, and malformed provider data to the standard
non-leaking `500`.

The strict recursive response contains:

- selected `work_id`, canonical selected `author_id`, `title_path`, `media_type`,
  start page, full title, short title, and text type;
- ordered public authors with IDs, names, surnames, role/type, and safe author
  URLs;
- normalized source-description HTML plus an optional attribution ID;
- normalized work-introduction HTML plus an optional attribution ID;
- imprint display text, URN, Libris ID, license key, and provenance entries;
- a small/large cover source pair derived from the selected work ID;
- ordered read actions for e-text/faksimil and ordered download actions for
  EPUB/PDF, including label, safe URL, safe filename, and optional byte size.
  Each action uses that representation's legacy main-author precedence
  (`work_authors`, then `authors`, then `main_author`) and title ID. Direct PDF
  actions never expose a size; only derived export actions do;
- structured errata rows rather than the raw provider table; and
- optional strict Dramawebben facts, roles, and history HTML. The top-level work
  introduction remains separate; do not invent `dramawebben.workintro`.

All strings and collections have explicit bounds above observed production
values. DTOs inherit the existing `V2Model` extra-field rejection. Every field
is required, using `null` or an empty collection when legitimately absent, so
OpenAPI code generation produces no ambiguous optional transport shape.

Editorial HTML remains marked as HTML in field names but is not trusted by the
browser. The backend validates type, size, and container structure; the Nuxt
server performs the final allowlist sanitization because it owns rendered DOM.
Errata table parsing belongs in the backend normalization because it converts a
legacy string field into typed data.

### Generated client and thin Nitro boundary

Export the checked backend `openapi/v2.json` and regenerate
`nuxt/app/lib/api/generated/lbapi.ts` from that file. The Nuxt server handler
uses only the existing client wrapper around the generated contract
for the FastAPI request; no handwritten duplicate transport type is allowed.

Add:

```text
GET /api/reader/source-info/{author}/{title}?media_type=...
```

The Nitro handler:

1. validates exact path/query segments;
2. calls the generated source-info operation;
3. strictly checks the runtime 200 payload despite generated compile-time
   types;
4. fetches the existing runtime resources
   `/red/etc/provenance/provenance.json` and
   `/red/etc/license/license.json` from `runtimeConfig.contentBase`;
5. resolves attribution IDs through the existing typed author resolver in one
   bounded call when the IDs are not already represented by work authors;
6. sanitizes source description, introduction, drama roles/history, errata
   cell HTML, and license HTML with a source-info-specific allowlist;
7. rewrites only known provenance image paths to local `/red/...` public URLs;
   and
8. returns a frontend `ReaderSourceInfo` DTO whose URLs and HTML are safe to
   render directly.

Static metadata is cached by Nuxt server fetch semantics with a bounded
revalidation interval, but it is still fetched from the runtime source rather
than copied or hard-coded. Transport-level, malformed, or oversized static data
is a modal-local `502`; it must never take down the base Reader. A well-formed
unknown provenance or license key follows Angular's degradation behavior:
unknown provenance rows are skipped and an unknown license renders no license
block without discarding the rest of the source information.

The sanitizer accepts the minimal legacy source-info vocabulary: paragraphs,
line breaks, headings, emphasis, strong text, links with safe protocols,
small inline spans/classes from known editorial data, lists, tables,
sup/subscript, and allowlisted license/history images. License handling unwraps
the legacy `<text>` container, interpolates `{{provenance}}` with the resolved
provenance links, and rewrites every relative license image to
`/red/bilder/gemensamt/{filename}`. It removes scripts, style/event attributes,
unsafe URLs, iframes/objects, forms, and unknown elements. Links gain safe
external-link attributes where required. Plain text stays escaped.

### Page-local SSR fetch and query ownership

The canonical Reader page remains the model owner. It unconditionally creates
one page-local `useAsyncData` instance inside `<script setup>`, with immediate
execution enabled only when the initial raw query requests `om-boken`. A later
client open executes that same instance on demand. No composable, Pinia store, global
middleware model, or source-info fetch is added to a closed Reader.

Accepted modal state matches Angular's parse/truthiness semantics: a bare key
opens the dialog; an exact empty assignment (`om-boken=`) is false; every
nonempty string value, including `false` and `1`, is true; and every repeated-key
array is truthy. Matching is based on decoded key identity while every unrelated
raw query segment, order, encoding, and fragment remains byte-for-byte unchanged.

Opening and closing use `router.replace`, never push. Opening adds exactly one
bare `om-boken`; closing removes every exact `om-boken` segment and preserves
all other bytes. Back therefore returns to the page preceding the Reader rather
than an intermediate modal state. External query removal closes the dialog;
Back/Forward query restoration reopens it.

`om-boken` and `innehall` are transient Reader UI keys. Both are excluded from
the Reader search-hit request identity and Reader history identity. Opening or
closing either dialog must not refetch the base Reader, refetch search hits, or
write a `lastPageViews` entry.

Source-info failure is contained inside the open dialog and displays the exact
legacy error copy, “Ett fel har uppstått.” The base Reader remains rendered and
fully usable. Direct SSR `?om-boken` returns a 200 Reader even if supplementary
metadata fails.

### Alias resolution

Add a media-optional resolver endpoint next to the current media-specific Nitro
resolver. It calls the typed source-info endpoint only to obtain the selected
representation and canonical start page. The three Nuxt alias pages use that
resolver and return history-replacing redirects to:

```text
/författare/{canonical-selected-author}/titlar/{title}/sida/{start}/{media}?om-boken
```

All incoming query and fragment state is discarded. Unsafe/missing identity is
`404`; upstream absence is `404`; invalid upstream shape is `502`. The
media-specific alias retains legacy fallback behavior rather than the stricter
Reader shorthand 404 policy.

## Headless UI dialog and exact content

Add presentation-only `ReaderSourceInfoDialog.vue` using Headless UI `Dialog`,
`DialogPanel`, and `DialogTitle`, following the existing contents dialog's focus
and transition pattern. It uses the existing `.modal.about`, `.modal-dialog`,
`.modal-content`, `.modal-body`, and `.about-modal` classes. The only CSS bridge
permitted is the same activation/positioning bridge already used for chapters;
copied legacy values are not redesigned.

The rendered order and copy remain the `sourceInfo.html` authority:

1. loading or modal-local error;
2. linked author heading and full title;
3. source description and attribution;
4. “Läs som …” actions;
5. “Ladda ner …” actions with optional sizes;
6. Libris and expandable URN help. Preserve the current Angular quirk that the
   Dramawebben logo is hidden because the template checks the absent nested
   `dramawebben.workintro` field;
7. 200px cover with small/large `srcset`;
8. top-level drama introduction, facts, roles, and history. Preserve the current
   hidden “Handling” header for the same absent nested-field check;
9. provenance blocks and license HTML;
10. e-text errata, initially eight rows and “Visa fler”/“Visa färre”. Angular
    normalizes missing errata to a truthy empty array, so its intended typo copy
    “Inga ändringar har gjorts mot orginalet.” is normally hidden; preserve that
    actual rendered behavior.

The Reader title and sidebar entry are real links so SSR/no-JavaScript behavior
still reaches canonical `?om-boken`. Drama copy is “Mer om pjäsen”. Keyboard
`o` and F18 call the same replace helper unless an editable control or another
dialog owns focus. Close button, Escape, backdrop, external query removal, and
dialog action all remove only the modal key. Focus returns to the invoking
control after close where Headless UI can identify it.

While either Reader dialog is open, body receives `modal-open` and the three
Reader corridors receive the copied 4px blur. Direct URLs can contain both
dialog keys in Angular and create stacked independent modals. Headless UI cannot
safely maintain two simultaneous focus traps, so Nuxt deliberately gives source
information presentation priority while retaining both raw keys; closing it
reveals contents without rewriting the other key. Ordinary triggers remove the
other dialog key in the same replace. This is an intentional accessibility
recommendation, not a claim of exact Angular stacking behavior.

## Visual invariants

No redesign is allowed. Deterministic Angular and Nuxt captures must prove:

- desktop dialog width remains 590–610px, top offset 5%, maximum height 90%,
  white square-corner content, Bootstrap border/shadow, and translucent white
  backdrop;
- mobile retains automatic near-viewport width and the legacy stacked/flexible
  content behavior;
- inner padding, header width, typography, 200px cover, source-description
  indentation, media-action small caps, provenance flex rows, drama tables,
  license, errata, close button, blur, and scroll behavior match;
- the closed Reader is pixel-identical before and after this slice; and
- normal Doktor Glas and Dramawebben fixtures cover both content variants.

Visual tests compare at identical viewport sizes and font readiness. Any
difference outside dynamic content must be explained and reduced to the Angular
authority before approval.

## Failure, security, and performance contracts

- Unsafe path segments, URLs, filenames, HTML, malformed static JSON, oversized
  values, duplicate identity, and extra keys fail closed without leaking raw
  provider details.
- The base Reader metadata/page request remains one request per canonical page.
- A direct open modal adds one source-info request, one provenance request, one
  license request, and at most one bounded author-resolution request.
- Opening an already loaded modal, closing it, or navigating Back/Forward within
  the same mounted page does not repeat source-info or static-data requests.
- Closed Reader navigation never fetches source info.
- Alias resolution performs one typed source-info lookup and then one ordinary
  canonical Reader load after redirect.
- The generated OpenAPI file and client must be drift-clean in both repositories.

## Acceptance evidence

Completion of this slice requires:

- strict backend model/provider/API/OpenAPI tests, including normal, drama,
  sparse, malformed, missing-media, and unavailable-provider cases;
- generated-client drift checks;
- Nitro runtime-validation, sanitization, static-resource, and query-helper
  unit tests;
- SSR tests for all aliases and direct open/error containment;
- browser tests for every entrance/exit, query byte preservation, history,
  focus, keyboard, request ledger, errata expansion, and normal/drama content;
- identical closed Reader screenshots plus reviewed desktop/mobile open-dialog
  comparisons against Angular; and
- live 3020 checks using the patched 8010 backend with no hydration, console,
  or failed-request errors.

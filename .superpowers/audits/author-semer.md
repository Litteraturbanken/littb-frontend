# Migration audit: `/författare/:author/semer`

Date: 2026-07-19
Scope: read-only audit of the Angular authority and the current Nuxt worktree. No tracked files were changed.

## Executive conclusion

`/författare/:author/semer` is a real managed-author-document route, not the Nuxt `/mer` works listing. Angular renders an ordinary author shell and injects the `<body>` from `/red/forfattare/{authorid_norm}/semer/index.html`. The repository's live presentation index contains five inbound links, and all five corresponding managed XHTML documents returned HTTP 200 in a read-only check on 2026-07-19. The public application URL returned 502 during that same check, so the content is live and linked even though the currently deployed route was unavailable at that moment.

Nuxt does not support the route. Its dynamic author-document page recognizes only `presentation | bibliografi`; therefore `/författare/:author/semer` is rejected as a 404. Legacy `/forfattare/{normalized}/semer` links first receive the existing 307 normalized-ID redirect and then arrive at that 404.

The smallest parity-preserving slice is to extend the existing typed author-document family with the literal kind `semer`, not to build a separate page or to reuse `/mer`. This requires the upstream v2 descriptor enum to accept `semer`, regeneration of the TypeScript client, narrow allow-list changes in the existing Nitro/page/types, and one real frozen semer fixture plus deterministic SSR/behavior/visual coverage. The page must retain its single page-local fetch. No composable and no Headless UI primitive are warranted.

## Angular authority

### Route, controller, and template

- Route registration: `app/scripts/app.js:462-480` includes the exact literal `/författare/:author/semer`, assigns `pageId: "authorInfo"`, renders `<author-info-page>`, and uses `authorResolve`.
- Same-author transitions: `app/scripts/app.js:82-103` rejects a full reload when both routes are `authorInfo` for the same author. The existing controller handles the route change in place.
- Controller/component: `app/scripts/components/author-info-page/index.js:10-39` and `:369-372` define `AuthorInfoPageCtrl` and bind it to `app/views/authorInfo.html`.
- Route interpretation: `app/scripts/components/author-info-page/index.js:141-156` takes path segment 3 as `showpage`; `semer` remains `semer`, and its page title is exactly `Mera om`.
- Managed HTML request: `app/scripts/components/author-info-page/index.js:174-219` fetches a complete document, slices from the first `<body>` through `</body>`, and for ordinary authors constructs `/red/forfattare/${authorInfo.authorid_norm}/${page}/index.html`. Thus the exact semer request is:

  ```text
  GET /red/forfattare/{authorid_norm}/semer/index.html
  ```

- The separate compatibility alias `/författare/:author/mer` is rewritten to `semer` only for that otherwise-unused external-document fetch (`app/scripts/components/author-info-page/index.js:203-205`). Its visible content is still the typed works/about-author listing (`app/views/authorInfo.html:235-249`). `/mer` and `/semer` must not be conflated.
- Rendering surface: `app/views/authorInfo.html:1-28` supplies metadata, ordinary background, loader/error, outer author `<h1>`, and top links. The default switch branch at `app/views/authorInfo.html:253-256` injects the fetched body into exactly `.page_content > .content.unbox`.
- Footnote behavior: the default container attaches `footnote-popup`, but link harvesting is only performed for `omtexterna` (`app/scripts/components/author-info-page/index.js:209-216,221-226`). The five audited semer documents have no footnote markup, so semer has no actual popup interaction to port. The generic Angular directive is at `app/scripts/directives.js:650-704`.

### Exact legacy request ledger

The shared Angular controller eagerly does far more work than semer needs:

- one author record: `GET /api/get_author/{author}` (`app/scripts/services/backend.js:738-763`);
- one global author-list request used by the shared template;
- ten works/about-author requests initialized at `app/scripts/components/author-info-page/index.js:252-303,317-353`, implemented by `getTextByAuthor` and `getPartsInOthersWorks` at `app/scripts/services/backend.js:765-806`;
- one Litteraturkartan query (`app/scripts/components/author-info-page/index.js:56`; `app/scripts/services/backend.js:244-260`);
- one WordPress audio-page probe (`app/scripts/components/author-info-page/index.js:313-315`; `app/scripts/services/backend.js:1089-1097`);
- one managed semer XHTML request after the author response resolves (`app/scripts/components/author-info-page/index.js:306-315` plus `:186-219`).

The deterministic Angular document capture proves the exact cardinality: one author, one author-list, ten work calls, one audio call, one map call, and one managed content request (`nuxt/test/visual/capture-author-documents-angular.spec.ts:80-88,111-148,203-218`). These work/map/global-list calls are incidental coupling from the shared Angular controller, not data required to render semer. Nuxt should preserve the resulting visible shell and document, not copy that request fan-out.

### Exact visual surface

The route uses the ordinary author presentation:

- `<html>` background `forf2_bkg.jpg` and body classes `focus page-authorInfo ready` (`app/views/authorInfo.html:3-5`; analogous Nuxt head setup at `nuxt/app/pages/författare/[author]/[document].vue:173-176`);
- outer author name/lifespan heading (`app/views/authorInfo.html:10`);
- conditional top navigation in this order: `Introduktion`, `Verk`, `Ljud`, `Dramawebben`, `Sök i texterna`; the current semer tab itself is not shown and no link is marked active (`app/views/authorInfo.html:13-26`);
- fetched body inside `.page_content > .content.unbox`, with the XHTML's own headings, prose, images, and ordinary links intact (`app/views/authorInfo.html:253-256`). Duplicate author headings in rich semer bodies are authority behavior and must not be deduplicated.

Existing copied CSS already owns the appearance: `.page-authorInfo` and preloader/background/content rules at `nuxt/app/assets/styles/styles.scss:1964-2012`, author year/content at `:2075-2082`, inline-block page content at `:2163-2168`, and author top links at `:2207-2212`. Mobile removes the author background at the corresponding legacy rule `app/styles/_mobile.scss:323-325`. No new semer-specific styles were found.

The live linked corpus shows the following concrete surfaces (read-only HTTP checks on 2026-07-19; no semer XHTML fixture currently exists locally):

1. `AlmqvistCJL`: a second author `<h1>`, `Mera om och av författaren`, portrait, long illustrated editorial text, normalized legacy author/reader links, thumbnail images, and multiple PDF links. The XHTML response was 9,115 bytes.
2. `BellmanCM`: heading and explanatory text followed by Swedish, English, and German sections with six MP3 links and music-symbol images. Response: 3,111 bytes.
3. `Birgitta`: explanatory text and four very large plansch-PDF links. Response: 1,602 bytes.
4. `EhrensvardCA`: explanatory text and two ZIP-download links. Response: 1,232 bytes.
5. `SodergranE`: duplicate author headings, prose, and three large photographs linked to full images. Response: 2,853 bytes.

The managed head stylesheet (for example `/red/css/red.css`) is discarded by Angular's body slice. Nuxt must likewise render the body with existing site CSS rather than load the managed document's `<head>`.

## Is it live and where is it linked?

Yes, as managed content and as an inbound destination:

- The frozen presentation index contains five `/forfattare/{normalized}/semer` links at `nuxt/test/fixtures/presentation-content/presentationerForfattare.html:152,166,173,184,248` for Almqvist, Bellman, Birgitta, Ehrensvärd, and Södergran.
- That fixture is a local snapshot of the same live file fetched by the Nuxt Presentationer index (`nuxt/app/pages/presentationer/[...segments].vue:38-59,77-92`). Its parser preserves root-relative hrefs (`nuxt/app/pages/presentationer/presentation-parser.ts:82-97,110-143`).
- The live `presentationerForfattare.html` still contained those same five links on 2026-07-19.
- All five `/red/forfattare/{normalized}/semer/index.html` sources returned `200 text/html` on 2026-07-19.
- Both `https://litteraturbanken.se/författare/AlmqvistCJL/semer` and the unaccented variant returned 502 during the spot check. Treat this as a dated deployment observation, not evidence that the linked corpus is obsolete.
- There is intentionally no semer link in the ordinary author top navigation or profile side panel: the relevant candidates are commented out or point to `/mer`, presentation, and bibliography (`app/views/authorInfo.html:17-22,84-104`). Therefore the Presentationer index is the repository-visible entry point.

## Current Nuxt behavior and contract gap

### Route behavior

- Nuxt's only matching file is `nuxt/app/pages/författare/[author]/[document].vue`.
- `isDocumentKind` accepts only `presentation` and `bibliografi` (`:29-31`), and route validation rejects anything else (`:101-110`). `/författare/:author/semer` therefore resolves to a Nuxt 404 before its page fetch runs.
- The local Nitro adapter also accepts only those two kinds (`nuxt/server/api/author-documents/[author]/[document].get.ts:21-34`). A direct `/api/author-documents/{author}/semer` call returns the local document-not-found 404.
- The shared TypeScript model is restricted to those two literals (`nuxt/shared/types/author-document.ts:1-21`).
- The generated v2 client and descriptor schema also restrict `document_kind` to `presentation | bibliografi` (`nuxt/app/lib/api/generated/lbapi.ts:285-310,1079-1098`). This generated file must not be hand-edited; `nuxt/package.json:24-25` defines generation/drift commands.
- The managed source validator computes an exact `/red/forfattare/{normalized}/{kind}/index.html` path and validates descriptor identity before fetching (`nuxt/server/utils/author-document.ts:104-157,289-343`), but its runtime descriptor guard also excludes semer (`:127-142`).
- Legacy inbound links are already normalized safely: `nuxt/server/middleware/legacy-author-route.ts:29-52` catches GET/HEAD `/forfattare/**`, resolves normalized IDs privately, preserves the suffix/query, and returns 307. It needs no semer-specific route logic; once the literal kind is accepted, the redirected destination will work.

### Existing typed contract to extend

Current request:

```text
GET /v2/authors/{author_id}/documents/{document_kind}
document_kind = "presentation" | "bibliografi"
```

Current descriptor shape, exemplified locally by `nuxt/test/fixtures/author-document-data.mjs:5-32`:

```json
{
  "author_id": "SöderbergH",
  "normalized_author_id": "SoderbergH",
  "full_name": "Hjalmar Söderberg",
  "birth_year": "1869",
  "death_year": "1941",
  "has_introduction": true,
  "has_dramawebben": false,
  "search_url": "/sok?forfattare=S%C3%B6derbergH&avancerad",
  "audio_url": "https://litteraturbanken.se/ljudochbild/författare/soderbergh",
  "document_kind": "presentation",
  "source_path": "/red/forfattare/SoderbergH/presentation/index.html"
}
```

Required semer example (same contract, one new enum literal):

```http
GET /v2/authors/AlmqvistCJL/documents/semer
```

```json
{
  "author_id": "AlmqvistCJL",
  "normalized_author_id": "AlmqvistCJL",
  "full_name": "Carl Jonas Love Almqvist",
  "birth_year": "1793",
  "death_year": "1866",
  "has_introduction": true,
  "has_dramawebben": false,
  "search_url": "/sok?forfattare=AlmqvistCJL&avancerad",
  "audio_url": null,
  "document_kind": "semer",
  "source_path": "/red/forfattare/AlmqvistCJL/semer/index.html"
}
```

The exact optional shell values must come from the backend author record/audio probe; the illustrative years/navigation above must be confirmed when freezing the fixture. The content request remains:

```http
GET {server-only contentBase}/red/forfattare/AlmqvistCJL/semer/index.html
Accept: text/html
```

Nitro should return the existing `AuthorSupplementalPage` shape with `documentKind: "semer"` and `bodyHtml` containing the sanitized real `<body>`. The local comparable sparse response is asserted at `nuxt/test/ssr/author-documents-api.spec.ts:113-130`; the exact two-request private ledger is asserted at `:185-202`.

## SSR and security risks

1. **Raw managed HTML / XSS.** `v-html` is required for real editorial content, but the source cannot enter the hydration payload unsanitized. Reuse the existing server-only parse/sanitize boundary (`nuxt/server/utils/author-document.ts:37-76,179-256`), which strips scripts/forms/active subtrees, unsafe attributes/URLs, and adds `noopener noreferrer` to `_blank` links.
2. **SSRF and descriptor confusion.** Do not let the route or descriptor select an origin. Preserve exact descriptor identity and exact source-path equality before joining the server-only `contentBase` (`nuxt/server/utils/author-document.ts:104-157,289-343`; configuration at `nuxt/nuxt.config.ts:38-47`). Extend only the literal-kind allow-list.
3. **Hydration duplication.** The page must continue using one page-local `useAsyncData` request to the same-origin Nitro endpoint (`nuxt/app/pages/författare/[author]/[document].vue:65-99,113-151`). The SSR result must be serialized and accepted by identity, with zero browser refetch after hydration.
4. **Stale client navigation.** Keep the `kind:author` identity, clearing `accepted` synchronously and accepting only matching data (`nuxt/app/pages/författare/[author]/[document].vue:125-151`). Add semer transitions to the existing delayed-response test pattern (`nuxt/test/e2e/author-documents.behavior.spec.ts:56-100`).
5. **Status correctness.** Preserve 404 for missing author/source and 502 for provider/content/malformed failures; do not SSR a 200 placeholder. Current mapping is at `nuxt/server/utils/author-document.ts:259-267,307-343` and page status propagation at `nuxt/app/pages/författare/[author]/[document].vue:153-155,185-199`.
6. **Legacy internal links and binary assets.** Preserve safe `/forfattare/**`, `/red/**`, image, MP3, PDF, and ZIP href/src values. The legacy resolver already handles normalized author/reader routes. Do not replace real media with placeholders. Tests should exercise at least one normalized reader link, one profile link, one image, one MP3, one PDF, and one ZIP from frozen real bodies.
7. **Corpus oddities are authority behavior.** Some semer bodies contain duplicate headings, explicit large image dimensions, and stale hashbang or image hrefs. Do not silently redesign or normalize them in a semer-only page. Security sanitization is the only justified transformation; capture any visible delta against Angular.

## Smallest parity-preserving Nuxt slice

1. **Backend dependency (blocking):** extend upstream `AuthorDocumentKind` to `"presentation" | "bibliografi" | "semer"`; keep the same author lookup, audio/search/navigation fields, source-path construction, errors, and no flag gate. Add provider/model/route/OpenAPI tests and regenerate the client. The FastAPI source is not present in this worktree, so this cannot be completed frontend-only without abandoning the existing typed trust boundary.
2. **Typed allow-list extension:** add `semer` to `AuthorDocumentKind`, page validation/runtime validation, Nitro endpoint kind validation, descriptor guard, and generated API types. Generalize page label to exact `Mera om`; SEO becomes `{fullName}, Mera om | Litteraturbanken` as Angular's `getPageTitle` requires.
3. **Keep the existing page-local fetch:** extend `nuxt/app/pages/författare/[author]/[document].vue`; do not create a semer composable or a second page model. Continue fetching only `/api/author-documents/{author}/semer` and render only real returned `bodyHtml`.
4. **Freeze a real authority case:** add at least `AlmqvistCJL-semer.html` (richest surface) plus a typed descriptor and provenance hash. Prefer additional compact Bellman/Birgitta fixtures if binary-link behavior is to be covered without overloading one fixture. Never use invented placeholder body HTML for parity tests.
5. **Extend the existing fixture server and ledgers:** descriptor + exact content source, image/media/PDF/ZIP assets used by selected fixture(s), failure controls, and exact request counts. Existing maps are at `nuxt/test/fixtures/v2-server.mjs:80-112`.
6. **Extend existing tests and Angular capture:** add semer to `capture-author-documents-angular.spec.ts` cases, SSR API/page cases, e2e hydration/transition/native-link tests, and desktop/mobile visual cases. Reuse the existing `.page-authorInfo` DOM; add no semer styles unless the Angular baseline proves a missing rule.
7. **No Headless UI:** semer contains only normal anchors/downloads/media and static HTML. There is no menu, dialog, disclosure, listbox, or other custom interaction. If a later corpus audit finds real footnotes, scope that as a separate cross-document interaction slice rather than adding an unused component now.

## Recommended deterministic verification

- **Backend/OpenAPI:** enum accepts only the three literals; semer descriptor returns exact normalized ID/source path; missing/hidden author 404; provider failures retain typed 500/503; generated client drift check passes.
- **Unit (`nuxt/test/unit/author-document.spec.ts`):** accept an exact semer descriptor/source and reject wrong-kind, wrong-ID, absolute/protocol-relative, traversal, query/fragment, encoded traversal, controls, and unsafe URL variants. Parse the frozen semer body and assert scripts/styles/forms/event attributes are absent while safe headings, images, dimensions, MP3/PDF/ZIP hrefs, and `_blank` hardening remain.
- **Nitro SSR API (`nuxt/test/ssr/author-documents-api.spec.ts`):** `/api/author-documents/AlmqvistCJL/semer` returns 200 and exactly two private requests (descriptor then exact `/red/.../semer/index.html`); public query/cookies/auth are not forwarded; redirects are blocked; author/content 404 and malformed/unavailable cases map exactly.
- **Page SSR (`nuxt/test/ssr/author-documents.spec.ts`):** status 200; exact title/description `Carl Jonas Love Almqvist, Mera om`; ordinary background/body classes; outer heading + conditional links in authority order; no active semer tab; real body text/images present in `.page_content > .content.unbox`; no script/style/form; exact two-request ledger; 404/502 pages do not leak origins.
- **Browser behavior (`nuxt/test/e2e/author-documents.behavior.spec.ts`):** hydration produces no duplicate requests/warnings; transitions presentation -> semer -> bibliography and back replace metadata/body without stale content; delayed old request cannot overwrite new route; click a normalized `/forfattare/**` reader/profile link; verify real image load and native MP3/PDF/ZIP behavior as applicable.
- **Visual authority:** extend `nuxt/test/visual/capture-author-documents-angular.spec.ts` with a frozen real semer body and exact Angular request ledger; capture desktop/mobile baselines; extend `nuxt/test/e2e/author-documents.visual.spec.ts:5-18`; use the current strict screenshot settings and wait for all real selected assets.
- **Regression gate:** run focused author-document unit/SSR/e2e/visual tests, legacy-author-route SSR tests, then `yarn typecheck`, `yarn build`, `yarn api:check`, and the existing author profile/works tests to prove `/mer` remains a works listing and emits no semer fetch.

## Dependencies and blockers

- **Hard blocker:** the upstream v2 API schema currently excludes `semer`, and that backend repository/source is absent here. The typed descriptor must land before the Nuxt client can be regenerated and the existing strict loader can accept the route.
- **Fixture gap:** there is no local semer XHTML/descriptor/binary fixture or semer visual baseline. Freeze from the live `/red` authority with URL + SHA-256 provenance as existing fixtures do (`nuxt/test/fixtures/author-document-data.mjs:50-61`).
- **Production observation:** the public route returned 502 on 2026-07-19 while all five static sources returned 200. Deterministic migration tests must use frozen authority fixtures, not depend on that live deployment state.
- **No styling or interaction blocker:** copied author CSS, managed-body sanitizer, normalized legacy-link middleware, async identity handling, and the document fixture framework already exist. No Headless UI addition is needed.

## Bounded implementation plan

1. Extend/test the backend `AuthorDocumentKind` enum and descriptor operation for `semer`; regenerate/check OpenAPI.
2. Freeze one rich real semer XHTML document and required assets/descriptor with provenance; extend exact fixture ledgers.
3. Add failing Nuxt unit, Nitro SSR, page SSR, hydration/transition/link, and desktop/mobile authority tests.
4. Make only the literal-kind/label changes in shared type, Nitro validator/descriptor guard, and existing dynamic document page; retain its page-local fetch and SSR status/identity behavior.
5. Run focused tests, capture/compare Angular and Nuxt visuals, then run typecheck/build/API drift and author regression suites.

No new composable, component architecture, route middleware, visual redesign, placeholder content, cache policy, footnote popover, or Headless UI dependency belongs in this slice.

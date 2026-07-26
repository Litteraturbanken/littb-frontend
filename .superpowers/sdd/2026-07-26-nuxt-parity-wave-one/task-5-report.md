# Task 5 report — complete Reader contributor attribution

## Outcome

The public Reader now retains and renders every ordered work-level contributor. The route author remains the first contributor and continues to drive canonical route validation and author-scoped search. Later contributors may have different author IDs.

For the supplied Boye work, all contributor contexts now render:

- Karin Boye, linked to `/författare/BoyeK`;
- the legacy `&` separator;
- Paulina Helgeson, linked to `/författare/HelgesonP`, with the normalized `red.` suffix.

This is shared by the hydrated sidebar, SSR fallback, contents-dialog heading, and work-search heading. Single-contributor works retain their existing output and primary-author behavior.

## Root cause and implementation

`commonMetadata` in `server/utils/reader-source.ts` discarded every `representation.authors` entry after index zero. The shared Reader response therefore had no collection for the UI to render.

The source parser now validates a non-empty, bounded contributor array, validates each contributor ID/name with the Reader's existing string safety rules, normalizes contribution type and role, and returns both the primary `author` and ordered `contributors`. Canonical validation still compares only the primary contributor to the route author.

The Reader API exposes `contributors` and uses all contributors in its description. `ReaderContributors.vue` centralizes legacy links, separators, and suffix markup for all four public Reader contexts.

Library contributor rendering and editor-reader code were not changed.

## TDD evidence

RED was observed before the implementation:

- focused parser tests failed because `contributors` was absent and malformed later entries were accepted (8 failures);
- focused Boye SSR failed because the API response had no `contributors`;
- focused hydrated desktop failed with one contributor link instead of two.

GREEN after implementation:

- `yarn vitest run test/unit/reader-source.spec.ts`: 94/94 passed;
- `NUXT_IGNORE_LOCK=1 LITTB_NUXT_TEST_PORT=4408 LITTB_V2_TEST_PORT=3308 yarn playwright test test/ssr/reader.spec.ts --project=ssr`: 90/90 passed;
- focused Boye SSR: 1/1 passed;
- focused Boye hydrated Chromium desktop: 1/1 passed;
- focused Boye hydrated Chromium mobile: 1/1 passed;
- single-contributor contents/role regressions on desktop and mobile: 4/4 passed;
- Reader final-parity unit: 9/9 passed;
- Reader final-parity SSR: 6/6 passed;
- `yarn typecheck`: passed.

The hydrated test covers the sidebar, contents heading, and work-search heading, including ordered links, `&`, `red.`, and the legacy parenthesis pseudo-elements. The mobile test uses scoped DOM interaction because mobile controls overlap visually and the dialog's contributor heading is intentionally CSS-hidden while remaining in the DOM.

## Live-backend verification

With a local Nuxt dev server using the default live Reader source, the actual route
`/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil` returned HTTP 200. Its SSR contained both contributor names and the contribution suffix. The local API returned, in order:

1. `BoyeK` / Karin Boye;
2. `HelgesonP` / Paulina Helgeson / `authorType: "editor"`.

The live-derived description was `Ett verkligt jordiskt liv. Brev av Karin Boye & Paulina Helgeson (red.), sida 3 som faksimil.`

## Scope and residual risk

Only coherent public Reader source/type/API/rendering/test/fixture hunks are included. Mixed files were staged selectively to exclude concurrent Quick Search, bibliography, and editor-reader work.

The upstream contributor list is now treated as required, non-empty, and bounded at 100 entries. This matches the pre-existing assumption that a primary author is required while closing the safety gap where malformed later entries were previously ignored.

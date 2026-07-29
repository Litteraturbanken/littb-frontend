# Reader similar works parity brief

## Objective

Restore the legacy Reader source-information section `Läs gärna också` through a typed v2 backend contract and Nuxt rendering, preserving exact legacy order and links. Do not expose `content_vector` to the frontend.

## Authoritative legacy behavior

- Legacy controller `app/scripts/controllers.js` requests `GET /api/get_similar/{lbworkid}/{mediatype}` only when the work has a content vector.
- Legacy backend implementation is `/Users/johan/dev/lb-backend/lbapi/web.py` around the `get_similar` handler.
- For Doktor Glas (`lb1728740`, `etext`), the exact ordered recommendations are:
  1. Boye — `Bebådelse [1941]` → `/författare/BoyeK/titlar/Bebådelse/sida/3/etext`
  2. Boye — `Bebådelse [Samlade skrifter 8, 1948]` → `/författare/BoyeK/titlar/Bebådelse1948/sida/3/etext`
  3. Boye — `Uppgörelser` → `/författare/BoyeK/titlar/Uppgörelser/sida/3/etext`
  4. Benedictsson — `Modern [1888]` → `/författare/BenedictssonV/titlar/Modern/sida/1/etext`
  5. Boye — `Ur funktion` → `/författare/BoyeK/titlar/UrFunktion/sida/3/etext`
- Live dialog structure after its main content is a small section with an `hr`, `h3` text `Läs gärna också`, and table rows containing author surname and linked title.

## Required backend work

- Add a typed v2 `GET /works/{work_id}/similar` endpoint with required `media_type` constrained to `etext | faksimil`.
- Reuse the legacy similarity algorithm/data source, but return a bounded maximum of five strictly validated projection items.
- Each item must contain enough typed data to render exact legacy author surname, label, canonical Reader path components, and media type without trusting an arbitrary backend URL. A suitable shape is `author_id`, `author_surname`, `title_id`, `start_page`, `media_type`, `label`.
- Return an empty items collection when no vector or no matches exist. Preserve upstream failure semantics consistent with other v2 Reader endpoints.
- Add model/OpenAPI tests, query/projection tests, malformed-response tests, and exact Doktor Glas ordering coverage. Test first and demonstrate red/green.

## Required frontend work

- Regenerate the checked-in OpenAPI TypeScript client after the backend contract exists.
- Fetch this single-use model directly within the Reader/source-information script setup or its owning page; do not create a composable.
- Fetch recommendations only for source-info state, render the section only when valid non-empty results exist, and preserve Reader/source-dialog behavior during route changes, aborts, failures, SSR/hydration, and Back/Forward.
- Use `NuxtLink` for canonical internal Reader destinations.
- Match the legacy section structure and visual classes as closely as practical; do not redesign it.
- Extend the deterministic fixture with the exact five Doktor Glas recommendations above.
- Add focused SSR and browser behavior/visual assertions for exact order, labels, hrefs, empty results, failure isolation, and no duplicate fetch during hydration. Test first and demonstrate red/green.

## Constraints

- Frontend repo: `/Users/johan/.codex/worktrees/8c5c/littb`
- Backend repo: `/Users/johan/dev/lb-backend`
- Preserve all unrelated dirty files in both repositories.
- Use `apply_patch` for edits.
- Stage and commit only files owned by this task; separate backend and frontend commits are expected.
- Do not stop the persistent Nuxt server on port 3020 or backend on port 8000. For Playwright use isolated high ports and `NUXT_IGNORE_LOCK=1` if needed.
- Run focused backend tests, frontend unit/SSR/E2E tests, Nuxt typecheck, and API codegen check. Write a concise report to `.superpowers/audits/reader-similar-works-report.md` and return status/commits/test summary/concerns.

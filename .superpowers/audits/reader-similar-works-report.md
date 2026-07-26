# Reader similar works parity report

## Status

Implemented the legacy Reader source-information section `Läs gärna också` through a typed v2 projection and Nuxt rendering. The checked-in frontend contract contains no `content_vector`, and the vector remains confined to the backend similarity query.

## Root cause

The Nuxt source-information projection intentionally excludes `content_vector`, but the legacy controller used that field as the trigger for a separate `/api/get_similar/{lbworkid}/{mediatype}` call. API v2 had no replacement endpoint, so the Nuxt dialog had no recommendation data to render.

## Backend

- Added required `GET /works/{work_id}/similar?media_type=etext|faksimil`.
- Reused the legacy two-query OpenSearch algorithm, including the etext boost and KNN cosine scoring.
- Uses structured exact `term` filters for the requested and excluded work IDs; Lucene-like spaces, colons, and operators remain inert literal values rather than query syntax.
- Added strict, path-safe models and a five-item maximum.
- Projects only `author_id`, `author_surname`, `title_id`, `start_page`, `media_type`, and `label`; it never returns the vector or an arbitrary URL.
- Returns `{ "items": [] }` when the source representation has no vector or the similarity query has no hits.
- Preserves the standard v2 422/500/503 error contracts.
- Regenerated the checked-in backend OpenAPI schema.

## Frontend

- Regenerated the checked-in TypeScript OpenAPI client.
- Fetches similar works directly inside the owning Reader page's source-information `useAsyncData` flow; no composable was added.
- Fetches only after valid readable source information has loaded and only while source-info is requested.
- Strictly validates the generated response at runtime and treats empty, malformed, or failed recommendations as an optional empty enhancement without hiding source information.
- Keeps the source-info identity guard, SSR payload hydration, Back/Forward cache behavior, and stale-route isolation of the existing dialog flow.
- Renders the legacy `hr` / `h3` / table structure and classes, in exact result order, using `NuxtLink` destinations built exclusively from validated canonical path components.
- The Dramawebben caller receives the component's empty default and remains unchanged.

## TDD evidence

- Backend RED: the projection test failed because `lbapi.v2.similar_works` did not exist.
- Backend model RED: unsafe path segments and control-bearing labels were initially accepted by the DTO.
- Backend query-safety RED: captured calls still exposed user-controlled work IDs through `q` / `query_string`; API and query tests now prove operator-, colon-, and space-bearing values remain exact structured terms in both searches.
- Frontend RED: SSR returned zero `.reader-similar-works` rows instead of the five literal Doktor Glas rows.
- Frontend malformed RED: a control-bearing recommendation label initially rendered instead of being isolated.
- Each case was rerun green after its minimal production change.

## Verification

- Backend model/source-info/similar/OpenAPI suite after the query-safety follow-up: `270 passed`.
- Real read-only OpenSearch query for `lb1728740` / `etext`: returned the exact five required labels, order, and canonical components.
- Nuxt focused unit suite (`v2-server` and `reader-source-info`): `164 passed`.
- Complete Reader SSR file: `90 passed`.
- Reader source-info desktop/mobile behavior sweep: `29 passed`, `1` intentional mobile no-JavaScript skip.
- Final malformed/empty/failure browser regression: passed.
- Nuxt typecheck: passed.
- OpenAPI TypeScript codegen check against the committed backend schema: passed.

## Operational note

No shared dev server was stopped or restarted for this work. Backend verification used TestClient, the checked-in schema, and the separate read-only OpenSearch tunnel. The root task owns restarting the shared backend process.

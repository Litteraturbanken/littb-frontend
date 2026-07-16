# Nuxt global Quick Search implementation plan

**Design:** `docs/superpowers/specs/2026-07-16-nuxt-quick-search-design.md`

**Frontend base:** `6dd3fdb`

**Backend base:** `b98135e`

## Global constraints

- Preserve Angular visual and ordinary user behavior; do not redesign the modal.
- Keep legacy autocomplete and Angular sources unchanged.
- Return display-ready typed v2 rows; never expose raw Elasticsearch documents to Nuxt.
- Keep state in the reusable global component; no composable or Angular bridge.
- Use Headless UI Dialog + Combobox 1.7.23 and generated OpenAPI types.
- Context-only reader/author/editor commands and analytics are out of scope.
- Follow TDD, commit each task separately, and independently review every task.

### Task 1: Type and transform Quick Search results

**Backend files:**
- Modify `lbapi/v2/models.py`
- Create `lbapi/v2/quick_search.py`
- Create `test_lbapi/v2/test_quick_search.py`
- Modify `test_lbapi/v2/test_models.py`

1. Add failing model tests for exact literals, required nullable media label, forbidden extras, and the response envelope.
2. Add failing pure-transformer tests for works, parts, authors, every route/label fallback, all four author-year cases, audio removal, source ordering, first correction, LB-id-shaped results, and malformed documents.
3. Implement the minimal strict models and pure display transformer. Keep the query call behind a patchable function and do not add the route yet.
4. Run focused models/transformer plus existing v2 model tests.
5. Commit `feat(api): type v2 quick-search results`.

### Task 2: Publish the Quick Search endpoint

**Backend files:**
- Modify `lbapi/v2/quick_search.py`
- Modify `lbapi/v2/app.py`
- Modify `test_lbapi/v2/test_api.py`
- Modify `test_lbapi/v2/test_openapi.py`
- Modify `openapi/v2.json`

1. Add failing endpoint tests for trimmed 1–200 character query validation, synchronous GET behavior, exact success, generic malformed-data 500, and non-leaking typed OpenSearch 503.
2. Add the router with stable operation ID `v2_get_quick_search` and explicit 422/500/503 response references.
3. Add failing OpenAPI assertions for the parameter constraints, strict item/response schemas, literals, and mounted/legacy isolation.
4. Export the canonical snapshot and run the complete backend v2 suite plus snapshot check.
5. Commit `feat(api): publish v2 quick search`.

### Task 3: Generate the client and deterministic fixture

**Frontend files:**
- Modify `nuxt/app/lib/api/generated/lbapi.ts`
- Modify `nuxt/test/unit/api-client.spec.ts`
- Modify `nuxt/test/fixtures/v2-server.mjs`
- Modify fixture-server unit tests and fixture data
- Modify `nuxt/package.json`
- Modify `nuxt/yarn.lock`
- Modify `nuxt/test/unit/foundation.spec.ts`

1. Regenerate the client from the canonical backend snapshot and add failing/generated-client tests for encoded query, typed success, and typed 503.
2. Add deterministic typed author/work/part/correction/no-hit responses to the fixture server, a query request ledger, reset/failure controls, and controllable delay ordering for stale-response tests.
3. Add unit coverage for fixture success/failure/delay/reset behavior without affecting existing request logs.
4. Pin `@headlessui/vue` 1.7.23 and change the foundation assertion from absence to exact presence.
5. Run API freshness, unit, typecheck, and dependency/install checks.
6. Commit `feat(nuxt): generate Quick Search client`.

### Task 4: Port the global Dialog and Combobox

**Frontend files:**
- Create `nuxt/app/components/global/QuickSearch.vue`
- Modify `nuxt/app/layouts/default.vue`
- Modify `nuxt/app/assets/styles/nuxt.scss`
- Create `nuxt/test/e2e/quick-search.behavior.spec.ts`
- Modify/add SSR shell tests

1. Add failing SSR assertions for trigger markup and zero Quick Search requests.
2. Add failing browser tests for click/`s` open, focused-control suppression, exact empty state, 200ms debounce, abort/latest-wins, static command ordering, slash no-network, correction, disabled no-hit, API failure, mouse and wrapping keyboard selection, Enter/Tab, two-stage Escape, backdrop/footer, focus restoration, and clear/reopen.
3. Implement `QuickSearch.vue` with local state, direct generated-client calls, Headless UI Dialog/Combobox, static commands, request cancellation, and body-class cleanup.
4. Replace only the inert shell entry and add minimal glue CSS outside migrated authority styles.
5. Run focused SSR/e2e, full unit, typecheck, build, and API freshness gates.
6. Commit `feat(nuxt): port global Quick Search`.

### Task 5: Lock Angular visual parity and close the slice

**Frontend files:**
- Create test-only raw/typed Quick Search fixture data
- Create `nuxt/test/visual/capture-quick-search-angular.spec.ts`
- Create `nuxt/test/e2e/quick-search.visual.spec.ts`
- Create empty/populated desktop/mobile baselines

1. Intercept Angular raw autocomplete and logging endpoints with local fixtures; assert no production request escapes.
2. Capture empty and populated dialogs at desktop/mobile widths after exact modal/input/row/focus/blur readiness assertions.
3. Inspect all baselines for modal geometry, blurred shell, backdrop, input, result order/copy, active row, footer, and mobile shell behavior.
4. Compare Nuxt at the existing near-pixel thresholds and fix only demonstrated migration drift.
5. Run complete backend, Nuxt, unchanged Angular, OpenAPI/client freshness, visual, typecheck/build, scope, and diff gates.
6. Commit `test(nuxt): lock Quick Search parity`.

## Final review gate

- Compare the complete backend/frontend ranges with the design.
- Verify raw search documents exist only behind the backend transformer and in tests.
- Verify ordinary production commands are complete and context-only Angular commands are absent without a compatibility bridge.
- Verify no production autocomplete/log endpoint was contacted during tests or visual capture.
- Fix every Critical/Important finding and rerun the clean whole-slice gates.

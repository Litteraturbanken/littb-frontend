# Nuxt Dramawebben Catalog Implementation Plan

> **For agentic workers:** use subagent-driven development and test-driven
> development task by task. Do not edit the user's unrelated plan or
> `.superpowers/` files.

**Goal:** Make `/dramawebben/pjäser` a populated, visually unchanged Nuxt SSR
page backed by a strict generated FastAPI contract.

## Task 1: Typed FastAPI catalog boundary

- [ ] Add RED model/transform/provider/API/OpenAPI tests in `lb-backend`.
- [ ] Add strict catalog DTOs to `lbapi/v2/models.py`.
- [ ] Implement one bounded provider query and deterministic projection in a
  new `lbapi/v2/dramawebben.py` router.
- [ ] Register the router, export `openapi/v2.json`, and run focused plus full
  v2 tests.

## Task 2: Generated client and deterministic fixture

- [ ] Add a compact grouped catalog fixture and exact request/failure/delay
  ledgers to `nuxt/test/fixtures/v2-server.mjs`.
- [ ] Regenerate `nuxt/app/lib/api/generated/lbapi.ts` from the committed schema.
- [ ] Add RED generated-client/SSR tests proving the exact private SSR request,
  populated initial HTML, strict payload rejection, and stable 503 shell.

## Task 3: SSR catalog page and local filters

- [ ] Extend `DramawebbenShell` with the `pjäser` page and exact active state.
- [ ] Implement `app/pages/dramawebben/pjäser.vue` with one generated-client
  fetch directly in `<script setup>` and route-keyed stale-result protection.
- [ ] Reproduce the legacy intro, controls, tables, author formatting, media
  links, range derivation, tokenized filtering, and clear behavior.
- [ ] Use Headless UI for dropdown controls while preserving legacy classes.
- [ ] Update the old tests that intentionally asserted a pjäser 404.

## Task 4: Browser behavior and visual authority

- [ ] Add hydration/request-count, filter, query, list/history, keyboard/focus,
  and clear tests.
- [ ] Capture populated Angular desktop/mobile authority screenshots under a
  closed request firewall.
- [ ] Add Nuxt visual comparisons and inspect every authority/result image.
- [ ] Run focused tests, full relevant regressions, typecheck, OpenAPI checks,
  diff checks, and a live 8010/3020 smoke test.
- [ ] Request independent Critical/Important review and fix all findings.

## Deferred follow-up

- [ ] Port the query-owned `om-boken` work-info dialog with Headless UI Dialog.
- [ ] Port typed legacy Dramawebben play/author inbound redirects.
- [ ] Evaluate the separate full `/dramawebben/författare` route only if it has
  behavior beyond the catalog's Författare view.


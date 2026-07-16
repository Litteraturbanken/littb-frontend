# Nuxt Contact implementation plan

**Design:** `docs/superpowers/specs/2026-07-16-nuxt-contact-design.md`

**Frontend base:** `1d86647`

**Backend base:** `de2ffb0`

## Global constraints

- Preserve Angular visual and behavioral authority; do not redesign the forms.
- Never send mail from tests, captures, or local verification.
- Keep the legacy `GET /contact` unchanged.
- Keep page-only state and fetch logic in `<script setup>`; no composable.
- Use the generated OpenAPI client and no handwritten payload type.
- Preserve unrelated `.superpowers/` and user changes.
- Follow TDD, commit each task separately, and independently review every task before continuing.

### Task 1: Add Contact request and response models

**Backend files:**
- Modify `lbapi/v2/models.py`
- Modify `test_lbapi/v2/test_models.py`

1. Add failing tests for required fields, whitespace stripping, the literal audience union, forbidden extras, non-empty message, 254-character ceiling, and the exact Angular email acceptance/rejection matrix including `a@b`.
2. Add `ContactRequest` and `ContactAcceptedResponse` under `V2Model`, with a reusable exact email validator and OpenAPI email-format metadata.
3. Run the focused model suite and existing v2 model tests.
4. Commit `feat(api): type v2 contact payloads`.

### Task 2: Implement typed, environment-routed delivery

**Backend files:**
- Create `lbapi/v2/contact.py`
- Modify `lbapi/v2/app.py`
- Create `test_lbapi/v2/test_contact.py`
- Modify `test_lbapi/v2/test_api.py`

1. Add failing tests for 202 delivery, both live audiences, all non-red test routing, test-routing precedence, exact sender signature/reply-to/from/subject data, and newsletter-shaped input.
2. Add failing tests proving provider failures return a generic typed 502 and unexpected failures remain generic 500 responses without provider details.
3. Implement pure recipient/body construction and a synchronous route with a single patchable provider boundary. Include the Contact router in the v2 app.
4. Run the focused Contact/API suites and prove the legacy operation is untouched.
5. Commit `feat(api): add typed v2 contact delivery`.

### Task 3: Publish the OpenAPI contract and regenerate the client

**Backend files:**
- Modify `test_lbapi/v2/test_openapi.py`
- Modify `openapi/v2.json`

**Frontend files:**
- Modify `nuxt/app/lib/api/generated/lbapi.ts`
- Modify the generated-client unit tests
- Modify `nuxt/test/fixtures/v2-server.mjs`
- Modify fixture-server unit tests

1. Add failing OpenAPI assertions for request/response schemas, 202/422/502 envelopes, email format, required fields, and forbidden extras.
2. Regenerate and check in `openapi/v2.json` from the isolated backend worktree.
3. Regenerate the Nuxt client from that snapshot and add a unit assertion for the typed `POST /contact` operation.
4. Extend the fixture server with POST parsing, a separate Contact submission ledger, deterministic defer/failure controls, cleanup endpoints, and CORS support. Retain the existing string request log.
5. Run backend OpenAPI tests plus Nuxt client/fixture unit tests and `api:check` against the snapshot.
6. Commit backend `docs(api): publish v2 contact contract` and frontend `feat(nuxt): generate v2 contact client`.

### Task 4: Port the Contact page and alias

**Frontend files:**
- Create `nuxt/app/pages/om/kontakt.vue`
- Modify `nuxt/nuxt.config.ts`
- Modify `nuxt/package.json`
- Modify `nuxt/yarn.lock`
- Modify Nuxt global CSS configuration/imports
- Modify `nuxt/test/ssr/about-pages.spec.ts`
- Modify `nuxt/test/ssr/routing-errors.spec.ts`
- Create `nuxt/test/e2e/contact.behavior.spec.ts`

1. Add failing SSR tests for exact metadata/copy/active tab, no submission, and `/kontakt` 308 query preservation.
2. Add failing browser tests for pristine/valid states, dirty-and-blurred errors, exact payloads, loading spinner, four-second success/error transitions, value clearing/retention, combined SOL/skola behavior, newsletter semantics, and no console/page errors.
3. Add the exact Font Awesome 4.4.0 dependency and global CSS import.
4. Implement the page with local refs/computed state and direct generated-client calls. Preserve exact template classes and `v-show` mounting behavior.
5. Add the permanent alias and run focused SSR/e2e, unit, typecheck, and build gates.
6. Commit `feat(nuxt): port Contact forms`.

### Task 5: Lock visual parity and close the slice

**Frontend files:**
- Create `nuxt/test/visual/capture-contact-angular.spec.ts`
- Create `nuxt/test/e2e/contact.visual.spec.ts`
- Create `nuxt/test/visual/baselines/contact-{desktop,mobile}.png`

1. Capture the Angular initial Contact form at desktop and mobile widths with all contact network calls hard-stubbed.
2. Inspect both images for copy, 400px geometry, About background/navigation, fonts, fields, buttons, and the intentional mobile overflow.
3. Compare Nuxt with the shared readiness helper and existing near-pixel thresholds. Assert a non-empty spinner box and exact status copy structurally.
4. Run the complete backend v2 and frontend gates, Nuxt `api:check`, all Nuxt unit/SSR/e2e/typecheck/build gates, unchanged Angular unit/build gates, and `git diff --check`.
5. Verify no captured content or live delivery path entered production/test execution, and generated files are current.
6. Commit `test(nuxt): lock Contact parity`.

## Final review gate

- Compare the complete frontend and backend ranges with the design.
- Verify no Critical or Important review findings remain.
- Re-run the full slice gates from clean worktrees and record exact evidence.

# Complexity Reduction Design

## Objective

Reduce accidental complexity in the Nuxt migration and the FastAPI V2 adapter without changing routes, API schemas, visual output, accessibility behavior, or legacy-data validation.

## Chosen approach

Use incremental extraction behind existing public interfaces. Each extraction creates a focused, typed unit and leaves the current page, server handler, or API function as the orchestration boundary.

The alternatives were rejected:

- A broad rewrite into generic composables would create new framework abstractions and conflict with the preference to keep single-page model fetching inside `script setup`.
- Leaving the large units intact and merely relaxing complexity lint rules would hide the maintenance problem rather than reduce it.

## Architecture

### Architecture policy

Retain semantic enforcement for raw HTML, trusted capability issuers, forbidden legacy endpoints, suppression comments, and audited DOM operations. Remove whole-file AST and string fingerprints. The verifier will inspect the capability module and ESLint configuration for required invariants, allowing harmless formatting and refactoring while continuing to reject new capability issuers, escaped branding helpers, widened ignores, and policy-disabling rules.

### Reader source information

Keep `reader-source-info.ts` as the public orchestration facade. Move runtime response validation, HTML sanitization, static definition loading, and presentation projection into focused server utilities. Generated OpenAPI types remain compile-time contracts; runtime validators remain mandatory at the network boundary.

### Library page

Keep requests and reactive state in `bibliotek.vue`. Extract pure route parsing, mode-specific result application, and independent DOM behavior such as the tooltip directive. No generic composable is introduced for page-only model code.

### Backend V2 adapters

Keep public provider functions and response models unchanged. Split Library mode implementations behind the existing `library_provider` facade and divide author-work normalization into typed phases. All malformed legacy responses continue to fail closed at the same public boundary.

### Reader and editor

Extract only identical pure work-search validation and navigation helpers. Page-specific route state, fetch ownership, focus restoration, and rendering stay in their pages.

### Text search

Consolidate repeated identity/version/abort/cache bookkeeping into a small page-local request-ownership utility. Fetch initiation remains in `sök.vue`; the utility only decides ownership and stale-response acceptance.

## Behavioral guarantees

- Existing URLs and browser history behavior are unchanged.
- Existing SSR and hydration behavior is unchanged.
- Existing generated API types and public backend schemas are unchanged.
- No visual or spacing changes are intentional.
- Invalid, oversized, cyclic, or unsafe legacy/backend data continues to be rejected.
- Existing accessibility behavior remains covered by browser tests.

## Verification

Each seam is introduced with a focused failing contract test, followed by the minimal extraction and the relevant existing regression suites. Final verification includes architecture-policy tests, Nuxt lint/typecheck/unit/SSR/browser suites, backend Ruff/type/test checks, OpenAPI client consistency, and a complexity rescan of the original hotspots.

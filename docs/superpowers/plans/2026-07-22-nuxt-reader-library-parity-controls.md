# Nuxt Reader and Library parity controls

Status: auto-approved under the active AngularJS-to-Nuxt migration goal.

## Goal

Close two independent, user-visible gaps without changing the established design:

1. make the Reader's first, last, and direct search-hit controls behave like the Angular reader; and
2. make an already-active Library sort reverse direction and show the matching caret.

## Architecture

Both slices remain page-local. They use the existing typed API responses, Nuxt router state, and existing DOM/CSS hooks directly in each page's `<script setup>`. No composable, backend endpoint, shared state layer, or stylesheet redesign is introduced.

The Reader resolves an arbitrary target hit through the existing typed `search-hits` endpoint before pushing the exact Reader route for that hit. Existing canonical search flags and unrelated query bytes remain intact, and browser history remains additive. The direct-hit form follows the legacy one-based UI while the route keeps its zero-based `hit` value.

The Library treats a click on the active sort key as a direction toggle. A click on a different key selects that key's legacy default direction. As in Angular, the active key remains in the URL while the click-local reversal is replaced rather than added to browser history; a reload returns to that key's default direction.

## Constraints

- Preserve current visuals, legacy class names, and layout.
- Use NuxtLink/router navigation rather than document reloads.
- Keep fetch/model code in the single page that owns it.
- Reject malformed, out-of-range, or incoherent Reader hit responses without navigation.
- Do not alter the completed Reader scroll restoration plugin.
- Add behavior tests before implementation and observe the expected failure.
- Run focused browser tests, typecheck, and an independent code review before closure.

## Implementation tasks

### Task 1: Reader indexed hit controls

- [x] Add failing Playwright coverage for first, last, valid direct, invalid direct, exact target page/query, and Back restoration.
- [x] Add page-local target-hit resolution using the generated API client and current response validator.
- [x] Replace inert anchors with legacy-shaped interactive controls and a focused one-based input form.
- [x] Verify focused Reader behavior, typecheck, and live browser behavior.

### Task 2: Library active-sort reversal

- [x] Add a failing browser test for repeated active-sort clicks, reversed request/order, URL state, and caret direction.
- [x] Implement the page-local direction toggle while retaining defaults for newly selected sort keys.
- [x] Verify focused Library behavior, typecheck, and visual stability.

### Task 3: Integration and next slice

- [x] Independently review both diffs and address findings.
- [x] Run the focused suites and repository diff checks.
- [x] Record completion in the migration ledger.
- [ ] Continue with the next highest-value genuine gap: Reader search-return handoff or Library advanced filters, based on dependency/risk.

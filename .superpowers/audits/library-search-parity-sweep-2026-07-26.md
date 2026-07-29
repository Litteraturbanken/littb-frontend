# Library/search parity sweep — 2026-07-26

Read-only comparison of:

- local Nuxt: `http://127.0.0.1:3020`
- live Angular: `https://litteraturbanken.se`
- checked-in Angular templates/controllers

The local frontend was available, but `127.0.0.1:8000` was not listening during the audit. Findings that need real result data were therefore corroborated against the Nuxt parser/template and live DOM rather than by changing or restarting either server.

## Proven gaps

### 1. Text-search chronology track does not move the nearest handle

**Reproduction**

1. Open `/s%C3%B6k?fras=kyrka`.
2. Click the chronology line at approximately 75% of its width, away from either thumb.

**Live:** with bounds `1248–2026`, the upper handle moved to `1857` and the URL became `?fras=kyrka&intervall=1248,1857`.

**Local:** with its currently available `1800–1950` bounds, both handles remained `1800,1950` and the URL stayed `?fras=kyrka`.

**Root cause**

- `nuxt/app/pages/sök.vue:1175-1200` has no pointer handler on `.chronology_ranges`.
- `nuxt/app/pages/sök.vue:1558-1591` sets both range tracks to `pointer-events: none`; only the thumbs accept pointer events.
- The already-fixed library implementation has the required nearest-handle pointer state machine at `nuxt/app/pages/bibliotek.vue:2834-2898` and binds it at `nuxt/app/pages/bibliotek.vue:3415-3421`.

**Bounded fix/test**

Port the library chronology pointer behavior into the text-search page: nearest handle, ties to the upper handle, primary pointer only, focus the selected native input, one router push on commit, and preservation of unrelated/repeated query parameters. Add focused E2E cases beside `nuxt/test/e2e/text-search.behavior.spec.ts` for lower/upper/tie clicks and native keyboard use after thumb selection.

### 2. Search reset remains visible when pristine and does not restore input focus

**Reproduction A**

1. Open `/s%C3%B6k` or `/s%C3%B6k?avancerad=1`.

**Live:** the reset glyph has `ng-hide`, a `0×0` box, and is not exposed in the accessibility tree. `avancerad` alone is explicitly ignored when determining pristine state.

**Local:** the `Rensa sökningen` button is visible and exposed even with no effective search criteria.

**Reproduction B**

1. Open `/s%C3%B6k?fras=kyrka`.
2. Activate reset.

**Live:** the URL becomes `/s%C3%B6k`, the reset control becomes hidden, and focus returns to the main search input.

**Local:** the URL becomes `/s%C3%B6k`, but the always-visible reset button retains focus.

**Root cause**

- Angular gates the control with `ng-show="!$ctrl.isPristine()"`; `app/scripts/search_controller.js:513-515` ignores `avancerad` when calculating pristine state and `:507-512` reloads after reset, allowing autofocus to run.
- Nuxt renders the reset button unconditionally at `nuxt/app/pages/sök.vue:1077-1093`; `resetSearch()` only pushes the reset query at `:758-760`.

**Bounded fix/test**

Compute effective pristine state from recognized search query keys while excluding `avancerad`, hide the reset button when pristine, and focus the main query input after a client-side reset (a reload is not required). E2E-test `/sök`, advanced-only state, populated state, reset URL, reset visibility, and post-reset focus.

### 3. Advanced search category headings were flattened

**Reproduction**

1. Open `/s%C3%B6k?avancerad=1`.
2. Open `Filtrera: Kategorier / Utgivare`.

**Live:** the dropdown visibly exposes four groups: `Kategorier`, `Projekt`, `Avdelningar`, and `Utgivare` (also represented as four accessible groups in the live DOM).

**Local:** all 38 options appear in one flat list with none of those headings.

**Root cause**

- Angular defines four `<optgroup>` blocks in `app/scripts/components/search/template.html:211-280`.
- Nuxt creates one flat `categoryChoices` array and passes only `:options="categoryChoices"` at `nuxt/app/pages/sök.vue:1298-1307`.
- `SearchMultiSelect` already supports grouped options and the library page already uses that capability, so this is not a component limitation.

**Bounded fix/test**

Define the four legacy category groups without changing option values/order and pass them through `option-groups`. Add an E2E assertion that the opened dropdown has the four headings in order and that selecting an option in each group preserves the existing canonical query behavior.

### 4. Ellipsized library rows lost their full-title and full-author hover details

**Reproduction**

1. Open `/bibliotek?visa=works&sort=popularitet` on live.
2. Hover `Doktor Glas`: after the legacy delay, the tooltip reads `Doktor Glas. Roman`.
3. Hover `Söderberg`: the tooltip reads `Hjalmar Söderberg (1869-1941)`.

The live DOM likewise carries `uib-tooltip="Doktor Glas. Roman"` on the short title and `uib-tooltip="Hjalmar Söderberg (1869-1941)"` on the surname.

Nuxt now restores ellipsis, but its works/latest/EPUB/PDF row templates render only `item.title` and `item.surname`, without a full-text hover affordance (`nuxt/app/pages/bibliotek.vue:3721-3739`, `:3869-3907`, and `:3987-4017`). The parsers choose `shorttitle || title` and discard the other title; they also validate or read `full_name` without retaining the complete author label (`:501-525`, `:560-575`, `:779-800`, `:935-953`).

Angular retains both values and provides the two tooltips at `app/scripts/components/library/works_list.html:80-98` and `:153-169`.

**Bounded fix/test**

Retain a sanitized optional full-title tooltip and full author/year tooltip in each row view model, and render the same delayed hover content only when useful. Extend the library fixture with a differing `title`/`shorttitle` and complete author years; assert both truncated display text and full tooltip content in works, latest, EPUB, and PDF modes.

## Scope notes

Already-covered items were deliberately not re-reported: vue-multiselect replacement, library nearest-handle chronology behavior, title ellipsis itself, editor `(red.)` suffixes, advanced disclosure operation, search links, and reader hit marking. The local library API error caused by the intentionally stopped backend was also not treated as a frontend parity regression.

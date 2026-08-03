# Site-wide keyboard focus and Library navigation design

## Context

The migrated site retains a legacy global `:focus { outline: none; }` rule. The Library's controls are present in the browser tab order and most use native links, buttons, inputs, and sliders, but keyboard focus is not consistently visible. In the Works result view, title disclosures are also explicitly red even when idle, whereas the production presentation uses black titles.

## Goals

- Make keyboard focus visibly identifiable across the Nuxt application without changing the ordinary mouse/touch presentation.
- Keep native keyboard behavior for links, buttons, form controls, and sliders.
- Make Library Works titles black while idle and retain the existing red interaction color.
- Make each work-title disclosure expose its relationship to the representation links it controls.
- Prove the complete Library keyboard path with browser-level regression tests.

## Non-goals

- Redesigning the site's typography, colors, spacing, or ordinary hover states.
- Replacing native controls with a custom roving-tabindex system.
- Refactoring unrelated Library data fetching or result rendering.
- Performing a complete screen-reader content audit of every migrated page in this change.

## Site-wide focus contract

The legacy blanket focus suppression will be replaced by a keyboard-only `:focus-visible` treatment. The ring will use a two-tone light/dark treatment so at least one edge remains visible on both the site's pale panels and its dark photographic backgrounds. It will have a clear offset from the focused control and will not depend on a color change alone.

Pointer focus will not gain the keyboard ring where the browser does not match `:focus-visible`. Existing component-specific focus affordances may remain, but they must not suppress the site-wide outline.

The implementation will continue to respect native forced-colors behavior rather than disabling it.

## Library behavior

### Result titles

Works with multiple available representations remain native `<button>` disclosures, rather than pretending to be direct links. Their idle text color becomes black. Hover and keyboard focus may use the site's red interaction color, with the site-wide ring providing the non-color focus cue.

Each title button keeps `aria-expanded` and gains `aria-controls` pointing to a stable, unique ID on its representation-action container. Enter and Space use native button activation. Once expanded, the next Tab reaches the first representation link; Shift+Tab returns to the title disclosure.

### Navigation path

The browser's normal document order remains the source of truth. A keyboard user can reach, operate, and visibly locate:

1. global navigation;
2. Library search and advanced-search disclosure;
3. chronology sliders and inputs;
4. result-mode tabs and sort links;
5. work-title disclosures and their representation links;
6. author links; and
7. pagination.

Vue Multiselect controls retain their established arrow-key, Enter, and Escape behavior. This change does not introduce a second keyboard model around them.

## Testing

Tests will be written before production changes and observed failing for the expected reasons.

- A site-shell browser test will tab to an interactive element outside the Library and assert a non-zero, non-`none` visible focus outline.
- A Library browser test will assert that an idle work-title disclosure is black.
- A Library keyboard-flow test will focus a work title through keyboard navigation, assert the visible ring, activate it with Enter, verify `aria-expanded` and `aria-controls`, then Tab into the first representation link and Shift+Tab back.
- Existing advanced-search, multiselect, slider, tooltip, SSR, and Library contract tests will remain green.
- Final manual verification will use a real browser on staging and confirm that mouse clicks do not display the keyboard-only ring.

## Rollout and risk

The CSS change is deliberately site-wide but only visible during keyboard focus. Library markup changes are limited to IDs and ARIA relationships around existing disclosures. No API or route contract changes are required.

The principal risk is a focus ring being clipped by a component's overflow or overridden by a more specific rule. Browser tests will inspect representative shell, Library, multiselect, and result controls; any exception will be fixed locally without weakening the global contract.

# Nuxt Library Searchable Author Multiselect Parity Design

## Scope

Restore production behavior for the advanced Library control labelled `Om ett
författarskap`. This is a focused correction to the existing
`SearchMultiSelect` adapter; it does not introduce another component, change
route semantics, or redesign the Library controls.

## Confirmed defect

When one or more author IDs are present in `about_authors`, Vue-Multiselect's
internal searchable input is forced to the Library field width of 350 px. It
is absolutely positioned with a white background above the selected chips.
The chips exist and have the correct dimensions, but they are hidden beneath
the input and overflow from the wrong origin.

Production keeps a 350 px search/placeholder field at the left and lays every
selected author chip immediately to its right. Opening the dropdown retains
that geometry while the left field becomes the active text filter.

## Component contract

`SearchMultiSelect` will support `persistentInputRow` for searchable controls:

- with selected values and the menu closed, render the existing readonly
  persistent input row at the left and place chips after it;
- with selected values and the menu open, let Vue-Multiselect's real search
  input occupy the same left slot so typing filters the options;
- keep the real search input hidden from layout only while the closed
  persistent row owns the left slot;
- preserve the existing behavior of non-searchable persistent rows and of
  searchable controls without `persistentInputRow`.

The Library author selector opts into `persistentInputRow`. Styling is scoped
through `data-library-about-authors` so the Search page and other multiselects
remain unchanged.

## Interaction and data flow

Clicking the left field or selected-chip area toggles the menu once, without a
close/reopen flicker. While open, keyboard focus moves to the real search
input; entered text filters the existing author option set without changing
the URL. Selecting or removing an author continues to emit the ordered string
array through `update:modelValue`, and `bibliotek.vue` remains the sole owner
of the `about_authors` route parameter.

Browser Back, Forward, and reload continue to reconstruct the selected author
chips from the route-owned IDs.

## Visual authority

Production is authoritative for the closed and open selected states:

- input width: 350 px;
- gap from input to first chip: 8 px;
- chip height, padding, margins, type, and removal glyph match the other
  advanced Library multiselects;
- selected chips remain visible to the right rather than wrapping into or
  painting underneath the search field;
- the dropdown remains anchored below the 350 px left field.

## Verification

Add a Playwright regression using the four-author route from the reported
case. It must fail when the internal input overlays the chips and assert:

- four visible selected chips in route order;
- the first chip begins 8 px after the left field;
- opening retains chip visibility and exposes a focusable text filter;
- typing narrows the option list without committing route state;
- selecting/removing, Back/Forward, and reload retain existing behavior;
- production-derived closed and open screenshots stay within the established
  strict visual tolerances.

Run the focused regression first, then the Library multiselect and advanced
Library suites, desktop/mobile visual coverage, ESLint, and Nuxt type-check.

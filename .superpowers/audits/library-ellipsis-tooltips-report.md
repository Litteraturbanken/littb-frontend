# Library ellipsis tooltip parity report

## Outcome

Restored the legacy delayed full-title and full-author hover/focus details for the
Nuxt Library's Works, Latest, EPUB, PDF, and Parts rows without changing their
visible labels, ellipsis layout, links, or role suffixes.

The implementation uses the copied Bootstrap tooltip DOM/classes (`tooltip top
in`, `tooltip-inner`, and `tooltip-arrow`) and the legacy 500 ms delay. It is a
page-local Vue directive attached to the existing focusable title and author
controls, so it adds no wrapper or layout shift. Tooltip content is assigned
with `textContent`; HTML is never interpreted.

## Typed model boundary

- Each Works/Latest/EPUB/PDF row model now retains `titleTooltip` and
  `authorTooltip` separately from the short display title and surname.
- Full titles must be distinct, already trimmed, free of control bytes, and at
  most 500 characters.
- Author labels use the retained `full_name`, `birth.plain`, and `death.plain`
  fields and reproduce legacy labels such as `Hjalmar Söderberg (1869-1941)`.
- Missing/equal/placeholder/unsafe/oversized values produce no tooltip.
- Fixtures freeze differing title fields and author years across Works, Latest,
  EPUB, and PDF; editor `(red.)` and illustrator `(ill.)` remain separate display
  suffixes.

## Lifecycle and accessibility

- Hover and keyboard focus both start the 500 ms delay.
- Mouse leave and blur remove the tooltip immediately.
- Directive updates, route-driven row replacement, and unmount clear timers,
  popup DOM, and `aria-describedby`.
- No global scroll/resize listener is installed per row, and elements without
  useful tooltip content receive no listeners.
- SSR emits only sanitized metadata attributes; popup DOM is client-only and
  deterministic, avoiding hydration differences.

## TDD evidence

RED:

- `library.behavior.spec.ts --grep "restores delayed full title"`: 4/4 failed
  because Works, Latest, EPUB, and PDF had no tooltip triggers.

GREEN:

- Focused tooltip E2E: 4 passed.
- Full `library.behavior.spec.ts` desktop E2E: 50 passed.
- Full `library.visual.spec.ts` desktop project: 7 passed.
- Full `test/ssr/library.spec.ts`: 72 passed.
- `test/unit/library-tooltip.spec.ts`: 3 passed.
- `yarn typecheck`: passed.
- `git diff --check`: passed.

The E2E coverage verifies hidden-before-delay, full title content, keyboard-focus
author/year content, leave/blur/route cleanup, retained ellipsis CSS, unchanged
editor suffix, one visible request, and no browser/hydration errors.

## Review follow-up

An independent review found that the initial directive treated hover and focus as
a single trigger: leaving with keyboard focus still active (or blurring while
still hovered) hid the tooltip. A new crossed-state E2E failed on that exact
focus → hover → leave sequence before the fix. The directive now tracks hover
and focus independently, retains one pending timer or popup while either remains
active, and hides only after both have ended. The focused regression passes 1/1
and the final full Library behavior suite passes 50/50.

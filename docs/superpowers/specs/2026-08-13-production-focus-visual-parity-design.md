# Production focus visual parity design

## Context

The Nuxt staging site currently applies the keyboard focus treatment introduced in commit `2892d1b6` and expanded site-wide in `0115f935`: a two-tone ring built from a 2px white outline and dark outer edge. The first colleague demo should instead match the current production presentation so the migration can be evaluated without a conspicuous new visual treatment.

A live browser comparison on the Library page established the concrete authority. After keyboard navigation to “Visa utökad sökning,” production keeps the control focused and matching `:focus-visible` while computing no visible outline; staging renders the new 2px white outline with a 2px offset.

## Goal

Restore production-equivalent focus visuals across the migrated default and Reader layouts for the demo while preserving focus behavior and assistive-technology semantics.

## Non-goals

- Changing tab order, keyboard activation, or native focus ownership.
- Changing `tabindex`, roles, accessible names, ARIA state, or route-announcement behavior.
- Introducing a runtime flag, user preference, or alternative focus-ring design.
- Redesigning component-specific hover, active, selected, or validation styles.
- Claiming that a hidden visual focus indicator is itself exposed to a screen reader; screen readers retain the focused DOM control and its semantics, not CSS pixels.

## Design

The current production site is the visual authority. Restore the legacy production focus cascade from before the Nuxt focus-ring work:

- stop importing the shared focus override into the default and Reader style bundles;
- restore the legacy blanket focus suppression and the original default-layout and Reader selectors;
- restore the original active-button, Library input, and Dramawebben control styling that was changed specifically to expose the shared ring;
- remove the two-tone proxy ring from the transparent Library gender select while keeping the select keyboard-focusable;
- restore the previous Dramawebben filter-control focus styling; and
- remove the now-unused shared focus partial.

This is preferable to adding a new override because it restores the established production cascade instead of layering another exception on top. It is preferable to a demo feature flag because no second visual mode or deployment configuration is required. The Reader slider's separate component-specific indicator is not part of the shared two-tone treatment and remains unchanged.

No template, component behavior, route, data, or API code changes. Native controls remain in the same tab sequence and `document.activeElement` continues to move as before. Existing screen-reader semantics therefore remain unchanged.

## Testing

Use test-driven development for the behavior change.

1. Update the focused browser authority first and verify it fails against the current staging CSS. Representative default-layout, Library, Reader, and Dramawebben controls must still be reached by keyboard navigation, but must not render the two-tone shared ring. The transparent Library gender select must remain focused while its proxy remains visually unchanged.
2. Apply the minimal CSS parity change and rerun the focused browser tests.
3. Run the relevant foundation/style ownership tests to ensure the restored cascade is intentional and tracked.
4. Run scoped lint, typecheck, the relevant browser suites, and a production build.
5. In a real browser, compare production and the changed app on the same Library focus target and confirm that both retain keyboard focus without the staging-only ring.

Tests must continue to assert actual keyboard reachability; they must not merely check that CSS contains `outline: none`. Dedicated accessibility tests for navigation semantics, target size, native roles, and the route announcer remain intact.

## Rollout and reversal

Ship as a normal frontend change and deploy to staging for the colleague demo. The change is intentionally a visual rollback, not removal of the accessibility work from project history. The stronger focus treatment can be reintroduced later with a less distracting design after the demo.

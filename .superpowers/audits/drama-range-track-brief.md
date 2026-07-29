# Dramawebben range-track parity brief

## Objective

Restore legacy pointer behavior for all six double-ended `Akter och roller` sliders on `/dramawebben/pjäser`: clicking a bare point on a track must move the closest handle to that value and commit the corresponding route query exactly once.

## Current root cause

- `nuxt/app/pages/dramawebben/pjäser.vue` renders two overlapping native ranges per field.
- The inputs intentionally use `pointer-events: none` while their WebKit thumbs use `pointer-events: auto`, which keeps native thumb dragging possible but means a bare track click has no handler.
- `setRange` supports query commits, but there is no track pointer handler.
- The Library chronology range at `nuxt/app/pages/bibliotek.vue` demonstrates the intended nearest-endpoint selection and tie behavior.

## Required behavior

- Add a bare-track pointer contract without breaking native thumb drag or keyboard operation.
- Convert horizontal pointer position to the nearest bounded integer using the actual rendered track geometry and handle inset.
- Choose the endpoint with the smaller absolute distance. On an exact tie choose the upper (`to`) endpoint, matching the already verified Library behavior.
- Clamp endpoints so `from <= to`; do not swap the unrelated endpoint.
- Focus the chosen native range without scrolling.
- One bare click produces exactly one route mutation and preserves all unrelated/repeated query parameters.
- Apply identically to every key in `rangeFields` and keep the existing visuals unchanged.
- Ignore non-primary buttons and pointer events originating on a thumb/input or other descendant rather than the bare track.

## Tests

- Add a failing Playwright test first in the existing Dramawebben behavior suite.
- Cover: nearer lower handle; nearer upper handle; exact tie chooses upper; edge clamping; selected slider focus; exactly one history mutation; unrelated repeated query preservation; native keyboard/thumb behavior remains functional.
- Run the focused Dramawebben behavior test, relevant unit/SSR checks, and typecheck. Demonstrate red/green.

## Constraints

- Frontend repo `/Users/johan/.codex/worktrees/8c5c/littb`.
- Use `apply_patch`; preserve unrelated dirty files; stage/commit only task-owned files.
- Do not stop Nuxt 3020 or backend 8000. Use isolated high test ports and `NUXT_IGNORE_LOCK=1`.
- Write report `.superpowers/audits/drama-range-track-report.md` with status, commit, tests, and concerns.

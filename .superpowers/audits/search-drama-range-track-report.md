# Search and Drama range-track parity report

## Status

Implemented and verified in frontend commit `3b864102` (`fix(nuxt): restore range track selection`).

Review follow-up commit `1d29fd80` (`fix(nuxt): cancel lost range pointers`) adds guarded
`lostpointercapture` cancellation to both pages. Search resets an interrupted draft, Drama
discards the interrupted endpoint, and a normal pointerup remains authoritative because its
finish handler clears active state before the browser's implicit capture-loss event.

The Text Search chronology and all six Dramawebben `Akter och roller` ranges now:

- convert a bare-track primary pointer position through the rendered track geometry and thumb inset;
- move the nearest endpoint, choosing the upper endpoint on an exact tie;
- clamp the selected endpoint without moving or swapping the other endpoint;
- focus the chosen native range without scrolling;
- commit one route navigation while preserving unrelated and repeated query values;
- ignore non-primary and descendant/native-input pointer starts;
- retain native range change and keyboard behavior.

No visual CSS or layout rules changed, and the behavior remains page-local in each `script setup`.

## TDD evidence

The focused test command was run before production changes. The new Drama tests failed because the range containers had neither the new track selectors nor pointer behavior; the run was stopped after both new Drama cases had demonstrated RED.

After implementation:

- focused range E2E: 4 passed;
- full affected desktop E2E (`text-search.behavior.spec.ts` and `dramawebben.behavior.spec.ts`): 64 passed;
- Text Search SSR: 26 passed;
- Dramawebben SSR: 26 passed;
- Vitest unit suite: 35 files, 1080 tests passed;
- `yarn typecheck`: passed;
- `git diff --check`: passed.

Review follow-up verification:

- capture-loss RED: Search retained draft `1400`; Drama later committed stale `40,120`;
- focused range E2E after the fix: 6 passed;
- full affected desktop E2E after the fix: 66 passed;
- `yarn typecheck` after the fix: passed;
- `git diff --check` after the fix: passed.

The Drama pointer tests now derive their vertical click coordinate from the rendered native
range input's center line, rather than the bottom padding of the 48px containing element.

## Test harness note

`test/ssr/text-search.spec.ts` currently hardcodes fixture port `4100`. A combined isolated SSR run using fixture port `45230` therefore produced connection-refused errors only in that file, while all Drama SSR cases passed. Rerunning Text Search with its required port `4100` passed all 26 cases. No production change was made for this pre-existing harness limitation.

## Concerns

None for this change. The report is intentionally left outside the isolated code commit so the commit contains only the two page implementations and their focused E2E coverage.

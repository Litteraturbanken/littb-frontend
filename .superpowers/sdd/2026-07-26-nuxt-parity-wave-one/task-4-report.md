# Task 4 report — Reader navigation/OCR and slider parity

## Outcome

Reader page changes now keep the existing shell mounted, advance a synchronous route draft for every intent, serialize ordinary Nuxt Router pushes, and trail page-content loading by exactly 200 ms on the client. Searchable facsimiles always carry their transparent selectable OCR overlay; `?ocr` changes only the presentation class, and marker queries reuse the same overlay for highlighting. The Library chronology track now moves the nearest handle, selects the upper handle on an exact tie, and commits once. The Reader's native single-range track already met the required bare-track behavior, so it remains native.

## Root causes and implementation

- Page navigation previously derived its target from retained response data. Rapid intents therefore reused a stale page while earlier navigation/fetch work was pending. The Reader now maintains a synchronous page draft and a serialized `router.push` chain, producing one history entry per intent.
- Route identity was tied directly to `useAsyncData`, so every route change fetched immediately and could remount route-owned Reader state. The page key is now stable for a Reader work/media shell, retained content stays visible, and only a 200 ms trailing fetch identity triggers client page-content loading. SSR and first hydration still resolve immediately.
- OCR loading was conditional on `?ocr` or marker state. The server now fetches `ocr_${pageIndex.padStart(5, "0")}.html` whenever the resolved facsimile is searchable, using the raw zero-based page index. Non-searchable facsimiles make no OCR request.
- The Library's two native range inputs did not reproduce angularjs-slider track clicks. Pointer coordinates are converted to a bounded integer year and routed to the nearest draft handle; inspection of angularjs-slider 7.0.1 confirmed that an LTR tie selects the max/upper handle.
- The Reader's bare native range behavior passed desktop and mobile characterization after bringing the off-screen mobile control into view. No redundant production pointer layer was added.

## TDD evidence

RED:

- The rapid-navigation regression sent three next-page intents inside 200 ms and ended at `/sida/-3` instead of `/sida/-1`, proving targets were derived from stale retained content and navigation was not queued correctly.
- Ordinary searchable facsimile API/browser regressions received `ocrOverlay: null` without `?ocr`, proving OCR was incorrectly query-gated.
- Library bare-track regressions observed zero route pushes, proving native dual-range track clicks did not implement the legacy nearest-handle interaction.
- The Reader bare-track regression passed before production changes on desktop; on mobile its first version clicked off-screen coordinates. After adding `scrollIntoViewIfNeeded`, it passed as a valid native-behavior characterization.
- Isolated staged-tree browser verification initially failed three Reader hydration checks and the production-key notice because the auto-imported shared `LegacyNotice.vue` prerequisite had not been staged. Adding that public Reader prerequisite made the same six-test command pass completely.

GREEN:

- Rapid inputs produce draft routes `-4 → -3 → -2 → -1`, preserve a sidebar sentinel, show no loading notice, start no resource before at least 195 ms from the last navigation callback while production uses an exact `setTimeout(..., 200)`, request only final-page metadata/HTML, and allow Back through `-2`, `-3`, and `-4`.
- Ordinary searchable and `?ocr` facsimiles show the scan plus one transparent/selectable OCR layer; marker state highlights that overlay; navigation fetches the destination page-index OCR; a non-searchable fixture requests no OCR.
- Library clicks near each chronology handle change only that handle; an equidistant click chooses the upper handle; each gesture contributes one history entry. Desktop and mobile focused cases pass.
- Reader bare-track desktop and mobile characterization passes with one integer preview and one commit.
- Initial direct Reader SSR is complete and the browser regressions are hydration/console clean.

## Fresh isolated-index verification

The staged index was exported to detached worktree `/tmp/littb-reader-staged` at verification commit `07e06e33`, with the original dependency directories symlinked read-only for execution. This ensures unrelated dirty worktree files cannot hide a compile or runtime dependency.

- `yarn typecheck` — passed (`Done in 4.31s`).
- `yarn vitest run test/unit/production-shortcuts.spec.ts test/unit/reader-dictionary.spec.ts test/unit/reader-dramawebben-navigation.spec.ts test/unit/reader-final-parity.spec.ts test/unit/reader-routes.spec.ts test/unit/reader-source.spec.ts test/unit/text-search-navigation.spec.ts` — 7 files, 148 tests passed.
- Focused desktop browser parity command over Reader behavior/final-parity/production and Library advanced — 6 tests passed: rapid navigation/debounce, Reader bare track, chronology nearest/tie-upper track, ordinary searchable OCR, OCR presentation/navigation, and production keys.
- `npx playwright test test/ssr/reader-final-parity.spec.ts test/ssr/reader.spec.ts --project=ssr` with isolated ports — 95 tests passed, including immediate direct SSR, searchable/non-searchable OCR, exact Reader rendering, and the existing search-marker coverage.
- Earlier live-worktree focused parity verification passed 10/10 Reader SSR/behavior tests. Focused mobile Reader bare-track, rapid-navigation, and chronology cases also passed.
- `git diff --cached --check` — passed.

## Consolidation and scope audit

Included is the coherent public Reader subsystem specified by the brief: Reader page/components/styles, route/dictionary/search-return helpers, public Reader API/source/OCR/types, the Reader horizontal-scroll plugin required by its typed page-ready hook, public production-shortcut notice/helper, Reader fixtures/tests/baselines/authority plans, and narrowly staged generated dictionary API declarations. Library changes are restricted to chronology nearest-handle behavior and its regression. The shared fixture server and Playwright config were staged by hunk for Reader endpoints/data and the mobile chronology test only.

Explicitly excluded are editor-reader pages, APIs, types, tests, and captures; Quick Search developer context; bibliography/author/profile work; unrelated global layout/config/style work; unrelated Search changes; and unrelated fixture-server hunks. The mixed Reader page retains an unstaged Quick Search developer-context block, which the isolated-index verification proves is not a dependency.

## Concerns

- Deterministic fixture coverage mirrors the supplied Boye page's searchable-facsimile contract, including raw zero-based OCR filename selection. The actual `/författare/BoyeK/titlar/EttVerkligtJordiskt/sida/3/faksimil` page was not exercised against a live production backend in this workspace, so production asset availability remains an external integration check.
- One combined desktop Library advanced run transiently counted six requests where the assertion expected five; the final route was correct and an isolated rerun passed. The focused nearest-handle desktop and mobile regressions are stable and pass.

Commit subject: `fix(reader): restore navigation and OCR parity`.

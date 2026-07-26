# Editor Reader tools parity report — 2026-07-26

## Scope

Restored the four working Reader tools on `/editor/{lbid}/ix/{ix}/{alias}` without adding a page-specific composable or expanding the Editor DTO/backend contract beyond the already-approved contributor/part/source/search identity.

## Result

- `Innehållsförteckning` reuses `ReaderContentsDialog`, retains raw query bytes, maps part selections to Editor raw indexes, and restores focus to its trigger when closed.
- `Mer om boken` reuses `ReaderSourceInfoDialog` and the existing typed source-info server endpoint. Requests are identity-scoped and abort on route changes; incomplete metadata leaves the control absent.
- `Läsfokus` reuses `ReaderFocusControls`, preserves raw repeated/bare query parameters and fragments, supports Editor page navigation and facsimile sizing, and restores the established e-text scaling/night controls.
- `Sök i verket` restores the legacy disclosure UI and options, uses the generated typed `/works/{work_id}/search-hits` client, aborts stale requests, and routes the first result to its Editor raw index with Nuxt history.
- No full-document navigation was introduced. Existing raw Editor paging and metadata-failure behavior remain intact.

## Verification

Fresh verification in the shared worktree:

```text
yarn typecheck
Done in 4.77s.

Playwright Editor SSR + desktop + mobile suites
38 passed (32.5s)
```

The focused coverage includes SSR source-dialog rendering and fallback links; hydration; Escape, backdrop, focus return; repeated raw query preservation; compact aliases; search result navigation; atomic metadata failure; and mobile keyboard accessibility.

## Search-state follow-up

Independent review found that the first implementation navigated to a shallow `q`/`hit` URL but did not restore the legacy hit session. The follow-up now serializes and validates the live `show_search_work`, `s_*`, `hit_index`, `traff`, and `traffslut` model; renders the search toolbar; marks the selected OCR range; and supports previous/next, first/last, direct-hit, close, reload, Back, and Forward behavior. Requests remain typed, bounded, identity-scoped, abortable, and fail closed.

The Editor now also uses the same OCR loader as the ordinary Reader. This restores the real `lb8345227` overlay from the content source (including work-scoped IDs such as `lb8345227_501`) instead of probing the obsolete editor-source OCR path. A live local SSR check for `lb8345227`, query `brev`, hit 3/page 5 returned 237 hits and rendered `lb8345227_501` with `markee`.

Fresh follow-up verification: `yarn typecheck` passed, and the complete Editor SSR/desktop/mobile suite passed 42/42.

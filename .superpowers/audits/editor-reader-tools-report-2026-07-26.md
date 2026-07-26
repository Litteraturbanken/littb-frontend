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

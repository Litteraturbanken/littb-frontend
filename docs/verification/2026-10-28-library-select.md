# Library select and multiselect appearance

Compared the production library's Select2 author-gender menu with the new
Headless UI Listbox in a real browser on 2026-10-28.

| Property | Production | Headless UI |
| --- | --- | --- |
| Desktop control | 350 × 31 px | 350 × 31 px |
| Dropdown | 350 × 94.5859375 px | 350 × 94.5859375 px |
| Option | 348 × 31.1953125 px | 348 × 31.1953125 px |
| Dropdown offset from control bottom | -2 px | -2 px |
| Option padding | 6 px | 6 px |
| Option font | Requiem Text SC, 16 px / 19.2 px | Same |
| Active background | #ededed | #ededed |
| Selected background | #ddd | #ddd |
| Control border | 1 px #999 | Same |
| Dropdown border | 1 px #333, no top border | Same |

Headless UI owns opening, selection, keyboard navigation, Escape, outside clicks,
and focus restoration. Removed the invisible native-select overlay and its
pointer-focus bookkeeping. The control remains route-owned, including history
and reload restoration.

For grouped library and EPUB multiselect options, moved the 16 px outer indent
into the option's left padding (8 → 24 px). This preserves label placement while
allowing the grey background to cover the complete parent row. Measured active
option and parent edges coincide. Disabled narrowing options remain text-only.
The real-data live suite now asserts full-width active backgrounds for every
multiselect, including virtualized search options.

## Verification

- 30 library component unit tests passed.
- 56 advanced-library integration cases passed across desktop and mobile.
- All 10 focused multiselect parity and advanced-filter SSR cases passed across
  the final runs, including corrected existing control-position assertions.
- All 28 real-data multiselect and single-select cases passed locally in desktop
  and touch browser contexts.
- Added the single-select interaction and geometry checks to the normal Stage
  live deployment gate, including screenshot capture.

## Existing broad-suite failures

Re-ran the failing broad tests with both changed application files restored to
committed HEAD, then restored the in-progress edits in a finally block. Eight
failures reproduced unchanged. One was an outdated selected-row geometry
assertion (control y=283.375 instead of the already-existing 288.375); corrected
that assertion and its arrow position. The other seven remain outside this change:

- Two EPUB tooltip cases match both desktop and mobile author elements, causing
  a strict-locator error.
- Two mobile download-format popover cases fail viewport/anchor bounds checks.
- Three SSR cases expect obsolete author text or lifespan punctuation.

A separate Vite dependency-optimization transient disappeared on the focused
rerun. No application behavior was changed to accommodate these unrelated tests.

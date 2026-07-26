# Reader small parity implementation report

Date: 2026-07-26

Scope: findings 2, 3, 4, and the title-tooltip half of finding 5 from
`reader-remaining-parity-2026-07-26.md`. Faksimil hit navigation and Reader 404 copy
remain outside this slice.

## Implemented behavior

- Escape exits `?fokus` through the existing `closeFocus()` replacement path.
  Editable targets and open Reader dialogs retain Escape ownership. Raw query bytes,
  repeated parameters, empty parameters, fragments, history length, and Reader request
  identity are preserved.
- Faksimil rotation persists when changing pages and when using Back within the same
  work/media Reader session. A page/source change still clears only the image error.
  Entering another media session remounts the Reader and resets rotation.
- Validated internal source-info author and read-action URLs render as `NuxtLink` and
  participate in client router Back/Forward history. Download actions, Libris, URN,
  licenses, provenance links, and other external URLs remain ordinary anchors.
- The existing Reader sidebar title anchor now exposes the full title after the legacy
  500 ms delay when it differs from the displayed title. The popup is text-only,
  wrapper-free, supports hover and keyboard focus independently, never duplicates, and
  is omitted for equal titles. The progressive-enhancement fallback exposes the same
  bounded tooltip text as metadata.

## Root causes

- No Reader key handler owned Escape for focus mode.
- Rotation and per-image failure were reset together by page identity, although only the
  latter is page-local.
- Source-info author/read actions retained legacy anchors despite server-side validation
  guaranteeing normalized internal paths.
- `reader.fullTitle` was already available but unused by the sidebar title.

## Regression coverage

- Desktop and mobile focus exit plus editable/dialog guards.
- Raw query preservation, one replace mutation, unchanged history length, and empty
  Reader request ledgers.
- Rotation persistence on Next and Back, image-error clearing, and reset after another
  media session.
- Author/read client navigation, Back/Forward, and an empty document-request ledger.
- Tooltip delay, text-only content, both mixed focus/hover lifecycles, no duplicate,
  equal-title omission, and SSR fallback metadata.

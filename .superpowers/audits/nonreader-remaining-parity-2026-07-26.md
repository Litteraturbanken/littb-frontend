# Remaining non-Reader parity audit — 2026-07-26

## Scope and exclusions

Read-only comparison of the Nuxt application at `http://127.0.0.1:3020` against the current Angular deployment at `https://litteraturbanken.se` and the checked-in Angular source. The audit covered the shared shell/home navigation, author introduction/works/more pages, managed author documents, About/Help/Contact/Statistics, ID lookup, presentations, and the editor route.

Excluded because they are already fixed or owned by another active slice: the ordinary Reader, Search reset/groups/range, Library title ellipsis/editor labels, EPUB inactive counts/pagination, and Drama source/range work.

Only reproduced or source-proven differences are listed below. Home and Statistics produced the same headings, managed-content links, main-navigation labels, and visible controls in the targeted live/local comparisons, so they do not appear as findings.

## Proven differences

### 1. High — the real editor loses contributors, work/part context, and the working Reader tools

**Route tested**

```text
/editor/lb8345227/ix/0/f
```

This is Karin Boye's *Ett verkligt jordiskt liv. Brev* and is a useful authority case because it has an editor contributor and multiple parts.

**Visible live/local evidence**

On the live Angular route the visible right sidebar contains:

- linked contributors `Karin Boye` and `Paulina Helgeson red.`;
- the current work/part title `Ett verkligt jordiskt liv. Brev`;
- a disabled previous-part control but an enabled `Gå till nästa del` link to raw editor index `4`;
- `Gå till första sidan` mapped to raw editor index `2`, the work's actual start page;
- working `Innehållsförteckning`, `Mer om boken`, `Läsfokus`, and `Sök i verket` links.

On the local Nuxt route:

- only `Karin Boye` is rendered; Paulina Helgeson's editor contribution is absent;
- the current-part area is empty;
- both part controls are hard-coded disabled `<span>` elements;
- `Gå till första sidan` targets raw index `0`, not the mapped start index `2`;
- `Mer om boken`, `Läsfokus`, and `Sök i verket` are inert `<span>` elements, and `Innehållsförteckning` is absent.

The local document title is also `Ett verkligt jordiskt liv. Brev sida 0 | Litteraturbanken`, while the live route's title is `Ett verkligt jordiskt liv. Brev sida faksimil | Litteraturbanken`. This metadata difference is low severity by itself, but it comes from the same flattened editor model.

The size and rotation controls, facsimile URL, close-editor link, last-page control, raw slider, and author-search link were present locally; they are not part of this finding.

**Root-cause evidence**

- `nuxt/shared/types/editor-reader.ts` exposes only one `authorId`/`authorName`, with no ordered contributors, contribution roles, part records, mapped start/end indices, contents, source-info identity, or in-work-search model.
- `nuxt/server/api/editor/[lbid]/[ix]/[mediatype].get.ts` takes only `representation.authors[0]`, ignores the rest of the author-role data, and does not parse the work's parts/pagemap into the DTO.
- `nuxt/app/pages/editor/[lbid]/ix/[ix]/[mediatype].vue` literally renders both part controls as disabled spans and the source/focus/search entries as spans. Its first-page target is `pageIndexes?.[0] ?? 0`, which becomes raw zero whenever `page_count` exists even if the actual work starts later.
- The Angular authority obtains full work info, builds `pagemap`, resolves current/previous/next parts, and uses the ordinary Reader's contents/source/focus/search paths (`app/scripts/components/reader/reading_controller.js:506-678, 836-906`; `app/scripts/components/reader/reader.html:111-158, 230-274`).

**Bounded implementation slices**

1. Extend `EditorReaderPage` and its server loader with ordered contributors/roles, current part, previous/next part raw indices, actual first/last readable indices, and the minimal contents/source/search identity already present in the raw work record. Keep the existing metadata-failure fallback honest and raw-only.
2. Render contributors with the existing `ReaderContributors` conventions and restore mapped current/part/first-page navigation while keeping all editor navigation on `/editor/{lbid}/ix/{ix}/{alias}` through the Nuxt router.
3. Reuse the existing Reader Headless UI contents/source dialogs and Reader focus/search controls from the editor page; keep state page-local rather than adding an editor-only composable.
4. Add one real frozen multi-part, multi-contributor editor fixture derived from `lb8345227`, then cover SSR hydration, each dialog/control, route history, stale requests, compact aliases, and metadata failure.

**Test-only gap that allowed this**

`nuxt/test/e2e/editor-reader.visual.spec.ts` explicitly expects both part controls to be disabled, and the editor behavior suite calls zero-based raw navigation the authority. The deterministic editor fixture has no meaningful parts or second contributor and never asserts contents/source/focus/search interactions. The existing green screenshot therefore proves only the simplified fixture, not a representative live editor work. Ordinary Reader tests already cover these features, but none require them on `/editor`.

---

### 2. Medium — author introductions omit the legacy “Texter om …” link even when the page exists

**Route tested**

```text
/författare/BoyeK
```

**Visible live/local evidence**

The live `Mer om författarskapet` panel visibly contains:

```text
Texter om Karin Boye
Presentation
Litteraturkartan
```

The local Nuxt panel contains only:

```text
Presentation
Litteraturkartan
```

The local destination `/författare/BoyeK/mer` is implemented and currently renders non-empty `Verk om Karin Boye` and `Kortare texter om Karin Boye` sections, so the missing link is not caused by missing content or an unavailable route.

**Root-cause evidence**

- Angular's `hasMore()` aggregates the four asynchronously loaded `moreStruct` sections and conditionally emits `Texter om {full_name}` (`app/scripts/components/author-info-page/index.js:247-250, 317-353`; `app/views/authorInfo.html:87-92`).
- Nuxt renders only `profile.relatedLinks` in `AuthorProfileContent.vue`.
- The typed `AuthorProfile` contract has no `has_more`/about-content flag. Backend `_related_links()` in `/Users/johan/dev/lb-backend/lbapi/v2/authors.py` includes presentation, bibliography, and static external references only; it cannot express the Angular condition.

**Bounded implementation slice**

Add a typed `has_more` boolean to `AuthorProfile`, calculated server-side with a bounded existence query across the same four about-author categories (not by returning the full works payload). Regenerate the Nuxt client, map it into `AuthorProfileView`, and prepend `/författare/{author}/mer` to the `Mer om författarskapet` panel only when true. Preserve the current single page-local profile fetch.

**Test-only gap that allowed this**

The author-profile fixture's `related_links` contains only static profile links. The visual capture reconstructs Angular `external_ref` from those same fixture links and never supplies non-empty `moreStruct` data, so Angular also omits `Texter om …` in the deterministic comparison. Author-works tests verify the link on the `/titlar` and `/mer` surfaces, but no profile test asserts the real introduction-panel condition.

---

### 3. Medium/low — shared `h`/`b` navigation and pasted-lbid shortcuts were not migrated

**Reproduction**

From `/om/statistik`, with no form control focused, pressing `h` navigated the live Angular page to `/historik`. The same keypress left the local Nuxt page at `/om/statistik`.

**Source evidence for the rest of the same shared behavior**

The global Angular handler in `app/scripts/controllers.js:26-56` also:

- sends `b` to the current remembered Library URL;
- sends `h` to `/historik`;
- on an unfocused paste containing one `lb…` identifier, opens `/editor/{id}/ix/0/f`;
- on a paste containing multiple identifiers, opens Library with an `lbworkid:… OR …` filter.

Nuxt has only route-specific keyboard handlers plus the global Quick Search `s` handler in `QuickSearch.vue`; there is no layout/global `b`, `h`, or paste listener.

**Root-cause candidate**

The shell port moved Quick Search's shortcut into its component but did not port the separate document-level handler from `controllers.js`.

**Bounded implementation slice**

Add one client-only listener owned by the default layout (no single-use composable). Preserve the Angular editable-control/modifier guards, add `contenteditable` and open-dialog guards, use `navigateTo`/Nuxt Router so Back works, and use the existing remembered `libraryHref` for `b`. Add focused-input, modal, repeated-query, paste-one, paste-many, and Back/Forward coverage.

The legacy F19 host-switch and F20/red-editor shortcuts are editorial/deployment conveniences and are intentionally not included in this user-facing slice; the reproducible public `b`/`h`/paste behavior is independently bounded.

**Test-only gap that allowed this**

Quick Search tests cover `s` and editor/author developer commands. No shell test exercises the independent `controllers.js` `b`/`h`/paste listener or its editable-target guards.

## Recommended order

1. Restore the editor metadata/part model, because the modal controls depend on it.
2. Restore editor contents/source/focus/search interactions using the already-migrated Reader components.
3. Add the author-profile `has_more` contract/link.
4. Restore the bounded shared shell shortcuts.

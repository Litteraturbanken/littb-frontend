# Typed Author Works Design

**Date:** 2026-07-17

## Goal

Port the literal Author works routes `/författare/{author}/titlar` and
`/författare/{author}/mer` to Nuxt without changing their content, appearance,
or link behavior. Both pages use one strict, display-ready FastAPI v2 operation.
The backend continues to fetch the indexed HTML-era work records from the same
provider, but raw OpenSearch documents and Angular grouping rules do not cross
the new API boundary.

This slice does not port `/semer`: that route is managed `/red` HTML and belongs
to the later managed-document family.

## Selected architecture

`GET /v2/authors/{author_id}/works` returns the author shell plus all six
authored sections and four about-author sections. This mirrors Angular's eager
page load while reducing it to one SSR request from Nuxt.

The alternatives were rejected:

1. Calling the ten legacy endpoints from Nuxt would expose loose OpenSearch
   shapes, repeat Angular grouping logic, and prevent useful generated types.
2. One endpoint per section would create ten SSR requests without producing a
   better browser interaction; the existing pages are not lazy accordions.
3. Adding works to `AuthorProfile` would couple editorial profile HTML to a
   large, independently changing search result. A separate operation keeps the
   contracts bounded.

Each Nuxt page fetches directly in its own `<script setup>`. A shared
presentational `AuthorWorksContent.vue` is appropriate because `/titlar` and
`/mer` render the same listing DOM. There is no works composable or store.

## Strict v2 contract

### Operation

```text
GET /v2/authors/{author_id}/works
```

Operation ID: `v2_get_author_works`.

`author_id` uses the established `ProfileAuthorId` validation. A missing or
hidden author is 404, an invalid ID is 422, an unavailable OpenSearch provider
is 503, and malformed/conflicting provider data is the existing non-leaking
500 envelope. A visible author with no works is a valid 200 response with ten
empty sections.

### Response

All models inherit the strict v2 base model and every key is required. Absence
is represented by `null` or an empty list, never by an omitted property.

```python
AuthorWorkSectionKind = Literal[
    "main", "part", "photographer", "illustrator", "editor", "translator",
    "about", "about_part", "about_editor", "about_translator",
]

class AuthorWorksPerson(V2Model):
    author_id: str
    name_for_index: str
    surname: str | None
    url: str

class AuthorWorksShell(V2Model):
    author_id: str
    full_name: str
    birth_year: str | None
    death_year: str | None
    has_introduction: bool
    has_dramawebben: bool
    search_url: str | None
    audio_url: str | None
    map_url: str | None
    portrait: AuthorPortrait | None
    related_links: list[ProfileLink]
    encyclopedia_links: list[ProfileLink]

class AuthorWorkReadAction(V2Model):
    kind: Literal["read"]
    media_type: Literal["etext", "faksimil", "infopost"]
    url: str
    download_filename: None

class AuthorWorkDownloadAction(V2Model):
    kind: Literal["download"]
    media_type: Literal["epub", "pdf"]
    url: str
    download_filename: NonEmptyTrimmedString

AuthorWorkAction = Annotated[
    AuthorWorkReadAction | AuthorWorkDownloadAction,
    Field(discriminator="kind"),
]

class AuthorContainingWork(V2Model):
    title: str
    author: AuthorWorksPerson

class AuthorWork(V2Model):
    work_id: str
    title_id: str
    title_path: str
    title: str
    short_title: str | None
    title_tooltip: str | None
    title_url: str
    imprint_year: str | None
    display_author: AuthorWorksPerson | None
    containing_work: AuthorContainingWork | None
    actions: list[AuthorWorkAction] = Field(min_length=1, max_length=5)

class AuthorWorkSection(V2Model):
    kind: AuthorWorkSectionKind
    label: str
    show_author: bool
    items: list[AuthorWork]

class AuthorWorksResponse(V2Model):
    author: AuthorWorksShell
    authored_sections: list[AuthorWorkSection] = Field(min_length=6, max_length=6)
    about_sections: list[AuthorWorkSection] = Field(min_length=4, max_length=4)
```

The transformer enforces the exact section order rather than trusting callers:

```text
authored: main, part, photographer, illustrator, editor, translator
about:    about, about_part, about_editor, about_translator
```

Labels remain the current Swedish copy. `show_author` is false only for `main`
and `part`. `display_author` is populated only for displayed-author sections.
The dynamic first about label is `Verk om {full_name}` and the second is
`Kortare texter om {full_name}`.

`title` is the full source title and `short_title` is the optional visible short
title. The literal Angular inequality is preserved: `title_tooltip` is the full
title whenever `short_title != title`, including when `short_title` is null;
otherwise it is null. `title_url` is the exact legacy primary destination: the
first readable representation plus `?om-boken`, otherwise the first download,
while infopost uses its own destination unchanged.

The action union is discriminated by `kind`, so generated TypeScript cannot
represent EPUB as readable, e-text as downloadable, a read action with a
filename, or a download without a filename. The visible media label is exactly
`media_type`; no independently disagreeing `label` property exists.

## Provider boundary

The operation performs one selected-field author-shell lookup, ten bounded work
searches, one bounded Litteraturkartan existence query, and one exact WordPress
audio-page lookup. It calls isolated provider helpers; it does not reproduce
their OpenSearch DSL in the route. The external audio request has a finite
timeout and validates a JSON array of exact slug records. The map and audio
probes are optional, independent enhancements in Angular: their OpenSearch,
transport, or invalid-response failures therefore produce a null URL while the
author and works still return 200. Core author/work provider failure remains
typed 503 and malformed core data remains non-leaking 500. This asymmetry is
explicitly tested so an auxiliary outage cannot make the listing less
available than Angular.

The six authored searches are:

1. whole works for author types `main, scholar`;
2. parts in other works;
3. photographer whole works/parts;
4. illustrator whole works/parts;
5. editor whole works/parts;
6. translator whole works/parts.

The four about searches are:

1. whole works about the author;
2. parts about the author;
3. whole works about the author as editor;
4. whole works about the author as translator.

Whole-work searches retain the legacy 10,000 ceiling; part searches retain the
1,000 ceiling. Provider totals above a ceiling are rejected instead of silently
returning an incomplete public response.

`elasticapi.list_parts_in_others_works` gains backward-compatible keyword-only
`includes`, `excludes`, `limit`, and `sort_field` parameters. Existing three
positional arguments and the default 1,000-row behavior remain unchanged. This
preserves the subtle ordinary/about query as a single authority.

Selected fields are deliberately narrow:

- identity/title: `lbworkid`, `titlepath`, `titleid`, `work_titleid`, `title`,
  `shorttitle`, `sortkey`;
- display/media: `imprintyear`, `mediatype`, `startpagename`, `workshorttitle`;
- `authors`, `work_authors`, and `main_author` subfields `authorid`,
  `full_name`, `name_for_index`, `surname`, and `type`;
- whole-work `export.type` and `export.size`;
- only the main about query additionally requests `keyword` so the existing
  `LB-författarpresentation` fallback link can be reproduced without exposing
  the keyword publicly.

Parts deliberately do not request or synthesize `imprintyear`.

## Normalization and grouping

Rows are grouped by the tuple `(titlepath, lbworkid)`, never by string
concatenation. A group uses `work_titleid` before `titleid`. Required identity,
title, page, and author path segments are validated and RFC 3986 encoded before
constructing a URL.

Raw representation order does not control output. Actions are deterministic:

```text
etext, faksimil, epub, pdf, infopost
```

- e-text and faksimil become Reader `read` actions;
- EPUB is synthesized from one `export.type == "epub"` entry;
- a real `mediatype == "pdf"` suppresses generated faksimil PDF;
- generated PDF is synthesized only from `export.type == "pdf"` when no real
  PDF exists;
- infopost becomes the existing Dramawebben destination;
- exact duplicate representations/exports are deduplicated;
- conflicting group-wide work/title identities fail closed. E-text and
  faksimil legitimately may have different start pages; a page conflict is
  rejected only between duplicate rows for the same media representation.

The full download filename, including `.epub` or `.pdf`, is returned only for a
download action. Ordinary anchors retain browser-native link and download
behavior; no click emulation is introduced.

Author identity used in Reader/download URLs follows Angular's
`work_authors[0]`, then `authors[0]`, then `main_author` precedence. Visible
contributor identity is deliberately different: ordinary contributor and whole
about sections use `authors[0]`, while `about_part` uses `authors[0]` and falls
back to `work_authors[0]`. The containing-work extra always uses
`work_authors[0]`. Contributor sections sort by nullable
`main_author.name_for_index`, then `sortkey`, ascending and with stable provider
order for exact ties. Main and part sections sort by `sortkey` ascending. Missing
metadata required for the visible row is malformed data; irrelevant optional
person enrichment remains nullable.

For parts, `work_authors` identifies the containing work. `workshorttitle` is
shown after the current `i {surname}:` marker. A part's own authors must not be
mistaken for the containing author. `sort_date_imprint` is never used as a year.

## Nuxt rendering and route behavior

The generated client is the only frontend contract. Deterministic fixtures keep
private SSR and public browser ledgers separate and provide rich, sparse,
empty, malformed, delayed, failed, and transition cases.

Both pages use route-keyed primary async data and server-only error status
handling. After hydration a route transition must not show the old author's
heading, portrait, sections, metadata, or links under the new URL. A valid
response is reused from the Nuxt payload so hydration performs no duplicate
public work request.

`AuthorWorksPerson.name_for_index` is always the visible contributor cell value;
`full_name` is never substituted silently when the legacy index name is
required. A fixture in which those two source names differ proves both output
and visible sorting.

`AuthorWorksContent.vue` reproduces the existing `listing.html` table structure,
classes, whitespace, section headings, media link order, title/tooltips,
imprint year, contributor author column, and containing-work extra line.
`/titlar` includes the existing portrait/external-links sidebar; `/mer` does
not. When any about section is nonempty, `/titlar` prepends the legacy
`Texter om {full_name}` link to the sidebar and points it at `/mer`; real
presentation, bibliography, and external links follow in their existing order.
When the real Presentation flag is absent, the first provider-ordered about
group carrying `LB-författarpresentation` supplies the exact legacy Reader
fallback destination. A published Litteraturkartan record adds the established
external map link. The top author navigation marks `Verk` active for `/titlar`
and keeps the same link set and visibility rules as Angular, including the
conditional external `Ljud` link derived from `authorid_norm`.

The existing legacy SCSS and body/background hooks are reused. Tailwind is used
only where the current template already uses equivalent utility classes. There
is no dropdown or modal in this slice, so Headless UI is not added.

Local development adds only the exact `/export/faksimil/**` proxy needed by
generated-PDF actions. It does not broaden proxy matching or affect production
SSR routing.

## Visual authority

Angular authority is captured deterministically by extending the already
reviewed `capture-author-angular.spec.ts` dependency ledger. It intercepts and
asserts exact signatures/counts for the Author request, global `/api/get_authors`
byline request, ten work calls, map query, external WordPress audio probe,
portrait and background assets, `backgrounds.xml`, `etext.css`, authority font,
analytics bootstrap, and Angular's otherwise unused managed-document fetch.
`/mer` must request exactly
`/red/forfattare/{authorid_norm}/semer/index.html` once; `/titlar` must request it
zero times. The capture fulfills it only to let Angular settle—Nuxt does not add
an equivalent fetch because the `/mer` listing does not render that HTML.
Negative probes cover work, auxiliary API, external audio, managed-document,
and static-asset escape families. Every other request records and aborts.
No live API, Nuxt proxy, existing baseline, or production Angular change may
satisfy the capture.

Six comparison baselines cover:

- rich multi-section `/titlar`, desktop and mobile;
- rich multi-section `/mer`, desktop and mobile;
- sparse/empty `/titlar`, desktop and mobile.

Nuxt comparisons use the same viewports and strict existing tolerance. Any
production CSS or DOM change must be justified by a corresponding authority
pixel difference. Existing Author profile and Reader/Library behavior must not
regress.

## Completion gate

The slice closes only when:

1. provider selection, limits, helper compatibility, all ten work queries and
   both bounded auxiliary lookups with graceful null-on-failure behavior,
   normalization, grouping, conflicts, sorting, URLs, models, errors, route,
   methods, OpenAPI, and the full backend v2 suite pass;
2. the generated TypeScript client matches the canonical OpenAPI snapshot;
3. fixtures prove private/public isolation and zero hydration duplicates;
4. unit, SSR, browser, transition, native link/download, malformed/failure, and
   accessibility tests pass;
5. all six Angular and Nuxt visual cases pass from a fresh authority capture;
6. typecheck, build, API drift, diff checks, and independent code review pass.

## Explicitly deferred

- managed `/presentation`, `/bibliografi`, `/semer`, `/omtexterna`, and SLA HTML
- the full `/sök` page and dynamic search result integration
- lowering historical provider limits without production cardinality evidence
- Reader shorthand/work-information pages reached by `?om-boken`
- deployment hardening and cache policy

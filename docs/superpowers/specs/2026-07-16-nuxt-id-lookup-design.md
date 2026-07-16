# Nuxt ID lookup design

## Scope

This slice ports the AngularJS ID lookup routes:

- `/id`;
- `/id/:id`, where the route value is an ID when its lower-cased value starts with `lb`, and otherwise is a title query.

It adds one typed FastAPI adapter, `POST /v2/works/lookup`, and one page-local Nuxt implementation. It does not migrate author, title, reader, download, editor, or FTP destinations reached from the result table. It does not add a composable, Nuxt server proxy, Angular bridge, or frontend shared state.

The migration is intentionally narrow. The legacy form, copy, table, links, loading state, body classes, and desktop/mobile layout remain visual and behavioral authority, subject only to the explicitly documented input hardening required by the bounded typed network boundary.

## Audited legacy behavior and approved differences

The Angular route owns both paths with `pageId: "id"` and renders `<id-page>`. Its exact visible source contract is:

```html
<div ng-class="{searching:!$ctrl.data}">
    <input ng-model="$ctrl.id" placeholder="lbid" autofocus ng-change="$ctrl.titles = []">
    <input ng-model="$ctrl.titles[0]" placeholder="titel" ng-change="$ctrl.id = '';" ng-model-options="{debounce: 500}">
    <textarea ng-model="$ctrl.textarea" placeholder="flera titlar separarade med nyrad" ng-change="$ctrl.textareaChange($ctrl.textarea)" ng-model-options="{debounce: 500}"></textarea>
    <div class="preloader">Hämtar <span class="dots_blink"></span></div>
    <table class="table-striped">
        <tr ng-repeat="row in $ctrl.data | filter:$ctrl.idFilter | filter:$ctrl.rowFilter track by $index">
            <td>{{row.lbworkid}}</td>
            <td><a href="/författare/{{row.authors[0].authorid}}">{{row.authors[0].surname}}</a></td>
            <td><a href="/författare/{{row.authors[0].authorid}}/titlar/{{row.work_titleid}}/{{row.mediatype}}">{{row.shorttitle || row.title}}</a></td>
            <td>
                <span ng-repeat="type in row.mediatypes track by $index">
                    <span ng-show="!$first">:::</span>
                    <a href="/författare/{{row.authors[0].authorid}}/titlar/{{row.titlepath}}/{{type.label}}">{{type.label}}</a>
                </span>
            </td>
        </tr>
    </table>
</div>
```

The route contributes exact body classes `focus page-id ready`. Results have four cells: work ID, author link, title link, and `:::`-separated media links. The existing copied Bootstrap/Angular styles own `table-striped`, `searching`, `preloader`, and `dots_blink`; this slice does not redesign them.

The current Angular page is accidentally empty. `backend.getTitles()` now resolves to an envelope `{ titles, author_aggs, imported_aggs, hits, distinct_hits, suggest }`, while `IdPageCtrl` assigns the whole envelope to `data` as though it were the former title array. Angular's repeat therefore has no work rows. This is a contract-consumption regression, not the intended product behavior. The Nuxt migration explicitly corrects it: the typed response's `items` array drives the table. Empty/form authority can be captured from the current page; populated authority uses a test-only seam that unwraps the legacy envelope without modifying production Angular source.

## Chosen architecture

The chosen approach is a strict FastAPI adapter over the existing legacy search primitives:

```text
Nuxt /id page
  -> generated POST /v2/works/lookup client
  -> strict request union
  -> process-local 60-second single-flight catalog cache
  -> bounded legacy etext/faksimil query on cache miss
  -> full validation/grouping, then request filtering
  -> strict display-ready response
```

This is lower risk than exposing the raw legacy envelope to Nuxt because all irregular fields and fallback rules stay behind one tested boundary. It is also lower risk than adding a Nuxt server proxy because there is already a mounted v2 API and generated client. A new shared composable is rejected because no other page consumes this state.

The legacy `/query_string/etext,faksimil` route, Angular service, controller, and template remain unchanged.

## Strict API contract

`POST /v2/works/lookup` has stable operation ID `v2_post_work_lookup`. Both request fields are always present. The request is exactly one of these strict shapes:

```json
{ "work_id": "lb238704", "titles": [] }
```

```json
{ "work_id": null, "titles": ["Röda rummet", "Gösta Berlings saga"] }
```

The OpenAPI request body is an `anyOf` between two `extra="forbid"` models rather than a loose model-level convention:

- ID mode requires a trimmed, lower-cased `work_id` of 2–100 characters beginning with `lb`, and requires `titles` to be the empty array;
- title mode requires `work_id: null` and 1–100 titles;
- every title is trimmed and contains 1–200 characters;
- unknown fields, both modes at once, neither mode, blank values, more than 100 titles, and over-limit values are 422 validation errors.

The `lb` prefix deliberately keeps the legacy route discriminator without imposing a new character whitelist. Existing IDs can contain digits, letters, underscores, or other historical characters after the prefix.

Moving filtering behind a strict typed network boundary intentionally hardens a few input edges beyond Angular's unbounded in-memory filters:

- route values are trimmed before classification/display and lower-cased, while Angular only lower-cased them;
- manually typed IDs remain byte-for-byte unchanged in the visible control, but the outgoing candidate is trimmed and lower-cased instead of being compared as raw text;
- outgoing single-title terms are trimmed before matching;
- work IDs are bounded to 100 characters, individual titles to 200 characters, and title requests to the first 100 non-empty terms; invalid or over-limit candidates produce no client request where client validation can decide that safely, or the typed 422 response at the API boundary.

These are narrow, approved input-hardening consequences of the typed adapter. They do not authorize changes to coupled control state, matching fields, result ordering, display copy, links, or layout.

Success is a strict response:

```json
{
  "items": [
    {
      "work_id": "lb238704",
      "author": {
        "label": "Strindberg",
        "url": "/författare/StrindbergA"
      },
      "title": {
        "label": "Röda rummet",
        "url": "/författare/StrindbergA/titlar/RodaRummet/etext"
      },
      "media": [
        {
          "label": "etext",
          "url": "/författare/StrindbergA/titlar/RodaRummet/etext"
        },
        {
          "label": "faksimil",
          "url": "/författare/StrindbergA/titlar/RodaRummet/faksimil"
        }
      ]
    }
  ]
}
```

`WorkLookupResponse`, `WorkLookupItem`, `WorkLookupLink`, and `WorkLookupMedia` all forbid unknown fields. Every displayed field is required. `WorkLookupMedia.label` is the exact literal union `etext | faksimil`; no raw work document or optional provider metadata crosses the v2 boundary.

The operation declares typed 200, 422, 500, and 503 responses:

- invalid shape or limits: 422 `validation_error`, `Request validation failed`, with safe field details;
- malformed raw data or another unexpected failure: 500 `internal_error`, `Internal server error`, `details: null`;
- OpenSearch failure: 503 `work_lookup_unavailable`, `Unable to load ID lookup results`, `details: null`.

Provider exceptions, queries, documents, field names, and validation internals never appear in 500/503 responses.

## Legacy query and pure transformation

The synchronous route keeps the blocking OpenSearch call in FastAPI's thread pool. A patchable `query_work_lookup_documents()` function reproduces the current Angular source request without invoking the HTTP route internally:

- document types `etext,faksimil` only;
- offsets 0 through 10,000;
- visible documents only, equivalent to the current `show:true AND *` query;
- source order `sortkey|asc`;
- only the fields required for the transform: `lbworkid`, `titlepath`, `title`, `shorttitle`, `titleid`, `work_titleid`, `mediatype`, `authors.authorid`, and `authors.surname`.

The 10,000-document ceiling is an intentional parity limit, not pagination. Pushing user strings into a different provider query is deferred because it could change the current case-insensitive substring semantics and result ordering.

The provider result is fully validated and normalized into a deeply immutable grouped catalog before the current request is considered. Internal catalog records are frozen dataclasses containing only string scalars and tuples; media is a tuple of frozen scalar-only media records. Cached records never contain Pydantic response models, mutable lists, dictionaries, or raw provider documents. A malformed document that cannot match the requested ID or titles still fails the entire build generically; filtering first would hide provider corruption and make cache contents request-dependent. The catalog builder characterizes the Angular `createExpandMediatypes` behavior:

1. Preserve the first-seen group order from the `sortkey|asc` source.
2. Group by the exact legacy key `titlepath + lbworkid`.
3. Sort representations inside a group by `etext`, then `faksimil`.
4. Use the first sorted representation as the row and fall back from `work_titleid` to `titleid`.
5. Use `authors[0].authorid` and `authors[0].surname` for the displayed author and all three route families.
6. Use `shorttitle || title` as the displayed title.
7. Preserve one media entry per source representation in media order.
8. Store normalized lower-case `titlepath` and full `title` search values beside each display-ready row.

Only after the entire catalog passes validation does a pure filter apply the `IdPageCtrl` rules:

- in ID mode, retain rows whose `lbworkid` exactly equals the normalized work ID;
- in title mode, retain a row when any query is a case-insensitive substring of either `titlepath` or the full `title`; `shorttitle` is display-only and is not searched;
- preserve grouped catalog order and return `items: []` for no match.

Every filter call constructs a fresh `WorkLookupResponse`, fresh `WorkLookupItem`/link/media Pydantic models, and a fresh media list from the frozen catalog scalars. No caller receives a cached response object by reference. Mutating a returned nested media model therefore cannot change the catalog or any later response.

The display-ready URLs reproduce the Angular template exactly:

- author: `/författare/<authors[0].authorid>`;
- title: `/författare/<authors[0].authorid>/titlar/<work_titleid || titleid>/<main mediatype>`;
- each media link: `/författare/<authors[0].authorid>/titlar/<titlepath>/<media label>`.

Missing envelopes, non-list data, non-object documents, unsupported media types, missing/blank required strings, invalid authors, and invalid group members are malformed provider data and fail generically rather than producing partial or fabricated rows.

## Catalog cache and concurrency

The bounded 10,000-document query is protected by an explicit process-local cache:

- a successful, fully validated normalized/grouped catalog has a 60-second TTL measured with a monotonic clock from successful build completion;
- requests within the TTL filter the immutable cached catalog without another provider call;
- the first request after expiry becomes the builder, and concurrent requests coalesce on the same in-flight result;
- a provider, transformation, or validation failure is delivered to all waiters, clears the in-flight marker, and is never cached;
- the next request after a failed build retries the provider;
- the patchable `query_work_lookup_documents()` function remains the only provider boundary.

The cache is deliberately per Python process. Deployments with multiple FastAPI worker processes can perform at most one catalog build per 60 seconds per worker; there is no cross-worker coordination or external cache in this slice. This contains repeated interactive cost without adding infrastructure or changing legacy matching semantics.

## Nuxt routes and SSR

`nuxt/app/pages/id/[[id]].vue` owns both routes and keeps all request, debounce, cancellation, and form state in `<script setup>`.

On direct SSR:

- `/id` makes no lookup request and renders the empty form/table shell;
- `/id/lb238704` lower-cases the route value and performs one ID-mode lookup;
- `/id/RödaRummet` lower-cases the route value and performs one title-mode lookup for `rödarummet`;
- hydration reuses the serialized result and makes no duplicate request.

The route value is decoded by Vue Router, trimmed, and lower-cased before either mode is seeded. Lower-casing matches Angular `$onInit`; trimming is the approved typed-boundary hardening documented above. It is limited by the same client-visible request rules. An over-limit or otherwise invalid route value renders the valid empty shell without making an API request. Route changes between `/id`, ID values, and title values cancel prior work and apply the same route classification without leaking stale rows.

The generated client base is selected exactly with `import.meta.server ? config.apiBase : config.public.apiBase`. SSR therefore uses the private runtime base and interactive browser calls use the public proxy base. A route-param SSR test configures distinguishable private/public bases and proves the server lookup uses only the private base.

The page metadata/body contract is exact on both SSR and hydrated navigation:

- title: `Litteraturbanken`;
- description: `På Litteraturbanken kan du söka bland hundratals kända svenska författare och svenska klassiska verk och ladda ner eböcker gratis.`;
- body classes: `focus page-id ready`.

The page sets that contract with `useSeoMeta`/`useHead`. No route middleware, server API, or composable is added.

## Form behavior and latest-wins requests

The rendered controls retain their exact order, placeholders, and first-input `autofocus` attribute:

1. `lbid` input;
2. `titel` input;
3. `flera titlar separarade med nyrad` textarea.

Typing a non-empty ID:

- preserves the raw interactive text exactly in the visible `lbid` input, including case and surrounding whitespace;
- replaces the active `titles` array with `[]`, which clears the visible title input, but deliberately leaves the textarea text unchanged;
- trims and lower-cases a separate request candidate without changing the displayed value;
- sends that normalized candidate immediately when it is a valid `lb`-prefixed value;
- clears results without a request when empty or not yet valid.

Route-parameter initialization remains different because Angular `$onInit` lower-cases the route value before assigning the control. Thus `/id/LB238704` initially displays `lb238704`, while manually typing `LB238704` continues to display `LB238704` even though its outgoing body contains `lb238704`.

Typing the single title:

- clears the ID;
- mutates only `titles[0]`, retaining any additional terms in `titles[1:]` and leaving textarea text unchanged;
- waits exactly 500 ms after the latest input;
- sends title mode with every retained non-empty trimmed title, in array order.

Typing the textarea:

- clears the ID;
- waits exactly 500 ms after the latest input;
- splits on newline;
- maps each row with the exact expression `(row.split("–")[1] || row).trim()`: only split index 1 is considered, so `A – B – C` becomes `B`, while an empty index 1 such as `A – ` falls back to the whole trimmed row `A –`;
- replaces the complete `titles` array with those normalized rows, preserving empty rows and duplicates as control state;
- mirrors the first normalized row in the visible title input because that input is bound to `titles[0]`;
- filters blank terms only when constructing the request and sends the first 100 non-empty titles in order;
- if request construction yields no non-empty titles, clears results without a request.

These coupled state transitions remain direct Angular authority. The populated-table envelope correction and the explicitly enumerated bounded-input hardening above are explicit approved deviations from legacy filtering semantics, not reasons to alter any other coupled control transition.

Every new lookup aborts the previous request and increments a request version. Every valid lookup clears the existing items immediately after becoming the latest version, before awaiting the network, so delayed same-mode requests never leave obsolete clickable rows visible beneath the loading state. Only the latest version may replace rows or loading state, including when a provider ignores abort. Interactive lookup wraps the generated-client call in `try/catch/finally`: typed error responses and thrown network failures clear the latest table; expected abort errors are suppressed; and the `finally` block clears `searching` only when its version is still latest. No rejected request becomes an unhandled promise, and a stale completion, abort, catch, or finally block cannot clear newer rows/loading. Switching modes, clearing controls, navigating routes, or unmounting cancels timers and requests. The exact `Hämtar` preloader appears through existing styles. A 422/500/503 or thrown network failure leaves the table empty without exposing a new error message, matching the sparse legacy page.

## Markup, table, and destinations

The Nuxt page keeps the legacy root, controls, preloader, and direct table structure. Each response item produces exactly four cells:

1. `work_id` as text;
2. `author.label` in `author.url`;
3. `title.label` in `title.url`;
4. media links in response order, with literal `:::` text between links and never before the first.

Links remain ordinary `<a href>` elements. The author/title/reader destinations are deferred: this slice neither fetches them nor asserts that Nuxt owns them. No client-side route rewriting, destination validation, download behavior, analytics, or editor action is added.

Rows and media links use index-qualified Vue keys. This preserves stable rendering when distinct rows share the same display URL or when legacy source duplication produces two media entries with the same label and URL; the adapter deliberately preserves one media item per source representation, matching Angular's `track by $index` behavior.

The byte-locked migrated `nuxt/app/assets/styles/styles.scss` remains unchanged. Minimal `nuxt.scss` glue is allowed only if visual comparison proves a Nuxt-specific discrepancy that cannot be fixed with authority markup.

## Fixtures and verification

- Backend characterization fixtures include irregular raw documents, duplicate media groups, reversed representation order, `work_titleid` fallback, short/full titles, mixed-case title/path matching, ID matching, multiple title OR matching, no hit, malformed envelopes/documents, a malformed nonmatching document, and private provider details.
- Cache tests prove one provider call across sequential and concurrent lookups, reuse before 60 seconds, rebuild at expiry, failure fan-out without caching, retry after failure, process-local reset isolation, and returned-response mutation isolation down to nested media.
- Model/API tests cover both exact request alternatives, every limit boundary, forbidden extras, synchronous POST behavior, typed success, 422, generic 500, endpoint-specific nonleaking 503, strict OpenAPI schemas, mounted isolation, and snapshot freshness.
- The generated Nuxt client is regenerated only from the committed backend OpenAPI snapshot and is tested for the exact POST body and typed 503.
- The fixture server exposes deterministic lookup rows, request-body/reset ledgers, delay controls, and failure controls without contacting production.
- SSR tests prove `/id` makes zero requests, route-param SSR makes exactly one correctly classified private-base request, hydration makes no duplicate, and exact title/description/body/markup/links are serialized.
- Browser tests cover immediate ID lookup with raw uppercase display and lower-case request; exact coupled ID/title/textarea state; 500 ms title/textarea debounce; split-index-1 multi-dash and empty-segment semantics; abort/latest-wins; immediate stale-row clearing during a delayed same-mode lookup; typed and thrown-network failures without unhandled rejection; loading cleanup; no-hit; route changes; hydrated title/description/body cleanup; exact four-cell links/media separators; and duplicate media representations rendered with index-qualified keys and no duplicate-key warning.
- Angular empty and test-unwrapped populated captures plus Nuxt comparisons cover desktop and mobile coupled control values, preloader, empty table, populated striped rows, shell corridors, typography, spacing, and `page-id` body state.
- Visual comparisons use exactly `threshold: 0.1` and `maxDiffPixels: 100`.
- Capture intercepts every legacy query and v2 lookup request, records the ledger, and fails on production escape. Full backend, OpenAPI, generated-client, Nuxt unit/SSR/browser/visual/typecheck/build, unchanged Angular, scope, and diff gates close the slice.

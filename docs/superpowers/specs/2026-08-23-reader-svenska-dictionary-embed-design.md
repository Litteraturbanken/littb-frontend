# Reader lookup with current SO and SAOB

## Status

Approved architecture. This document is the cross-repository contract for changes in:

- `littb` (the Nuxt Reader),
- `svenska.se` (the embedded dictionary surface), and
- deployment configuration only where an explicit embed origin or response header is required.

Implementation planning and code changes follow a separate review checkpoint.

## Context

The Reader currently sends one selected word to `lb-backend`'s
`/v2/dictionary/articles` endpoint. That endpoint queries the legacy
`red.litteraturbanken.se/so/` XML provider, selects one article, and returns provider
markup for Nuxt to sanitize and render in a modal. The dialog identifies the source as
the 2009 edition of *Svensk ordbok*.

The separately deployed `svenska.se` application has newer SO data, SAOB data, current
search interpretation, and maintained article renderers. Its SO renderer consumes
structured OpenSearch documents. Its SAOB renderer combines a search hit with a second
HTML asset request and implements SAOB-specific links, source information, accordions,
and anchor navigation. Copying those components into `littb` would also copy their
styles, helpers, generated contracts, asset behavior, and future maintenance burden.

## Goal

Make Reader word lookup use the current dictionary data and presentation maintained by
`svenska.se`, with these product rules:

1. When both SO and SAOB contain a suitable entry, show both tabs and select SO.
2. When SO has no suitable entry and SAOB does, open SAOB automatically.
3. When only SO has a suitable entry, show SO.
4. When neither dictionary has a suitable entry, show `Hittade inget uppslag`.

The lookup remains a quick, accessible Reader interaction. It is not a replacement for
the complete search experience on `svenska.se`.

## Non-goals

- Copying SO or SAOB source data into the Litteraturbanken deployment.
- Forking `SOArticle.vue`, `SAOBArticle.vue`, or their supporting presentation logic.
- Adding SAOL to Reader lookup.
- Reimplementing dictionary matching, ranking, canonical-target, homograph, variant,
  compound, or fallback rules in the Reader.
- Redesigning the Reader's word-selection indicator.
- Removing the legacy dictionary endpoint in the first rollout.
- Making arbitrary `svenska.se` pages frameable.

## Considered approaches

### 1. A dedicated embedded view in `svenska.se` (selected)

Add a minimal, chrome-free Reader lookup route in `svenska.se` and show that route in an
iframe inside the existing Reader modal. The route reuses the maintained SO and SAOB
renderers and the generated search contract.

This keeps dictionary data, interpretation, rendering, and dictionary-specific
interactions in their owning application. The cost is an explicit runtime dependency
between the two public sites and a small, versioned cross-window protocol.

### 2. Copy the dictionary renderers into `littb`

This avoids an iframe but creates a second implementation of a large structured SO
renderer and SAOB's HTML, asset, link, source-modal, and accordion behavior. It would
also couple `littb` to `svenska.se`'s generated models and CSS conventions. Fixes and
data-contract changes could silently drift between the sites. This approach is rejected.

### 3. Return rendered article fragments from a new API

A new API could return sanitized HTML for both dictionaries. It would avoid iframe
behavior but would require a new server-side presentation implementation, especially
for structured SO data, and a protocol for SAOB interactions and assets. This is more
work than the embedded route and creates another renderer to maintain. It remains a
possible future replacement if iframe behavior proves unacceptable in production.

## Ownership and boundaries

`svenska.se` owns:

- retrieval and interpretation of SO and SAOB results,
- selection of the canonical article within each dictionary,
- all dictionary article rendering and dictionary-specific interactions,
- visible dictionary attribution and links to the complete dictionary site,
- the embedded page's loading, empty, and article states, and
- messages describing the embedded page's coarse state to its parent.

`littb` owns:

- detecting and validating the selected Reader word,
- opening, closing, and focusing the Reader modal,
- constructing an embed URL from a fixed configured origin,
- authenticating messages from the expected iframe window and origin,
- a parent-side loading timeout and unavailable state, and
- privacy-preserving Reader lookup telemetry.

`lb-backend` is not placed in the new content path. Its legacy SO endpoint remains
available during rollout as an operational rollback target, then is removed in a
separate, explicitly reviewed cleanup.

## Embedded `svenska.se` surface

### Route

`svenska.se` adds a dedicated route such as:

```text
/embed/reader?word=<encoded-word>&requestId=<opaque-id>
```

The final route name is a public contract and must be represented by a single constant
or route helper in each repository. The page contains no global header, general search
field, promotional content, or site navigation. It contains only:

- an accessible heading naming the selected word,
- SO and/or SAOB tabs when applicable,
- the selected article,
- dictionary attribution and a link to open the full result on `svenska.se`, and
- self-contained loading, empty, and unavailable states.

The `word` input is trimmed and bounded to the same single-word policy as the Reader.
The `requestId` is opaque, bounded, and used only to correlate messages; it must not
encode the selected word or Reader URL.

### Result selection

The embedded page requests SO and SAOB concurrently with exact lookup enabled and a
small bounded result size. It consumes generated application-level presentation fields
such as the preferred hit, canonical target, and match classification. It must not infer
matching or ranking from raw dictionary source fields in Vue.

If the existing generated contract cannot identify one renderable preferred hit per
dictionary, the contract is extended in `pipeline/svenska.py` and
`pipeline/search_presentation.py`; the frontend must not create a parallel heuristic.

The page derives its visible state from the two application outcomes:

| SO outcome | SAOB outcome | Visible result |
| --- | --- | --- |
| article | article | SO and SAOB tabs; SO selected |
| article | none | SO article |
| none | article | SAOB article selected |
| none | none | `Hittade inget uppslag` |

Multiple raw hits or homographs do not cause the Reader to invent a selection. The
backend-provided preferred hit is rendered. The full-result link provides access to the
complete result list and any ambiguity that needs broader exploration.

Following a supported internal dictionary link updates the lookup inside the embedded
view. The same SO-first selection policy is applied to the new word. External navigation
must not replace the top-level Reader page.

### Rendering

SO articles use the maintained `SOArticle.vue` path. SAOB articles use the maintained
`SAOBArticle.vue` path, including its bounded dictionary HTML request and supported
article interactions. Shared components should be reused through props or small
composition changes rather than copied into embed-specific variants.

The embedded layout supplies the minimum style shell those components require and is
responsive within the Reader modal. The content has its own vertical scroll area; the
parent page must not grow to the full height of a long SAOB article.

## Reader modal integration

The existing word-selection indicator, selection delay, cancellation generation,
route-change invalidation, modal focus restoration, and body scroll locking remain.

On lookup, the Reader:

1. validates and captures the selected word,
2. creates a random opaque request ID,
3. attaches its message listener before assigning the iframe URL,
4. opens the modal in a loading state, and
5. loads the fixed embed route with the encoded word and request ID.

The iframe has an accessible title containing the selected word and a restrictive
sandbox. The expected initial policy is `allow-scripts allow-same-origin`; additional
capabilities require a demonstrated dictionary interaction and explicit review. The
frame uses a fixed responsive viewport with internal scrolling rather than allowing
unbounded child-controlled dimensions.

Closing the modal, changing Reader route, or starting a newer lookup invalidates the
request ID and removes the old iframe. Late load events or messages cannot reopen or
overwrite the current lookup.

## Cross-window protocol

The child sends a small versioned message envelope:

```ts
type ReaderLookupMessage = {
  type: "svenska-reader-lookup"
  version: 1
  requestId: string
  event: "ready" | "result" | "empty" | "error"
  dictionaries?: Array<"so" | "saob">
  selectedDictionary?: "so" | "saob"
}
```

No article content, selected word, arbitrary error detail, HTML, URL, or user data crosses
the message boundary.

The child derives the parent origin from its referrer, validates it against its own
configured allowlist, and uses that exact origin as the `postMessage` target. It does not
use `*`.

The parent accepts a message only when all of these hold:

- `event.origin` exactly matches the configured embed origin,
- `event.source` is the current iframe's `contentWindow`,
- the type and protocol version are recognized,
- the request ID matches the active lookup, and
- all optional fields pass an explicit runtime validator.

`ready` ends the document-load phase. `result` identifies the available tabs and active
dictionary for telemetry and accessible status. `empty` displays the no-result state.
`error` displays a generic unavailable state. The visible child page remains the source
of article presentation.

If no valid `ready`, `result`, `empty`, or `error` message arrives within a bounded
timeout, the parent replaces its loading indication with a generic unavailable message
and a link to open the word on `svenska.se`. The timeout is cleared for every terminal
state and on teardown.

## Origin and framing policy

The Reader never accepts an embed origin from a route parameter or API response. It is a
validated runtime setting with an HTTPS production default. Invalid configuration fails
closed and shows the unavailable state.

The embed response receives a route-specific Content Security Policy with
`frame-ancestors` limited to the production Litteraturbanken origin and approved staging
origins. Other `svenska.se` pages retain their existing framing behavior. No permissive
wildcard is added to the application as a whole, and `X-Frame-Options` must not conflict
with the embed route's explicit policy.

The authenticated `stage.svenska.se` host cannot be assumed to work in a third-party
iframe: browser third-party-cookie policy can prevent its Authelia session from being
sent. Therefore:

- standalone embed behavior is reviewed on `stage.svenska.se` in an authenticated
  top-level window;
- the embed route is promoted to public `svenska.se` before Litteraturbanken staging;
- `stage.litteraturbanken.se` uses the public production embed origin by default; and
- a future public stage embed origin may replace that arrangement only after its access
  and framing policy are explicitly designed and tested.

Local development permits only the documented localhost origins and ports used by the
two test runners. Production allowlists must not inherit local entries.

## Loading, errors, and rollback

The modal distinguishes:

- loading the embedded application,
- no result in either dictionary,
- dictionary service unavailable, and
- a rendered result.

Failures expose no upstream response body or implementation detail. A direct full-site
lookup link is available for empty and unavailable states.

The first release retains the existing legacy endpoint and rendering code behind an
explicit operational mode switch. The switch chooses the complete lookup path; the UI
does not silently combine a failed new lookup with legacy SO 2009 content. After the
embedded path has passed staging review and an agreed production observation period,
the legacy path and switch are removed in a separate change.

Rollback consists of selecting the legacy mode and redeploying the Litteraturbanken
artifact/configuration. It does not require rolling back `svenska.se`, because the new
embed route is isolated from its normal search page.

## Accessibility

- The existing modal remains the focus boundary and restores focus to the Reader on
  close.
- The iframe has a word-specific accessible title.
- The embedded page has one clear heading and native tab semantics with keyboard
  navigation.
- SO/SAOB selection changes are announced inside the embedded document.
- Loading, empty, and error states use live status text without repeatedly stealing
  focus.
- Article scrolling remains inside the modal on small screens.
- The full-site link has visible focus styling and states that it opens Svenska
  Akademiens dictionary site.

## Privacy, security, and content integrity

- The selected word is present in the iframe URL and dictionary search requests, as it
  is in the existing provider request, but it is not included in Reader telemetry or
  cross-window status messages.
- The parent does not receive or render dictionary HTML.
- `littb` does not add a general-purpose URL proxy or user-controlled iframe source.
- Existing `svenska.se` article-content validation and rendering boundaries remain in
  force.
- Article links cannot navigate the top-level Reader context.
- Dictionary attribution and copyright notices remain owned by and visible within the
  embedded dictionary surface.

## Observability

The Reader records privacy-preserving outcomes only:

- lookup opened,
- SO result, SAOB result, or both available,
- initially selected dictionary,
- no result,
- child-reported error, and
- parent timeout.

It must not retain the selected word. Existing `svenska.se` request, latency, and error
metrics continue to cover search and SAOB asset loading. The embed page reports its own
uncaught rendering failures through the site's existing client-error path.

Dashboards and rollout checks should distinguish no-result outcomes from transport or
rendering failures; a spike in legitimate missing historical words must not be treated
as an outage.

## Test strategy

### `svenska.se`

- Unit tests for the two-dictionary state table and protocol payload validation.
- API/presentation tests proving the embedded page consumes generated preferred-hit
  outcomes rather than raw-field heuristics.
- Component tests for tab availability, SO-first defaulting, SAOB fallback, no result,
  and full-site links.
- Browser tests for SO rendering, SAOB HTML rendering, internal links, keyboard tabs,
  mobile scrolling, error states, and parent messages.
- Response-header tests proving the embed route has the intended `frame-ancestors`
  policy without changing unrelated routes.

### `littb`

- Unit tests for fixed-origin URL construction, configuration rejection, message
  validation, request invalidation, and timeout cleanup.
- Component/browser tests for loading, result, empty, error, close/reopen, rapid
  successive lookups, Reader route changes, keyboard focus, and malicious or stale
  messages.
- Production-build proxy tests remain for the legacy path while the rollback switch
  exists.

### Cross-site staging smoke test

After both relevant artifacts are deployed, verify at least:

- a common word with SO and SAOB results (for example `hund`),
- an older SAOB-only word confirmed against current data,
- a word with no result,
- switching both tabs and following one supported internal link,
- modal keyboard behavior and mobile scrolling,
- direct `svenska.se` fallback links,
- no frame-policy, mixed-content, hydration, or client-console errors, and
- expected outcome metrics without the selected word.

The complete local quality gates for both repositories remain mandatory before staging.

## Deployment sequence

1. Implement and verify the isolated embed route in `svenska.se`.
2. Deploy it to `stage.svenska.se` and review it as a top-level authenticated page.
3. Promote that isolated route to public `svenska.se` and verify its restrictive frame
   policy and normal-site non-regression.
4. Implement the Reader integration with stage configured to use the public embed route.
5. Run both repositories' complete local test gates.
6. Deploy Litteraturbanken to stage and perform the cross-site smoke test and editorial
   review.
7. Promote the already-reviewed artifacts through the existing release process.
8. Observe result/error/timeout metrics during the agreed production window.
9. Remove the legacy endpoint, renderer, and rollout switch in a separate reviewed
   cleanup after the new path is accepted.

## Acceptance criteria

- Reader lookup uses current `svenska.se` SO data rather than the SO 2009 provider.
- SAOB is available for older words and automatically selected when SO has no suitable
  article.
- Both tabs appear when both dictionaries have suitable articles, with SO selected.
- Dictionary matching and article rendering remain owned by `svenska.se`.
- No dictionary HTML or rendering implementation is copied into `littb`.
- Cross-origin communication and frame permission are narrow, versioned, and tested.
- Loading, empty, unavailable, keyboard, route-change, and stale-request behavior are
  deterministic.
- Selected words do not enter Reader telemetry.
- A tested rollback path remains available for the initial production observation
  period.

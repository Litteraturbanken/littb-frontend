# Nuxt Library Relevance Slice Design

## Goal

Port the default `/bibliotek` “Alla träffar” path as a useful, independently
testable Nuxt vertical slice. Preserve the current default appearance and live
legacy relevance search while keeping the remaining Library surface explicitly
deferred.

## Scope

This slice owns:

- SSR of `/bibliotek` with the existing shell, title, metadata, body classes,
  heading, closed advanced-search affordance, chronology label, result tabs,
  default sort strip, and populated mixed results;
- the primary free-text input, its 300 ms debounce, query-string `filter`
  persistence, reset control, and latest-request-wins behavior;
- the four legacy “Alla träffar” sort choices and `sort` query persistence;
- one page-local request to the live legacy relevance endpoint;
- deterministic SSR and browser fixtures for populated, empty, error, and stale
  responses.

It does not port advanced filters, chronology interaction, result-count fan-out,
other result tabs, pagination, downloads, Reader, author pages, or deployment
hardening. Those controls are either visibly retained in their default state or
shown as non-active affordances without claiming unavailable behavior.

## Data boundary

The Nuxt page fetches the existing legacy endpoint directly:

`GET /api/relevance/etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress`

It sends the same exclusion list, `show_all=false`, `vectorize=true`, `sid=true`,
`from=0`, `to=100`, selected legacy sort expression, and the sanitized filter
wrapped as the legacy query expression. Empty input omits `q`.

The server uses a private legacy API base and the browser uses `/api`. The Vite
development proxy forwards non-v2 `/api` traffic to the configured live legacy
origin. Fetching, response validation, request cancellation, and view models stay
inside `pages/bibliotek.vue`; no one-use composable is added.

The local response boundary accepts only an object with array `data`, numeric
`hits`, and array `suggest`. Malformed or failed responses render the existing
`Ett fel uppstod.` state without leaking payload details. Rows with unsupported
or incomplete shapes are ignored rather than producing unsafe links.

## Page behavior

The initial query is SSR-rendered once. In the browser, typing updates the
`filter` query after 300 ms and starts a replacement request. A new input or sort
change aborts the previous request and increments a request version; only the
latest version may update rows or status. Reset clears `filter` and returns to
the default result set.

All result links remain ordinary anchors. Work and part links retain the legacy
Reader URLs, PDFs retain direct download URLs, authors retain author URLs, and
the existing Presentation, Translation Lexicon, Literature Map, and WordPress
destinations remain unchanged. This slice does not take ownership of their
destination routes.

## Visual contract

Reuse the copied Angular stylesheet and the authority Tailwind class strings.
The page uses body classes `focus page-library ready`, title
`Biblioteket – Titlar och författare | Litteraturbanken`, description
`Blädda bland Litteraturbankens författare och titlar.`, heading
`Botanisera i biblioteket`, and the live library background image.

The default closed advanced section, chronology label, tab row, sort row, result
container, mixed row order, typography, and responsive table-to-stack behavior
remain visually authoritative. No Headless UI primitive is added because this
bounded state has no legacy dropdown, modal, or listbox interaction.

One deterministic populated Angular authority capture is compared with the
matching Nuxt main content state when feasible. Any correction must target Nuxt
markup or narrowly scoped glue; copied `styles.scss` and Angular sources remain
unchanged.

## Verification

Focused tests prove:

- populated SSR uses the private legacy base and produces the exact shell,
  query, rows, links, and metadata;
- empty and failed responses preserve the legacy visible messages;
- browser typing is debounced, uses the public proxy, preserves the URL, aborts
  stale work, and commits only the latest response;
- sort/reset interactions preserve supported query state;
- no advanced-filter, count, tab, pagination, download, Reader, or author-page
  implementation enters the diff;
- typecheck and build remain green.

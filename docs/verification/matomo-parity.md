# Nuxt Matomo parity audit

Date: 2026-10-07. Feature branch: `codex/matomo-parity`.
Base: `e20ad09d` on Stage integration. This change is not a deployment.

## Scope and source inventory

The Angular frontend has exactly four active Matomo call sites:

| Source | Legacy behavior | Nuxt owner |
| --- | --- | --- |
| `app/index.html:34–63` | Exact production hostname, exclude `littb-snapshot`; site 1 at `//lb.se/matomo/`; load tracker and enable link tracking. The bootstrap page-view call is commented out. | `nuxt/app/lib/analytics/matomo.ts`, installed by `matomo.client.ts` |
| `app/scripts/app.js:72–78` | `onRouteReject()` emits a page view for Angular's deliberately reused author/about/Dramawebben/presentation routes. | The single navigation coordinator handles their successful Nuxt navigation. |
| `app/scripts/app.js:788–797` | Route success sets decoded pathname, route title and one page view, except `#external`. | `MatomoPageViews.visit` |
| `app/scripts/components/reader/reading_controller.js:992–1025` | Reused public reader updates set pathname and `author – title s. page`, then emit a page view. Query/hash updates enter this same handler. Editor index updates return before tracking; work/media changes reload. | The same coordinator, including reused-component navigation. No second reader tracker. |

The source was searched for `matomo`, `piwik`, `_paq`, and tracking methods; there are no legacy Matomo custom events or explicit `trackSiteSearch` calls to port. Search, QR, media/download interaction, and source-material `gtag` calls in `services/backend.js`, `services.js`, `library_controller.js`, and the route/reader handlers are GA-only. None are added to Nuxt. The old Angular files remain intact.

Reference: [Matomo SPA tracking documentation](https://developer.matomo.org/guides/spa-tracking), corroborated against the installed tracker script.

## Preserved collection contract

- Collector: `https://lb.se/matomo/matomo.php`; script: `https://lb.se/matomo/matomo.js`; site ID `1`. Explicit HTTPS is equivalent to the old scheme-relative URLs on the production HTTPS site.
- Only `location.hostname === "litteraturbanken.se"`, and user agent must not equal `littb-snapshot`. Stage, localhost, www and lookalike domains load no tracker and create no queue. There is no production-statistics opt-in on Stage.
- Initial hydrated visit: one view. Successful client navigation: one view. Browser back/forward and a fresh document reload count as new visits. Deduplication remembers the latest navigation, not every URL ever visited.
- `setCustomUrl` uses `decodeURI(pathname)` with no query string or fragment, preserving the historical URL aggregation used by popularity harvesting. Malformed escapes cannot crash navigation. This does not claim Matomo itself never inspects campaign/referrer data: its existing tracker defaults are unchanged.
- Library, EPUB, text search, about, Dramawebben catalogue and Lagerlöf's `omtexterna` query updates are not extra views (`reloadOnSearch: false` in Angular). Ordinary hash-only changes outside the reader are not extra views. Author/presentation query reloads remain views.
- Public reader page, work, media, query and hash changes count once. In particular opening/closing a query-driven reader panel is counted, as it was by the old `$routeUpdate` handler; it is not a newly added custom event.
- Editor index/query updates within the same work/media do not count; entering the editor or changing work/media does.
- Automatic download/outbound tracking is enabled once. The actual installed tracker was inspected: it delegates body click handling, so links inserted later by Vue do not need another listener or a manual `trackLink` call. Existing extension recognition, cookies, visitor/session IDs, referrer attribution and tracker defaults are unchanged. No heartbeat, user ID, custom dimensions, content tracking, or GA integration is introduced.

## Titles and deliberate legacy-bug corrections

The fixed route labels remain exactly:

| Route | Matomo title |
| --- | --- |
| `/` | `Svenska klassiker som e-bok och epub` |
| `/bibliotek` | `Biblioteket – Titlar och författare` |
| `/epub` | `E-böcker för nedladdning` |
| `/presentationer` | `Presentationer` |
| `/om/*` | `Om LB` |
| `/historik` | `History` |
| Public reader | `author – title s. page` using the URL identifiers, as in the old reader update handler |

This is coverage/aggregation parity, not reproduction of old incidental bugs:

1. `onRouteReject()` did not update Matomo's custom URL or title. A new subsection could therefore be attributed to the previous subsection. Nuxt always supplies the destination pathname.
2. Many Angular routes had no `$$route.title`; Matomo fell back to the document title, often before Angular updated it. Nuxt resolves the destination head after rendering, rather than using the previous page's DOM title. Lazy data may still replace a generic destination title later (e.g. `Författarprofil | Litteraturbanken` becomes the author's full name). That metadata update does not emit another view.
3. The old initial reader route had no static Matomo title; only later reader updates used the detailed format. Nuxt uses the detailed legacy reader format for the initial view too, making direct loads and page turns consistent.
4. Redirect intermediates are not separately logged. `#external` suppression is applied consistently, including the reader. A later real return visit still counts.

## Duplicate prevention and loading

The only integration entry point is a `.client.ts` plugin; the production server bundle contains no Matomo collector URL or `trackPageView`. It does not insert an SSR script, noscript pixel, or server-side tracking call. Setup configures the tracker but emits no page view.

Initial tracking waits for `app:mounted`; full page transitions wait for `page:finish`; router callbacks cover reused components only and ignore failed navigation. All paths call the same stateful coordinator. Pending head resolution is discarded if a newer navigation replaced it. Repeated finish/mount/router callbacks for the same full path are suppressed. Bootstrap installation is also idempotent.

The reporter dereferences `window._paq` on every push. This matters because real `matomo.js` replaces the initial array with its live queue object. Capturing the startup array permanently loses later navigation events. A regression checks this handover. If the script loads late, queued views are delivered once when it arrives. No application-level retry is added, which could otherwise duplicate requests after an uncertain send.

## Verification

- 32 Vitest checks cover host/snapshot gates, singleton setup, queue replacement, exact URL/title commands, duplicate callbacks, history, reader/media/work updates, filter/hash behavior, editor exclusions, redirect coalescing and failed navigation.
- TypeScript, focused ESLint, architecture policy and a production Nuxt build pass.
- Chromium ran the production build against the repository API fixtures. Requests for `https://litteraturbanken.se` were proxied to the local server, preserving the real production hostname gate. The actual script fetched from `https://lb.se/matomo/matomo.js` was served locally; **every `matomo.php` request was intercepted and fulfilled without contacting the collector**.
- The recorded 22-case browser matrix includes real navigation links, reused reader pages, query-only changes, duplicate navigation, back/forward, `#external`, direct reader loads, media switches, a locally verified redirect and its canonical destination, a real EPUB catalogue download link, dynamic PDF/outbound links, and reload. It asserts event counts, site ID, pathname and fixed/destination title behavior. Later lazy titles do not add views.
- The separate edge matrix tests delayed script arrival, Stage/local/snapshot exclusions, and absence of SSR tracker markup. Sanitized results are saved beside this audit; visitor identifiers and browser fingerprints are omitted.

A discarded redirect-harness run followed a redirect outside Playwright's local proxy and briefly reached the old production HTML, which emitted a GA page-view request. Matomo requests remained intercepted. The final harness explicitly blocks Google, verifies the 308 response locally, and opens the canonical destination as a separate intercepted navigation; its zero-GA result applies to the final Nuxt run.

Production receipt/ingestion in Matomo is intentionally not asserted: testing did not send synthetic visits to site 1, and this branch has not been deployed.

### Repeating the browser verification

Start `nuxt/test/fixtures/v2-server.mjs` with `LBAPI_FIXTURE_PORT=4188`. Build and serve Nuxt on port 3090 with `NUXT_API_BASE=http://127.0.0.1:4188/private-v2`, `NUXT_LIBRARY_API_BASE=http://127.0.0.1:4188/legacy-api`, and `NUXT_CONTENT_BASE=http://127.0.0.1:4188`. Build-time legacy/content proxy targets should also point to that fixture. Use an isolated dependency directory to avoid shared Vite caches.

Fetch the current `https://lb.se/matomo/matomo.js` to `/tmp/littb-matomo-tracker.js`, open a fresh Playwright CLI session on `about:blank`, and run:

```sh
playwright-cli --session matomo-parity run-code "$(cat docs/verification/matomo-browser-check.js)"
```

The harness proxies only the test browser's production/Stage requests to localhost. It serves the tracker from the local file and intercepts all collector requests before navigation. It installs the snapshot user agent at the end; use a fresh session when repeating it. Matomo delays queued transport briefly, so the delayed-load assertion allows two seconds for both requests to arrive.

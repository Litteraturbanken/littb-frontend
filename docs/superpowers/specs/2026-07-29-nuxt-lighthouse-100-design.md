# Nuxt Lighthouse 100 Design

## Objective

Make the optimized Nitro build of the Nuxt reader reach a repeatable Lighthouse Performance score of 100 while resolving the actionable Lighthouse findings exposed by the same audit. Preserve the current visual design and reader behavior.

The reference URL is:

`/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext`

## Acceptance criteria

- Build with `yarn build` and audit the resulting Nitro server, never the Vite development server.
- Three consecutive Lighthouse desktop runs against the reference URL score 100 for Performance.
- The same runs score 100 for Accessibility, Best Practices, and SEO.
- The experimental Agentic Browsing audit reports 2/2 when its remaining finding is the same malformed accessibility tree; experimental WebMCP functionality is not added solely to influence that category.
- Browser console errors caused by first-party requests are zero.
- `/red/**`, `/txt/**`, `/bilder/**`, `/export/faksimil/**`, and `/litteraturkartan/**` assets work in the built Nitro server as they do in development.
- The reader no longer downloads route-unrelated Dramawebben imagery or obsolete Font Awesome fallback formats.
- Reader navigation remains functionally equivalent, keyboard accessible, and visually equivalent to the current Nuxt baseline.
- Existing reader behavior, SSR, visual, lint, type, and build checks remain green.
- Desktop OTF files are not exposed as webfonts; the separate Typography.com licensing decision remains out of scope.

## Baseline

The clean production build audited on 2026-07-29 scored:

- Performance 79
- Accessibility 92
- Best Practices 96
- SEO 100
- FCP 1.4 seconds
- LCP 3.0 seconds
- TBT 0 milliseconds
- CLS 0.007
- Transfer size 3,069 KiB

The largest actionable costs were a 408 KiB render-blocking global stylesheet with 398 KiB estimated unused, 340 KiB estimated unused JavaScript, unrelated Dramawebben and Font Awesome assets, missing Nitro asset proxies, malformed shared-navigation list semantics, and undersized reader navigation targets.

## Chosen architecture

### Production asset boundary

Legacy public assets remain same-origin URLs in rendered HTML. Nitro receives explicit proxy handlers for the existing public prefixes and forwards only safe GET/HEAD requests to the configured upstreams. Development and production share the same target configuration and path policy. The handlers preserve content type, cache headers, and response status and reject traversal or unsupported methods.

This replaces the current production gap where these prefixes exist only under `vite.server.proxy`.

### Stylesheet boundaries

The Nuxt global CSS entry becomes a small application shell containing only reset/base rules, typography declarations required on every route, shared layout/navigation rules, and globally used utilities.

Feature styles move to route-owned entries:

- Reader and editor reader
- Library and text search
- Dramawebben
- Presentations and supplemental legacy pages
- Home page

Reader routes load reader styles through their page/layout dependency graph. Dramawebben backgrounds and other feature-only assets therefore cannot enter the reader request graph. Dynamic HTML selectors required by fetched literary content are retained explicitly rather than removed by a purge tool.

Font Awesome is reduced to the modern WOFF2 source and only the icon declarations actually used by the Nuxt application. The visible glyphs and class names remain unchanged.

### JavaScript boundaries

Shared layout code contains only navigation and shell behavior. Feature-only parsers, large dependencies, and controls are imported by their owning routes or components. `linkedom`, Headless UI, Vue Multiselect, library code, and Dramawebben code must not be present in the reader's initial client graph unless the reader directly uses them.

SSR remains authoritative for the initial reader content. Hydration adds navigation and reader interactions without refetching or reconstructing static content.

### Accessibility and semantics

The primary navigation becomes a semantic `<nav>` containing an ordinary `<ul>`. The `<ul>` no longer carries `role="navigation"`, restoring the list relationship for its `<li>` children and fixing the malformed accessibility tree.

Existing reader links receive enough vertical padding or spacing to provide a minimum 24 by 24 CSS-pixel target without changing type size, alignment, or visible copy. Keyboard behavior and focus visibility remain intact.

### Performance measurement

A repeatable script builds the app, starts Nitro on a dedicated port, waits for readiness, runs Lighthouse with the desktop preset, and writes HTML and JSON artifacts. The script fails when category targets, console cleanliness, or forbidden reader assets regress.

Performance work proceeds in measured waves:

1. Restore production asset correctness and console cleanliness.
2. Repair semantics and touch targets.
3. Remove unrelated assets and split CSS.
4. Split unused JavaScript.
5. Tune critical delivery, caching, and compression only after application payload boundaries are correct.

Each wave records the resulting metrics. A score improvement does not justify visual or functional regression.

## Alternatives rejected

Aggressive static CSS purging was rejected because the reader injects externally sourced HTML whose selectors are not statically discoverable. A duplicated reader-only visual system was rejected because it would make future parity maintenance harder. The chosen route-owned bundles preserve the existing rules while changing when they load.

## Verification

- Unit or SSR tests exercise every new proxy and semantic boundary.
- Playwright exercises reader navigation, legacy stylesheet loading, console cleanliness, and touch-target geometry.
- Existing reader visual snapshots confirm no design drift.
- `yarn lint`, `yarn typecheck`, and `yarn build` remain required.
- The final gate is three consecutive Lighthouse desktop reports from a clean production build, all meeting the category targets.

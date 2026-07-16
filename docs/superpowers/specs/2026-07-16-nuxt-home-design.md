# Nuxt Home page design

## Scope

This slice ports the AngularJS `/` route to the standalone Nuxt application. It preserves the current shell, metadata, page-start styling, editor-owned runtime HTML, runtime stylesheet, background image, and all editorial links. It does not migrate any linked library, search, epub, author, or reader destination.

The Home page needs no new FastAPI v2 endpoint or generated client type. Its only data source is the existing trusted editorial fragment at `/red/om/start/startsida-ny.html`, fetched directly through Nuxt's configured content origin.

## Invariants

- This is an architectural migration only; copy, typography, spacing, background, and responsive behavior remain Angular-authority exact.
- `/red` remains the live source of editorial Home content. The fragment is not copied into the Nuxt repository.
- Page-owned fetching and parsing stay in `nuxt/app/pages/index.vue`; no one-use composable is introduced.
- Nuxt renders the fetched body during SSR and reuses the payload during hydration, avoiding a duplicate browser fetch.
- Raw editorial anchors keep their exact hrefs, including links into deferred library and reader routes.
- The obsolete, currently unused `gotoTitle` Angular controller method is not bridged into Nuxt.

## Runtime content contract

The trusted fragment currently contains two Angular control declarations before arbitrary editorial HTML:

1. a runtime stylesheet link expressed with `data-ng-href`, pointing below `/red/`;
2. a `bkg-img` image declaration with a background color and image path below `/red/`.

The page parses those declarations into a local typed value:

```ts
type HomeContent = {
  bodyHtml: string
  stylesheetPath: string | null
  backgroundImagePath: string | null
  backgroundColor: string | null
}
```

Only canonical absolute paths rooted at `/red/` are accepted for the stylesheet and image. External, protocol-relative, encoded traversal, backslash, and dot-segment paths are rejected. The parser removes the two control elements by source ranges rather than DOM reserialization, so every remaining byte of the intentionally irregular trusted editorial markup is preserved before `v-html`. Missing or malformed declarations simply omit their corresponding head/background effect; they do not cause a broader content rewrite.

An unavailable or malformed upstream fragment leaves the normal Home shell in place with an empty editorial body and no upstream error status exposed to the browser.

## Page and head behavior

`nuxt/app/pages/index.vue` owns a fixed-key `useAsyncData` request using the existing server-private/client-public `contentBase` pattern. It renders the exact shell from `app/views/start.html`:

- `.center_col`;
- `h1` copy `Litteraturbanken`;
- `h2.caps` copy `Nytt & anmärkningsvärt` with the unchanged lowercase ampersand markup;
- the parsed runtime body directly below the headings.

The page sets:

- title `Litteraturbanken | Svenska klassiker som e-bok och epub`;
- the exact legacy description;
- body classes `focus page-start ready`;
- the extracted background color/image with the legacy explicit `no-repeat` on the `html` element;
- the extracted runtime stylesheet in the document head.

The editorial-fragment request and extracted stylesheet URL share the legacy cache-buster value: a random stable value per development page load and a `YYMM` value in production. A page-local `useState` value is serialized from SSR and reused during hydration so neither request nor head markup can mismatch.

Route transitions must cleanly remove the Home-only body class, background, and stylesheet, and restore them when returning to `/`.

## Styling

The copied parity styles already own the Home shell and mobile behavior. The editor-owned `/red/css/startsida.css` continues to own the runtime body. No redesign, Tailwind rewrite, Headless UI component, or new backend dependency is needed for this page.

## Verification

- A frozen full raw Home fragment with checksum and representative markers, plus CSS and image fixtures, makes SSR and visual tests deterministic.
- Fixture-server tests cover one request, failure, request logging, and reset without contacting production.
- Parser tests prove exact remaining-body bytes and cover missing/malformed declarations plus external, protocol-relative, traversal, encoded-traversal, and backslash paths.
- SSR tests prove exact metadata, body class, headings, editorial markers/hrefs, shared cache-buster on the fragment and stylesheet, stylesheet/background with `no-repeat`, removed Angular control tags, one upstream request, and no client refetch.
- Browser tests cover public-path failure fallback and Home-to-404-to-Home stylesheet/background/body cleanup and restoration without hydration errors.
- Desktop and mobile full-page captures compare the Angular authority with Nuxt after fonts and the background image are ready.
- Complete Nuxt unit, SSR, e2e, visual, API freshness, typecheck, build, and unchanged Angular gates close the slice.

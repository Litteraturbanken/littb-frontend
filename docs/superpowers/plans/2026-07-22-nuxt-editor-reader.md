# Nuxt editor Reader implementation plan

1. Add RED deterministic SSR/browser tests and fixture endpoints for `get_work_info?lbworkid`, page-count fallback, editor HTML, and editor JPEG naming.
2. Create strict typed Nitro editor-reader endpoint that validates compact aliases and raw index, resolves metadata by work id, and fetches the legacy-named asset server-side.
3. Add `pages/editor/[lbid]/ix/[ix]/[mediatype].vue` with page-local `useAsyncData`, SSR error semantics, compact sidebar/pager/slider, NuxtLink/router history, and existing Reader/faksimil styles.
4. Run focused SSR/e2e, full Reader suite, typecheck, diff checks, and applicable visual comparison.

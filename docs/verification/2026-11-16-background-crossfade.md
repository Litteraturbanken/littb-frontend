# Background crossfade prototype

Branch: `codex/background-crossfade`, based on Stage frontend `b4a4dfd9`.
This experiment is local only; the two search fixes were deployed separately.

## Behavior

A client plugin snapshots the outgoing route artwork and fades a temporary,
non-interactive layer over the incoming background for 240 ms. Page routing,
data loading, and content rendering never await the animation or image decode.
The plugin observes the existing route-owned HTML/body background styles; it
does not replace their source of truth or animate the page content.

Only navigation between different single-image backgrounds participates.
Same-path/query changes and identical backgrounds do not animate. Reduced
motion skips the effect. Image decoding has a 150 ms visual budget; failure or
expiry removes the outgoing layer without delaying the new page. Another
navigation, resize, or reduced-motion change cancels the current effect.

## Verification

A local production build proxies existing content and API requests to Stage.
Chromium warm Search ↔ Presentations navigation, measured from just before the
automated click to the first frame containing the destination content and
background:

- Fade enabled: 59–75 ms across six warm navigations.
- Reduced motion / fade disabled: 60–73 ms across six warm navigations.
- Content was present while the background layer was still fading.
- Every animation used 240 ms and removed its temporary layer.
- An indefinitely stalled image decode still allowed destination content in
  about 69 ms and left no layer after the timeout.
- Browser back and a 390 × 844 mobile viewport also completed without stale layers.
- Interrupted navigation, active reduced-motion changes, and viewport resizing
  cancel the outgoing layer. Desktop and mobile midpoint screenshots were inspected.
- Mobile snapshots preserve both HTML and body artwork to avoid a top-edge seam.
- Lint, type checking, and production build passed.

These are small local measurements, including automation overhead, not a
production performance guarantee or a real-device mobile benchmark. They show
no animation-duration wait added to page navigation.

Browser check scripts and a paused midpoint screenshot are in ignored
`output/playwright/`. The preview uses port 3192. After building in `nuxt/`, run:

```sh
HOST=127.0.0.1 PORT=3192 \
NUXT_API_BASE=https://stage.litteraturbanken.se/api/v2 \
NUXT_LIBRARY_API_BASE=https://stage.litteraturbanken.se/api \
NUXT_CONTENT_BASE=https://red.litteraturbanken.se \
node .output/server/index.mjs
```

Open `/s%C3%B6k` and use the main navigation to switch to **Presentationer** and
back to **Sök i texterna**. Initial document loads do not crossfade.

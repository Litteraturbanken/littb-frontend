# Reader dictionary and production shortcuts

## Goal

Restore the remaining production Reader and author-profile behavior without changing the established Angular-derived visuals or the Reader's current route, scroll, focus, and search behavior.

## Design

- FastAPI v2 owns a fixed, environment-configurable Svensk ordbok provider. The client supplies only one bounded word; redirects, oversized responses, active XML, and arbitrary provider URLs are rejected.
- The generated API contract returns one bounded article. Nuxt sanitizes the provider markup with a custom-element allowlist before rendering it in the legacy-styled Headless UI dialog.
- A Reader-only component observes selections inside `.reader_main .w`. A single selected word places the legacy search indicator beside that word; lookup errors use the existing notification visual.
- Author and Reader shortcut listeners ignore editable content, composition, and modifier chords. Clipboard shortcuts report their legacy messages. Media switching uses `router.push`, preserving browser history and avoiding reloads.
- Reader metadata adds bounded nullable URN/editor identifiers and a resolved alternate-media target. Route parameters remain computed and the existing `useAsyncData` identity continues to watch page/media changes.

## Safety and parity

Dictionary provider failures expose only typed generic errors. Article markup is bounded twice and rendered without scripts, handlers, links, or arbitrary attributes. The modal and indicator keep the existing Angular classes/styles on desktop and mobile.

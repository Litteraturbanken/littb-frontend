# Nuxt Quick Search Developer Context Design

## Goal

Port the Angular development-only Quick Search commands without Angular scope inspection or page reloads. Public Quick Search behavior and visuals remain unchanged.

## Architecture

- A shared typed `useQuickSearchContext` state is justified because the producer is the current Reader/author page and the consumer is the global Quick Search component.
- Reader pages publish their current work ID, page index, media type, editor work ID when available, and a bounded JSON-safe information object. Author pages publish a bounded JSON-safe author information object.
- Publishers clear only their own state on unmount so stale pages cannot erase a newer route's context.
- Developer commands exist only when `import.meta.dev` is true.

## Commands

- `/id` on Reader: display and copy the current work ID while leaving the modal open.
- `/editor` on Reader: Nuxt-navigate to `/editor/{workId}/ix/{pageIndex}/{e|f}` and add browser history.
- `/info` on Reader or author pages: display stable, recursively key-sorted JSON while leaving the modal open.
- A value beginning with `lb`: offer both the Editor route and a Red FTP lookup action.
- Red FTP lookup is served through a development-only same-origin server endpoint, validates the query and response bounds, and renders legacy-equivalent breadcrumb links as native external/file handoffs.

## UX and safety

- Reuse the current Headless UI Combobox/Dialog and legacy classes; no visual redesign.
- Command outputs appear where Angular rendered them: below the input and above the footer.
- Failed clipboard/FTP operations produce an inline status instead of an unhandled error.
- Never expose provider credentials, unrestricted proxying, or production-only endpoints.

## Verification

- Unit tests cover context ownership, stable sorting, command filtering, URL creation, and FTP parsing.
- Browser tests prove `/id`, `/editor`, `/info`, stale-context cleanup, FTP success/failure, and normal public search regression.
- SSR and visual tests confirm public output remains unchanged when the modal is closed.

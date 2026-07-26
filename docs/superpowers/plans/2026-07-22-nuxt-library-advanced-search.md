# Nuxt Library advanced-search implementation plan

Status: auto-approved under the active AngularJS-to-Nuxt migration goal.

1. Add failing SSR/browser tests for URL parsing, disclosure state, representative gender/media/language/date filters, exact request predicates, reload, Back/Forward, reset, and mobile accessibility.
2. Extend the page-local route state and request identity with validated advanced fields while preserving unrelated query bytes.
3. Implement escaped legacy-compatible filter-query composition and apply it consistently to relevance, works, EPUB/PDF, parts, latest, and browse counts where those modes support the facet.
4. Replace the disabled disclosure and read-only chronology with legacy-shaped accessible controls; use `router.push`, reset page on commits, and retain latest-request ownership.
5. Add category/publisher, about-author, narrowing collection, media, and language/status options from existing deterministic Library metadata/fixtures.
6. Run focused SSR/desktop/mobile behavior, all existing Library behavior, typecheck, and diff checks.
7. Re-capture generic Angular Library desktop/mobile authority and resolve current visual failures without rebasing Nuxt regressions.
8. Implement the separate `?nedladdning` source-material batch workflow after advanced search is green.

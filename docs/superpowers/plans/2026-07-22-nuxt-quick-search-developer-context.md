# Nuxt Quick Search Developer Context Implementation Plan

1. Add failing unit tests for typed context ownership, stable JSON sorting, Editor destinations, and bounded FTP result parsing.
2. Add failing Quick Search browser tests for Reader `/id`, `/editor`, `/info`, author `/info`, `lb…` options, and stale route cleanup.
3. Implement the shared cross-page context and publish it from Reader and author routes.
4. Implement development-only command rows and output rendering in the existing Headless UI Quick Search component.
5. Implement the constrained development FTP lookup endpoint and breadcrumb projection.
6. Run focused unit, SSR, desktop/mobile behavior, visual, typecheck, and live in-app-browser verification.

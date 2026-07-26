# Task 7 report — Nuxt live Playwright smoke

## Outcome

The root live E2E entry point now targets Nuxt at `http://127.0.0.1:3020`
and requires the backend v2 OpenAPI contract at
`http://127.0.0.1:8000/v2/openapi.json`. It does not start either server.
The legacy request mocks and webpack overlay workaround were removed.

The adapted suite contains five live smoke checks: library shell, Reader
navigation, typed dictionary lookup, Editor navigation, and text-search
hydration. No production code was changed because the current live stack passed
all checks.

The developer Invoke tasks are included and now expose `invoke e2e`, which
passes the configured backend and Nuxt origins to `yarn test:e2e:nuxt-live`.

## TDD evidence

- Initial runner contract: 3 failures because
  `playwright.nuxt-live.config.js` did not exist; after adding the focused
  config, preflight, and spec, 3 tests passed.
- Package entry point: 3 failures with `Command "test:e2e:nuxt-live" not
  found`; after adding the package script, 3 tests passed.
- Invoke discovery/delegation: 2 failures (`No idea what 'e2e' is` and missing
  list entry); after adding the task, 8 tests passed.

## Verification evidence

- Backend preflight probe: OpenAPI 3.1.0 with `/dictionary/articles` present.
- Nuxt preflight probe: `/_nuxt/@vite/client` returned HTTP 200 and JavaScript.
- `yarn test:e2e:nuxt-live --list`: 5 tests in 1 file.
- `yarn test:e2e:nuxt-live`: 5 passed in 7.0 seconds against ports 3020/8000.
- `python test/test_nuxt_live_e2e.py -v`: 4 passed.
- `python test/test_tasks.py -v`: 10 passed.
- `yarn test:unit`: all four root unit groups passed.
- `git diff --check`: passed.

## Review follow-up

- Conventional `yarn test` and `yarn test:e2e` now delegate to the explicit
  Nuxt-live command, so neither can select the migrated spec through the legacy
  port-9000 configuration.
- The default backend directory is derived from Git's common repository path,
  which works from both ordinary clones and linked worktrees, with
  `LB_BACKEND_DIR` still available as an override.
- The combined development task installs SIGINT, SIGTERM, and SIGHUP handlers,
  stops both child process groups in reverse order, restores previous handlers,
  and returns the conventional signal-derived exit status.

# V2 quality workflow

## Contract ownership

FastAPI/Pydantic owns transport DTOs. The backend's committed
`openapi/v2.json` is the contract, generated TypeScript is derived, and Nuxt
must not duplicate payload properties in handwritten transport interfaces.

## Fast checks

Run these commands from the frontend repository root:

- `invoke quality.backend`
- `invoke quality.contract`
- `invoke quality.library`
- `cd nuxt && yarn lint`
- `cd nuxt && yarn typecheck`

Use Node 22.22 from `nuxt/.nvmrc` for Nuxt commands. The current
`yarn eslint . --format json` inventory is nonzero: 89 errors and 28 warnings
across 48 files. This is the measured tranche baseline, not a zero-lint claim.
Tranche four owns taking that inventory to zero without suppression comments
or configuration exclusions; the other fast checks are expected to be green
now.

## Backend test policy

The backend's
[v2 contract test matrix](https://github.com/Litteraturbanken/lb-backend/blob/master/docs/v2-contract-test-matrix.md)
maps requirements to their owning evidence. Tests protect observable contract
and domain behavior, not implementation syntax or duplicated schema text.

## Library test ownership

| Requirement | Owning evidence |
| --- | --- |
| Filter compilation and exact legacy query semantics | Exact-expression and exact-provider-argument cases in backend `test_library_provider.py` |
| Provider normalization and grouping | Mode-specific normalization, redaction, grouping, action, ordering, and precedence cases in backend `test_library_provider.py` |
| API envelopes | Discriminated success, validation, unavailable-provider, and non-leaking malformed-provider cases in backend `test_library_api.py` and the shared OpenAPI error invariant |
| Generated client use | Committed `openapi/v2.json`, deterministic `yarn api:check`, `nuxt/test/nuxt/library-contract.ts`, Nuxt typecheck, and focused Library contract unit tests |
| SSR state | Private-base initial options/search ownership and partial-failure isolation in `nuxt/test/ssr/library.spec.ts` |
| Browser ownership | Cancellation, stale-result, count, route, and native-download behavior in `nuxt/test/e2e/library.behavior.spec.ts` and `library-advanced.behavior.spec.ts` |
| Visual parity | Immutable desktop/mobile baseline assertions in `nuxt/test/e2e/library.visual.spec.ts` |
| No legacy Library transport | Source audit plus exact generated-operation and empty legacy-ledger assertions in `nuxt/test/e2e/library.behavior.spec.ts` |

## Full parity gate

- Run the complete backend v2 pytest suite and the committed OpenAPI snapshot
  check.
- Run the Nuxt lint inventory, typecheck, unit suite, production build, and SSR
  suite.
- Run the full desktop/mobile Playwright suite.

`invoke quality.backend` covers strict mypy, critical Ruff rules, and the full
backend v2 suite. `invoke quality.contract` checks the backend OpenAPI snapshot
and generated Nuxt client deterministically from that committed file,
compile-checks the standalone generated-contract consumers, and runs the
focused backend and Nuxt Library contract tests.

`invoke quality.library` runs the focused backend Library model, provider, and
API tests; the deterministic snapshot/generated-client check; the Library
compile-time contract; Nuxt typecheck and focused Library unit tests; and the
Library SSR project. The full desktop/mobile browser and visual suites remain
part of the parity gate above.

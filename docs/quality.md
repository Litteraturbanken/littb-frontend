# V2 quality workflow

## Blocking baseline

Nuxt's enforced baseline is zero ESLint errors and zero warnings. Run Node
commands with the Node 22.22 version in `nuxt/.nvmrc`; the Invoke frontend and
release tasks prepend that configured NVM runtime automatically. The
architecture policy, lint, type, test, build, browser, generated-contract, and
visual checks fail fast: a failed command stops the gate and is never converted
to a warning.

Command ownership from the repository root:

| Command | Owns |
| --- | --- |
| `cd nuxt && yarn policy:check` | architectural suppressions, HTML sinks and capability issuance, exact ESLint policy |
| `cd nuxt && yarn lint` | zero-error/zero-warning ESLint project scope |
| `cd nuxt && yarn typecheck` | Nuxt application TypeScript |
| `cd nuxt && yarn test:unit` | complete unit suite |
| `cd nuxt && yarn build` | production Nitro/Nuxt build |
| `cd nuxt && yarn test:ssr` | complete SSR project |
| `cd nuxt && yarn test:e2e` | complete desktop/mobile browser and visual suite |
| `invoke quality.backend` | backend v2 mypy, security-critical Ruff rules, and complete v2 pytest suite |
| `invoke quality.contract` | OpenAPI snapshot/client drift, standalone strict TypeScript contracts, and focused backend/Nuxt contract tests |
| `invoke quality.frontend` | policy, lint, typecheck, all units, build, and all SSR checks in order |
| `invoke quality.release` | backend, contract, frontend, full desktop/mobile E2E, and immutable visual-baseline verification |

`invoke quality.library` remains the focused Library contract gate.

## Renderable-content capabilities

FastAPI/Pydantic owns transport DTOs. The backend's committed
`openapi/v2.json` is the contract, generated TypeScript is derived, and Nuxt
must not duplicate payload properties in handwritten transport interfaces.

Renderable content is nominally typed by both kind and policy:

- `SanitizedHtml<P>` is issued only after the policy-specific sanitizer has
  completed.
- `ManagedAssetHtml<A>`, `ManagedStyleText<A>`, and
  `ManagedStylesheetHref<A>` are issued only after the managed authority,
  path, media type, byte bound, UTF-8, and relevant structural transformation
  have been validated.
- Validation or transformation happens before issuance. A plain string, a
  capability from another policy, or arbitrary concatenation cannot retain or
  acquire a capability.

`RenderableHtmlContent.vue` is the sole live Vue-owned DOM HTML renderer. The
only detached-DOM serialization sites are the explicit sanitizer/highlighter
allowlist in `scripts/verify-architecture-policy.mjs`; adding a site requires
security review and a deliberate policy update. Vue raw-HTML directives,
general capability casts, exported generic branders, lint suppressions, and
unreviewed TypeScript suppression comments are blocking violations.

Presentation stylesheet links are authority/path capabilities. Their bodies
remain browser-owned and are not prefetched, proxied, or rewritten by Nuxt.

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
compile-checks every standalone contract including the renderable-content
contract exactly once, and runs the focused backend and Nuxt Library contract
tests.

`invoke quality.library` runs the focused backend Library model, provider, and
API tests; the deterministic snapshot/generated-client check; the Library
compile-time contract; Nuxt typecheck and focused Library unit tests; and the
Library SSR project. The full desktop/mobile browser and visual suites remain
part of the parity gate above.

Committed visual baselines are immutable relative to authority commit
`06add2bb`. The release task performs a Git blob/diff comparison and fails if a
baseline was edited; it never updates snapshots or generated artifacts.

## Next contract tranche

The next separate tranche generates Reader and Editor manifest operations from
FastAPI/OpenAPI and propagates those DTOs through Nuxt. It is intentionally not
part of this zero-lint/HTML-boundary tranche.

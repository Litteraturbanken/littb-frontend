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

`RenderableHtmlContent.vue` is the sole live Vue-owned DOM HTML renderer. Each
reviewed detached-DOM operation is pinned by TypeScript and Vue compiler ASTs
to scope-correct executable provenance, exact function/receiver/issuer shape,
and cardinality in `scripts/verify-architecture-policy.mjs`. Dead declarations,
same-name shadows, comments, strings, template data, and regex literals cannot
satisfy the review, while executable template-literal and Vue interpolation
expressions remain audited. Parser and issuer names must resolve to their
reviewed imports; a local same-name binding is not trusted. An allowlisted file
cannot introduce another DOM HTML read or write. Static or runtime-computed DOM
HTML keys, including binding and assignment destructuring, aliased
`Reflect.set`, `Reflect.defineProperty`, `Object.defineProperty`,
`Object.defineProperties`, and `Object.assign`, are forbidden on every possibly
live receiver. `insertAdjacentHTML` is audited under the same rule, including
destructured method aliases. Receiver provenance includes indexed collections, typed function
returns, and every control-flow reaching definition; a detached value is
trusted only when all reaching definitions remain detached. Vue raw-HTML
directives, unresolved dynamic `<component>` targets that can be native,
dynamic native bindings,
object `v-bind` on native elements, and imported, namespaced, or locally aliased
native `h`/`createVNode` prop bags are forbidden; component-only attribute
forwarding remains allowed. Static `innerHTML` reads on explicitly typed local
non-DOM DTOs remain ordinary data access; unresolved receivers stay
conservative. A
3,000-interpolation fixture bounds repeated Vue expression parsing without
source-sized padding per expression.
Adding or changing an operation requires security review and a deliberate
policy update. Capability issuance is likewise pinned to exact issuer
declarations and calls, the exact export surface, and exactly one private
constructor assertion. The policy traces imported and namespace aliases,
`ReturnType`, `Parameters`, `typeof`, wrappers, unions/intersections, mapped and
conditional types, function types, generic constraints and instantiations,
destructured generic methods, default/named/namespace imports, value aliases,
and the exact branded fields of real frontend DTOs through TypeScript
assertions, including angle assertions and Vue template casts. Direct
assignment or return of an explicitly `any`-valued expression—including member
and method results—to a capability-bearing target is rejected; exact safe DTO
fields and concretely safe mapped/conditional instantiations remain usable.
Capability casts or generic escapes, exported
branders, inline ESLint
configuration, and unreviewed
TypeScript suppression comments are blocking violations. The issuer module is
compared structurally by AST, while the ESLint configuration itself must
byte-for-byte equal the reviewed canonical file.

Generated/output exclusions are root-only and exact: nested `.nuxt`,
`.output`, `coverage`, `false`, `node_modules`, `playwright-report`, or
`test-results*` directories below `app`, `server`, `shared`, `scripts`, or
`test` remain audited. Only the exact `app/lib/api/generated` subtree is the
reviewed generated-source exception.

Presentation stylesheet links are authority/path capabilities. Their bodies
remain browser-owned and are not prefetched, proxied, or rewritten by Nuxt.

Presentation editorial transport limits are based on a complete measurement of
the current production allowlist at `red.litteraturbanken.se`: 58 documents
(the index plus 57 linked articles) were fetched successfully. The largest
observed XHTML document was `40taletOch40talisterna.html` at 75,220 bytes,
followed by `DiktOchAra.html` at 71,137 bytes; `backgrounds.xml` was 4,741 bytes
and was served as `text/xml; charset=utf-8`. The finite managed limits are
therefore 96 KiB for Presentation XHTML and 8 KiB for the exact background XML
path. That XML path accepts both `text/xml` and `application/xml`; authority,
path, UTF-8, and structural validation remain unchanged. Production-shaped
unit, SSR, and browser fixtures pin the measured upper-size case and MIME type.

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
compile-checks every standalone shared/DTO contract including the
renderable-content contract exactly once, and runs the focused backend and
Nuxt Library contract tests. These codegen and TypeScript commands use the
Node 22 runtime pinned by `nuxt/.nvmrc`; backend Python commands do not inherit
that frontend runtime environment.

Renderable-content types have two complementary compile lanes. Standalone
contracts prove generated DTO and shared-module relationships in
`invoke quality.contract`. `nuxt/test/nuxt/renderable-html-app-contract.ts` is
included by Nuxt's `yarn typecheck` and proves exact application-level types
for page modules, parsers, and highlighters without expected-error directives.

`invoke quality.library` runs the focused backend Library model, provider, and
API tests; the deterministic snapshot/generated-client check; the Library
compile-time contract; Nuxt typecheck and focused Library unit tests; and the
Library SSR project. Every Yarn subprocess in this task uses the Node 22
runtime pinned by `nuxt/.nvmrc`. The full desktop/mobile browser and visual
suites remain part of the parity gate above.

Committed visual baselines are immutable relative to authority commit
`06add2bb`. From the resolved repository root, the release task independently
compares the authority with committed `HEAD`, the staged index, and the current
filesystem. It then reads the authority tree's exact blob set and byte-compares
it with the filesystem baseline tree. This remains effective when working bytes
hide a committed or staged change and is independent of index flags such as
assume-unchanged and skip-worktree. Changed, missing, added,
ordinary-untracked, ignored-untracked, or symlinked baseline files fail, as
does a symlink in any baseline-path ancestor. The gate never updates snapshots
or generated artifacts.

## Next contract tranche

The next separate tranche generates Reader and Editor manifest operations from
FastAPI/OpenAPI and propagates those DTOs through Nuxt. It is intentionally not
part of this zero-lint/HTML-boundary tranche.

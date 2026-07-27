# V2 quality workflow

## Contract ownership

FastAPI/Pydantic owns transport DTOs. The backend's committed
`openapi/v2.json` is the contract, generated TypeScript is derived, and Nuxt
must not duplicate payload properties in handwritten transport interfaces.

## Fast checks

- `invoke quality.backend`
- `invoke quality.contract`
- `cd nuxt && yarn lint`
- `cd nuxt && yarn typecheck`

Use Node 22.22 from `nuxt/.nvmrc` for Nuxt commands. After tranche one,
`yarn lint` intentionally remains nonzero at the measured baseline of 104
errors and 28 warnings. Tranche four owns taking that inventory to zero without
suppression comments or configuration exclusions; the other fast checks are
expected to be green now.

## Backend test policy

The backend's
[v2 contract test matrix](https://github.com/Litteraturbanken/lb-backend/blob/codex/nuxt-v2-statistics/docs/v2-contract-test-matrix.md)
maps requirements to their owning evidence. Tests protect observable contract
and domain behavior, not implementation syntax or duplicated schema text.

## Full parity gate

- Run the complete backend v2 pytest suite and the committed OpenAPI snapshot
  check.
- Run the Nuxt lint inventory, typecheck, unit suite, production build, and SSR
  suite.
- Run the full desktop/mobile Playwright suite.

`invoke quality.backend` covers strict mypy, critical Ruff rules, and the full
backend v2 suite. `invoke quality.contract` checks both the backend OpenAPI
snapshot and the generated Nuxt client deterministically from that committed
file.

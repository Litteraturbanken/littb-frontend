# Litteraturbanken Nuxt application

Install dependencies with `yarn install`. The postinstall hook prepares Nuxt's
generated types and ESLint configuration.

## Code quality

- `yarn lint` checks all handwritten Nuxt application, server, shared, test, and
  configuration code. Generated API types and build/test artifacts are excluded.
- `yarn lint:fix` applies ESLint's ordinary automatic fixes.
- `yarn typecheck` runs Nuxt and Vue type analysis.
- `yarn test:unit` runs the Vitest suite.

From the repository root, `invoke quality.contract` checks the backend's
committed OpenAPI snapshot and then checks this application's generated API
client against that file. It does not depend on a running backend.

Lint warnings fail the command. Do not add suppression comments or run broad
editor suggestions without a separate review.

See the [cross-repository V2 quality workflow](../docs/quality.md) for contract
ownership, the current lint baseline, and the full parity gate.

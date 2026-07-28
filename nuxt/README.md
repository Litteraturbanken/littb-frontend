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

For Reader/Editor manifest work, `invoke quality.reader-editor` runs the
focused backend models/provider/API tests, non-mutating snapshot and generated
client checks, the exact compile contract, Nuxt typecheck/lint and projection
units, and Reader/Editor SSR parity. Make schema changes backend-first, export
the committed OpenAPI snapshot, run `invoke codegen.generate`, and consume only
the resulting generated aliases in Nuxt.

Lint warnings fail the command. Do not add suppression comments or run broad
editor suggestions without a separate review.

See the [cross-repository V2 quality workflow](../docs/quality.md) for contract
ownership, the Reader/Editor layer matrix, managed assets outside OpenAPI, the
current lint baseline, and the full parity gate.

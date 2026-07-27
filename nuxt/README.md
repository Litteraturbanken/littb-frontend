# Litteraturbanken Nuxt application

Install dependencies with `yarn install`. The postinstall hook prepares Nuxt's
generated types and ESLint configuration.

## Code quality

- `yarn lint` checks all handwritten Nuxt application, server, shared, test, and
  configuration code. Generated API types and build/test artifacts are excluded.
- `yarn lint:fix` applies ESLint's ordinary automatic fixes.
- `yarn typecheck` runs Nuxt and Vue type analysis.
- `yarn test:unit` runs the Vitest suite.

Lint warnings fail the command. Do not add suppression comments or run broad
editor suggestions without a separate review.

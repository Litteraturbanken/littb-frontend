import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, test } from "vitest"

const projectRoot = resolve(import.meta.dirname, "../..")
const nodeImage = "node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34"
const readBuildFile = (name: string) => {
  const path = resolve(projectRoot, name)
  return existsSync(path) ? readFileSync(path, "utf8") : ""
}

test("staging image builds Nuxt and starts its runtime as the node user", () => {
  const dockerfile = readBuildFile("Dockerfile")
  const packageManifest = JSON.parse(readBuildFile("package.json")) as { packageManager: string }

  expect(packageManifest.packageManager).toBe("yarn@1.22.22")
  expect(dockerfile).toContain(`FROM ${nodeImage} AS build`)
  expect(dockerfile).toContain(`FROM ${nodeImage} AS runtime`)
  expect(dockerfile).toContain("RUN corepack enable && corepack prepare yarn@1.22.22 --activate")
  expect(dockerfile).toContain("RUN yarn --version && yarn install --frozen-lockfile --non-interactive")
  expect(dockerfile).toContain("RUN yarn build")
  expect(dockerfile).toContain(`FROM ${nodeImage} AS runtime`)
  expect(dockerfile).toContain("ENV NODE_ENV=production HOST=0.0.0.0 PORT=3020")
  expect(dockerfile).toContain("COPY --from=build --chown=node:node /app/.output ./.output")
  expect(dockerfile).toContain("USER node")
  expect(dockerfile).toContain("CMD [\"node\", \".output/server/index.mjs\"]")

  const runtimeStage = dockerfile.split(`FROM ${nodeImage} AS runtime\n`)[1]
  expect(runtimeStage.match(/^COPY .+$/gmu)).toEqual([
    "COPY --from=build --chown=node:node /app/.output ./.output"
  ])
})

test("staging Docker build context excludes development and generated files", () => {
  const ignored = new Set(
    readBuildFile(".dockerignore")
      .split(/\r?\n/u)
      .filter(Boolean)
  )

  expect([...ignored]).toEqual(expect.arrayContaining([
    ".git",
    "node_modules",
    ".nuxt",
    ".output",
    "output",
    "coverage",
    "test",
    "test-results",
    ".playwright-cli",
    ".playwright-mcp",
    ".env*",
    ".pytest_cache",
    ".cache",
    ".DS_Store"
  ]))
})

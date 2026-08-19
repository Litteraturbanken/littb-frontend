import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"

import { describe, expect, test } from "vitest"

const require = createRequire(import.meta.url)
const repositoryRoot = resolve(import.meta.dirname, "../../..")
const config = require(resolve(repositoryRoot, "playwright.nuxt-live.config.js"))

describe("Nuxt live-stage runner", () => {
  test("uses bounded parallel workers with the existing preflight and no retries", () => {
    expect(config.fullyParallel).toBe(true)
    expect(config.workers).toBeGreaterThan(1)
    expect(config.workers).toBeLessThanOrEqual(4)
    expect(config.retries).toBe(0)
    expect(config.globalSetup).toContain("nuxt_live_preflight.cjs")
  })

  test("keeps the parallel live smoke free of fixture control and direct mutations", () => {
    const source = readFileSync(
      resolve(repositoryRoot, "test/e2e/playwright_e2e.spec.js"),
      "utf8"
    )

    expect(source).not.toMatch(/\/_[a-z_]+/u)
    expect(source).not.toMatch(/\b(?:page|request)\.(?:delete|patch|post|put)\s*\(/u)
  })
})

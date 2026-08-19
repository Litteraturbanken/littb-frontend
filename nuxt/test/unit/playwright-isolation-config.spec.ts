import { afterEach, describe, expect, test, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("Playwright shard output isolation", () => {
  test("honors an isolated Playwright output directory", async () => {
    vi.stubEnv("PLAYWRIGHT_OUTPUT_DIR", "/tmp/littb-playwright/shard-1/playwright")

    const config = (await import("../../playwright.config")).default

    expect(config.outputDir).toBe("/tmp/littb-playwright/shard-1/playwright")
  })
})

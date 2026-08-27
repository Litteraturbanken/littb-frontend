import { afterEach, describe, expect, test, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("Playwright shard output isolation", () => {
  test("honors an isolated Playwright output directory", async () => {
    vi.stubEnv("PLAYWRIGHT_OUTPUT_DIR", "/tmp/littb-playwright/shard-1/playwright")

    const config = (await import("../../playwright.config")).default

    expect(config.outputDir).toBe("/tmp/littb-playwright/shard-1/playwright")
  })

  test("disables Vite HMR for isolated test servers", async () => {
    vi.stubEnv("LITTB_DISABLE_VITE_HMR", "1")
    vi.stubEnv("LITTB_VITE_SERVER_HMR_PORT", "24701")
    vi.stubGlobal("defineNuxtConfig", (config: unknown) => config)

    const config = (await import("../../nuxt.config")).default
    expect(config.vite?.server?.hmr).toBe(false)
    expect(config.vite?.server?.ws).toBe(false)
    const server = { server: {} }
    await config.hooks?.["vite:extendConfig"]?.(
      server,
      { isClient: false, isServer: true }
    )
    expect(server.server.hmr).toBe(false)
    expect(server.server.ws).toBe(false)
  })

  test("runs both Playwright web servers through owned pid wrappers", async () => {
    vi.stubEnv("LITTB_FIXTURE_PID_FILE", "/tmp/littb/fixture.pid")
    vi.stubEnv("LITTB_NUXT_PID_FILE", "/tmp/littb/nuxt.pid")

    const config = (await import("../../playwright.config")).default
    const servers = Array.isArray(config.webServer) ? config.webServer : []

    expect(servers[0]?.command).toContain(
      "run-owned-webserver.mjs /tmp/littb/fixture.pid"
    )
    expect(servers[1]?.command).toContain(
      "run-owned-webserver.mjs /tmp/littb/nuxt.pid"
    )
    const nuxtPort = process.env.LITTB_NUXT_TEST_PORT || "3000"
    expect(servers[1]?.command).toContain(`yarn dev --port ${nuxtPort}`)
    expect(servers[1]?.url).toBe(
      `http://127.0.0.1:${nuxtPort}/_nuxt/@vite/client`
    )
  })

  test("honors an explicit retry budget for isolated shards", async () => {
    vi.stubEnv("LITTB_PLAYWRIGHT_RETRIES", "1")

    const config = (await import("../../playwright.config")).default

    expect(config.retries).toBe(1)
  })

  test("keeps behavior and visual files in separate E2E lanes", async () => {
    vi.stubEnv("LITTB_E2E_LANE", "behavior")
    const behavior = (await import("../../playwright.config")).default
    const behaviorDesktop = behavior.projects.find(project => project.name === "desktop-chromium")
    const behaviorMobile = behavior.projects.find(project => project.name === "mobile-chromium")

    expect(behaviorDesktop?.testIgnore).toContainEqual(/e2e\/.*\.visual\.spec\.ts/)
    expect(behaviorMobile?.testIgnore).toContainEqual(/e2e\/.*\.visual\.spec\.ts/)

    vi.resetModules()
    vi.stubEnv("LITTB_E2E_LANE", "visual")
    const visual = (await import("../../playwright.config")).default
    const visualDesktop = visual.projects.find(project => project.name === "desktop-chromium")
    const visualMobile = visual.projects.find(project => project.name === "mobile-chromium")

    expect(visualDesktop?.testMatch).toEqual(/e2e\/.*\.visual\.spec\.ts/)
    expect(visualMobile?.testMatch).toEqual(/e2e\/.*\.visual\.spec\.ts/)
  })

  test("rejects unknown E2E lanes", async () => {
    vi.stubEnv("LITTB_E2E_LANE", "mixed")

    await expect(import("../../playwright.config")).rejects.toThrow(/LITTB_E2E_LANE/u)
  })

})

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
    const server = { server: {} }
    await config.hooks?.["vite:extendConfig"]?.(
      server,
      { isClient: false, isServer: true }
    )
    expect(server.server.hmr).toEqual({ port: 24701 })
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
    expect(servers[1]?.command).toContain("yarn dev --port 3000")
    expect(servers[1]?.url).toBe("http://127.0.0.1:3000/_nuxt/@vite/client")
  })

})

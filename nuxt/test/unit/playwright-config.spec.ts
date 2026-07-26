import { describe, expect, test } from "vitest"
import config from "../../playwright.config"

type Pattern = string | RegExp

function matches(patterns: Pattern | Pattern[] | undefined, path: string): boolean {
  if (!patterns) return false
  return (Array.isArray(patterns) ? patterns : [patterns]).some((pattern) => (
    typeof pattern === "string" ? path.includes(pattern) : pattern.test(path)
  ))
}

describe("Playwright project boundaries", () => {
  test("runs the mobile Editor behavior only in the mobile project", () => {
    const spec = "e2e/editor-reader.mobile.behavior.spec.ts"
    const desktop = config.projects?.find(project => project.name === "desktop-chromium")
    const mobile = config.projects?.find(project => project.name === "mobile-chromium")

    expect(matches(desktop?.testMatch, spec)).toBe(true)
    expect(matches(desktop?.testIgnore, spec)).toBe(true)
    expect(matches(mobile?.testMatch, spec)).toBe(true)
    expect(matches(mobile?.testIgnore, spec)).toBe(false)
  })

  test("keeps the production dictionary proxy spec in its production-build config", () => {
    const spec = "e2e/reader-dictionary-production.behavior.spec.ts"
    const desktop = config.projects?.find(project => project.name === "desktop-chromium")
    const mobile = config.projects?.find(project => project.name === "mobile-chromium")

    expect(matches(desktop?.testMatch, spec)).toBe(true)
    expect(matches(desktop?.testIgnore, spec)).toBe(true)
    expect(matches(mobile?.testMatch, spec)).toBe(false)
  })

  test("bypasses only the Nuxt checkout lock while keeping isolated servers non-reusable", () => {
    const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer]
    const nuxtServer = servers.find(server => server?.command.includes("yarn dev"))

    expect(nuxtServer?.command).toContain("NUXT_IGNORE_LOCK=1 yarn dev")
    expect(nuxtServer?.reuseExistingServer).toBe(false)
    expect(servers.every(server => server?.reuseExistingServer === false)).toBe(true)
  })
})

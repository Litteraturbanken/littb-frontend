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
})

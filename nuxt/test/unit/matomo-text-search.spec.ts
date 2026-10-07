import { describe, expect, it } from "vitest"
import { MatomoTextSearch } from "../../app/lib/analytics/text-search"
import { MatomoPageViews, pushMatomo, type MatomoCommand } from "../../app/lib/analytics/matomo"

function recorder() {
  const commands: MatomoCommand[] = []
  const analytics = new MatomoTextSearch(command => { commands.push(command) })
  return { commands, analytics }
}

describe("Matomo text search", () => {
  it("uses a separate Events category with phrase and occurrence count", () => {
    const { commands, analytics } = recorder()
    analytics.observe("query+filters", "röda rummet", { status: 200, count: 12 })
    expect(commands).toEqual([["setCustomUrl", "/sök"], ["trackEvent", "Text search", "search", "röda rummet", 12]])
  })
  it("counts zero hits, not empty searches or failed/pending requests", () => {
    const { commands, analytics } = recorder()
    analytics.observe(null, null, null)
    analytics.observe("query", "x", null)
    analytics.observe("query", "x", { status: 503, count: null })
    expect(commands).toEqual([])
    analytics.observe("query", "x", { status: 200, count: 0 })
    expect(commands.at(-1)).toEqual(["trackEvent", "Text search", "search", "x", 0])
  })
  it("deduplicates repeated accepted results and pagination with the same search identity", () => {
    const { commands, analytics } = recorder()
    for (let i = 0; i < 4; i++) analytics.observe("same query and filters", "x", { status: 200, count: 100 })
    expect(commands).toHaveLength(2)
  })
  it("counts refinements and return searches once each", () => {
    const { commands, analytics } = recorder()
    for (const identity of ["A", "B", "A"]) {
      analytics.observe(identity, "x", null)
      analytics.observe(identity, "x", { status: 200, count: 2 })
    }
    expect(commands).toHaveLength(6)
  })
  it("ignores malformed counts without preventing a later valid response", () => {
    const { commands, analytics } = recorder()
    for (const count of [-1, NaN, 1.5, null]) analytics.observe("A", "x", { status: 200, count })
    expect(commands).toHaveLength(0)
    analytics.observe("A", "x", { status: 200, count: 3 })
    expect(commands).toHaveLength(2)
  })
  it("counts primary, keyboard and middle-click activations but ignores right clicks", () => {
    const { commands, analytics } = recorder()
    analytics.openResult({ button: 0 }, "lb123", "hit")
    analytics.openResult({ button: 1 }, "lb123", "title")
    analytics.openResult({ button: 2 }, "lb123", "continuation")
    expect(commands.filter(command => command[0] === "trackEvent")).toEqual([
      ["trackEvent", "Text search", "result_open:hit", "lb123"],
      ["trackEvent", "Text search", "result_open:title", "lb123"]
    ])
  })
  it.each(["/s%C3%B6k?fras=glas", "/sök?fras=glas&traffsida=2"])("keeps only the initial pageview, not extra pageviews per query: %s", fullPath => {
    const commands: MatomoCommand[] = []
    const url = new URL(fullPath, "https://litteraturbanken.se")
    const views = new MatomoPageViews(commands)
    views.visit({ fullPath, path: url.pathname, hash: "" }, "Search")
    views.visit({ fullPath: `${url.pathname}?fras=another`, path: url.pathname, hash: "" }, "Search")
    expect(commands.filter(command => command[0] === "trackPageView")).toHaveLength(1)
  })
  it("shares the live queue and keeps Stage/snapshot events out", () => {
    const commands: MatomoCommand[] = []
    const browser = { location: { hostname: "stage.litteraturbanken.se" }, navigator: { userAgent: "browser" }, _paq: commands }
    const command: MatomoCommand = ["trackEvent", "Text search", "search", "x", 0]
    pushMatomo(browser, command)
    browser.location.hostname = "litteraturbanken.se"
    browser.navigator.userAgent = "littb-snapshot"
    pushMatomo(browser, command)
    expect(commands).toHaveLength(0)
    browser.navigator.userAgent = "browser"
    pushMatomo(browser, command)
    expect(commands).toEqual([command])
  })
})

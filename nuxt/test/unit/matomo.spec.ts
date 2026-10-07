import { describe, expect, it } from "vitest"
import { installMatomo, legacyMatomoTitle, matomoEnabled, MatomoPageViews, type MatomoCommand } from "../../app/lib/analytics/matomo"

const reader = "/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext"
function recorder() {
  const commands: MatomoCommand[] = []
  const views = new MatomoPageViews(commands)
  const visit = (fullPath: string, title = "Destination title") => {
    const url = new URL(fullPath, "https://litteraturbanken.se")
    views.visit({ fullPath, path: url.pathname, hash: url.hash }, title)
  }
  const count = () => commands.filter(command => command[0] === "trackPageView").length
  return { commands, visit, count }
}

describe("legacy Matomo parity", () => {
  it.each(["stage.litteraturbanken.se", "localhost", "127.0.0.1", "www.litteraturbanken.se", "litteraturbanken.se.example.org"])("excludes %s", host => {
    expect(matomoEnabled(host, "browser")).toBe(false)
  })
  it("preserves the production and snapshot gates", () => {
    expect(matomoEnabled("litteraturbanken.se", "littb-snapshot")).toBe(false)
    expect(matomoEnabled("litteraturbanken.se", "browser")).toBe(true)
    expect(installMatomo({ location: { hostname: "localhost" }, navigator: { userAgent: "browser" } }, {} as Document)).toBeNull()
  })
  it("configures and loads the tracker exactly once without a bootstrap pageview", () => {
    const scripts: unknown[] = []
    const doc = { createElement: () => ({}), head: { appendChild: (script: unknown) => scripts.push(script) } } as unknown as Document
    const browser = { location: { hostname: "litteraturbanken.se" }, navigator: { userAgent: "browser" }, _paq: [] as MatomoCommand[] }
    const views = installMatomo(browser, doc)
    expect(views).toBe(installMatomo(browser, doc))
    expect(scripts).toEqual([{ async: true, src: "https://lb.se/matomo/matomo.js" }])
    expect(browser._paq).toEqual([["setTrackerUrl", "https://lb.se/matomo/matomo.php"], ["setSiteId", "1"], ["enableLinkTracking"]])
    const liveCommands: MatomoCommand[] = []
    browser._paq = liveCommands
    views?.visit({ path: "/bibliotek", fullPath: "/bibliotek", hash: "" }, "Library")
    expect(liveCommands).toHaveLength(3)
    expect(liveCommands[2]).toEqual(["trackPageView"])
  })
  it("coalesces hydration/mount/router callbacks but counts back/forward visits", () => {
    const r = recorder()
    for (const path of ["/", "/", "/", "/bibliotek", "/bibliotek", "/", "/bibliotek"]) r.visit(path)
    expect(r.count()).toBe(4)
    expect(r.commands.slice(0, 3)).toEqual([["setCustomUrl", "/"], ["setDocumentTitle", "Svenska klassiker som e-bok och epub"], ["trackPageView"]])
  })
  it("reports decoded pathname without query/hash and tolerates malformed escapes", () => {
    const r = recorder()
    r.visit("/f%C3%B6rfattare/S%C3%B6derbergH?source=x#section")
    expect(r.commands[0]).toEqual(["setCustomUrl", "/författare/SöderbergH"])
    r.visit("/bad%escape")
    expect(r.commands.at(-3)).toEqual(["setCustomUrl", "/bad%escape"])
  })
  it.each(["/bibliotek", "/epub", "/sök", "/om/ide", "/dramawebben/pjäser", "/författare/LagerlöfS/omtexterna/x"])("ignores query-only filters on %s", path => {
    const r = recorder()
    for (const suffix of ["", "?q=one", "?q=two", "?q=two#section"]) r.visit(path + suffix)
    expect(r.count()).toBe(1)
  })
  it("counts legacy author/presentation query reloads but not ordinary anchors", () => {
    const r = recorder()
    for (const path of ["/författare/SöderbergH", "/författare/SöderbergH?q=one", "/författare/SöderbergH?q=one#section", "/presentationer/specialomraden/x", "/presentationer/specialomraden/x?q=one"]) r.visit(path)
    expect(r.count()).toBe(4)
  })
  it("counts reader pages, queries, hashes, media and works once each", () => {
    const r = recorder()
    for (const path of [reader, reader.replace("/1/", "/2/"), `${reader}?sok=glas`, `${reader}?sok=glas#word`, reader.replace("etext", "faksimil"), reader.replace("DoktorGlas", "Historietter")]) {
      r.visit(path); r.visit(path)
    }
    expect(r.count()).toBe(6)
    expect(r.commands[1]).toEqual(["setDocumentTitle", "SöderbergH – DoktorGlas s. 1"])
    expect(r.commands[4]).toEqual(["setDocumentTitle", "SöderbergH – DoktorGlas s. 2"])
  })
  it("does not count editor index/query updates", () => {
    const r = recorder()
    for (const path of ["/editor/lb1/ix/0/e", "/editor/lb1/ix/1/e", "/editor/lb1/ix/1/e?q=x", "/editor/lb1/ix/1/f", "/editor/lb2/ix/1/f"]) r.visit(path)
    expect(r.count()).toBe(3)
  })
  it("suppresses #external without blocking a real return visit", () => {
    const r = recorder()
    for (const path of ["/bibliotek", "/författare/SöderbergH#external", "/bibliotek"]) r.visit(path)
    expect(r.count()).toBe(2)
  })
  it("updates the destination for legacy rejected author/about subsection routes", () => {
    const r = recorder()
    const paths = ["/om/ide", "/om/kontakt", "/författare/SöderbergH", "/författare/SöderbergH/titlar"]
    paths.forEach(path => r.visit(path))
    expect(r.commands.filter(command => command[0] === "setCustomUrl").map(command => command[1])).toEqual(paths)
  })
  it.each([
    ["/bibliotek", "Biblioteket – Titlar och författare"], ["/epub", "E-böcker för nedladdning"],
    ["/om/ide", "Om LB"], ["/presentationer", "Presentationer"], ["/historik", "History"],
    ["/författare/SöderbergH", "Destination title"]
  ])("preserves title semantics for %s", (path, title) => {
    expect(legacyMatomoTitle(path, "Destination title")).toBe(title)
  })
})

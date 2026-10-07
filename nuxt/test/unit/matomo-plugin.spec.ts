import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MatomoCommand, MatomoRoute } from "../../app/lib/analytics/matomo"

type Callback = () => void | Promise<void>
interface Plugin { setup: (app: { hook: (name: string, callback: Callback) => void }) => void }

let hooks: Map<string, Callback>
let afterNavigation: (to: unknown, from: unknown, failure?: unknown) => void
let currentRoute: { value: MatomoRoute }
let browser: { location: { hostname: string }; navigator: { userAgent: string }; _paq?: MatomoCommand[] }
let scripts: unknown[]
const tick = async () => { for (let index = 0; index < 6; index++) await Promise.resolve() }
const count = () => browser._paq?.filter(command => command[0] === "trackPageView").length ?? 0

beforeEach(() => {
  hooks = new Map()
  scripts = []
  currentRoute = { value: { path: "/", fullPath: "/", hash: "" } }
  browser = { location: { hostname: "litteraturbanken.se" }, navigator: { userAgent: "browser" } }
  vi.stubGlobal("injectHead", () => ({ resolveTags: async () => [{ tag: "title", textContent: "Resolved destination" }] }))
  vi.stubGlobal("window", browser)
  vi.stubGlobal("document", { title: "Destination", createElement: () => ({}), head: { appendChild: (script: unknown) => scripts.push(script) } })
  vi.stubGlobal("defineNuxtPlugin", (plugin: Plugin) => plugin)
  vi.stubGlobal("useRouter", () => ({ currentRoute, afterEach: (callback: typeof afterNavigation) => { afterNavigation = callback } }))
})
afterEach(() => vi.unstubAllGlobals())

async function setup() {
  const plugin = (await import("../../app/plugins/matomo.client")).default as unknown as Plugin
  plugin.setup({ hook: (name, callback) => { hooks.set(name, callback) } })
}
async function fire(name: string) { await hooks.get(name)?.(); await tick() }
function navigate(fullPath: string) {
  const url = new URL(fullPath, "https://litteraturbanken.se")
  const from = currentRoute.value
  currentRoute.value = { fullPath, path: url.pathname, hash: url.hash }
  afterNavigation({ ...currentRoute.value, matched: [] }, { ...from, matched: [] })
}

describe("Matomo Nuxt lifecycle", () => {
  it("does not install anything on Stage", async () => {
    browser.location.hostname = "stage.litteraturbanken.se"
    await setup()
    expect(scripts).toHaveLength(0)
    expect(hooks.size).toBe(0)
  })
  it("does not log before mount; route/finish/mount callbacks yield exactly one view", async () => {
    await setup()
    afterNavigation({ ...currentRoute.value, matched: [] }, { matched: [] })
    await fire("page:finish")
    expect(count()).toBe(0)
    await fire("app:mounted")
    await fire("page:finish")
    expect(count()).toBe(1)
  })
  it("waits for destination rendering and never logs an intermediate redirected route", async () => {
    await setup(); await fire("app:mounted")
    await fire("page:start")
    navigate("/titlar")
    await tick()
    navigate("/bibliotek")
    await tick()
    expect(count()).toBe(1)
    await fire("page:finish")
    await fire("page:finish")
    expect(count()).toBe(2)
    expect(browser._paq?.filter(command => command[0] === "setCustomUrl").map(command => command[1])).toEqual(["/", "/bibliotek"])
  })
  it("tracks reused reader pages even without another page:finish", async () => {
    await setup(); await fire("app:mounted")
    navigate("/författare/SöderbergH/titlar/DoktorGlas/sida/1/etext"); await tick()
    navigate("/författare/SöderbergH/titlar/DoktorGlas/sida/2/etext"); await tick()
    await fire("page:finish")
    expect(count()).toBe(3)
  })
  it("uses the resolved destination title rather than stale document.title", async () => {
    await setup(); await fire("app:mounted")
    navigate("/författare/SöderbergH"); await tick()
    expect(browser._paq?.at(-2)).toEqual(["setDocumentTitle", "Resolved destination"])
  })
  it("ignores aborted/duplicated navigation callbacks", async () => {
    await setup(); await fire("app:mounted")
    afterNavigation({ fullPath: "/never-visited", matched: [] }, { ...currentRoute.value, matched: [] }, new Error("aborted"))
    await tick()
    expect(count()).toBe(1)
  })
})

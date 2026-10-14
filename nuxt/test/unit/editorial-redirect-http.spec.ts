import { createServer } from "node:http"
import { createApp, toNodeListener } from "h3"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"
import batch from "../../server/api/editorial-redirects.post"
import middleware from "../../server/middleware/00-editorial-redirects"

const app = createApp().use("/batch", batch).use(middleware).use(() => "canonical page")
const server = createServer(toNodeListener(app))
let origin = ""

beforeAll(async () => {
  vi.stubGlobal("useRuntimeConfig", () => ({ apiBase: "http://backend.test/v2" }))
  vi.stubGlobal("$fetch", vi.fn(async () => ({ rules: [
    { source: "/författare/EhrensvardCA", target: "/författare/EhrensvärdCA", media: [] },
    { source: "/författare/ÖstergrenCL/titlar/Dikter", target: "/författare/ÖstergrenCL/titlar/Dikter1879", media: [] }
  ] })))
  await new Promise<void>(resolve => { server.listen(0, "127.0.0.1", resolve) })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Missing HTTP server address")
  origin = `http://127.0.0.1:${address.port}`
})
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  vi.unstubAllGlobals()
})

describe("editorial redirect HTTP responses", () => {
  test("returns a server redirect with the exact query bytes and no cacheable permanence", async () => {
    const response = await fetch(`${origin}/f%C3%B6rfattare/%C3%96stergrenCL/titlar/Dikter/sida/3/faksimil?om-boken&x=a%2Bb&x=2`, { redirect: "manual" })
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("/f%C3%B6rfattare/%C3%96stergrenCL/titlar/Dikter1879/sida/3/faksimil?om-boken&x=a%2Bb&x=2")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-lb-redirect")).toBe("editorial")
  })
  test("uses the memory table for redirects and misses without another backend request", async () => {
    const fetcher = vi.mocked($fetch)
    const before = fetcher.mock.calls.length
    const url = `${origin}/f%C3%B6rfattare/A/titlar/Old`
    expect((await fetch(url, { redirect: "manual" })).status).toBe(200)
    expect((await fetch(url, { redirect: "manual" })).status).toBe(200)
    expect(fetcher.mock.calls.length).toBe(before)
    expect(fetcher).toHaveBeenLastCalledWith("http://backend.test/v2/editorial-redirects", expect.not.objectContaining({ query: expect.anything() }))
  })
  test("resolves a batch of author aliases from memory without per-link requests", async () => {
    const before = vi.mocked($fetch).mock.calls.length
    const response = await fetch(`${origin}/batch`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ paths: ["/f%C3%B6rfattare/EhrensvardCA/semer", "/f%C3%B6rfattare/FrostensonK/presentation"] })
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      "/f%C3%B6rfattare/EhrensvardCA/semer": "/f%C3%B6rfattare/Ehrensv%C3%A4rdCA/semer"
    })
    expect(vi.mocked($fetch).mock.calls.length).toBe(before)
    expect((await fetch(`${origin}/batch`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths: [null] })
    })).status).toBe(400)
  })
  test("HEAD redirects too, while canonical paths and POST fall through", async () => {
    const alias = `${origin}/f%C3%B6rfattare/%C3%96stergrenCL/titlar/Dikter`
    expect((await fetch(alias, { method: "HEAD", redirect: "manual" })).status).toBe(307)
    expect((await fetch(alias, { method: "POST", redirect: "manual" })).status).toBe(200)
    expect((await fetch(`${alias}1879`, { redirect: "manual" })).status).toBe(200)
  })
})

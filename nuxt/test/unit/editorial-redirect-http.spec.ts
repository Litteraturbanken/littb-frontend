import { createServer } from "node:http"
import { createApp, toNodeListener } from "h3"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"
import middleware from "../../server/middleware/00-editorial-redirects"

const app = createApp().use(middleware).use(() => "canonical page")
const server = createServer(toNodeListener(app))
let origin = ""

beforeAll(async () => {
  vi.stubGlobal("useRuntimeConfig", () => ({ apiBase: "http://backend.test/v2" }))
  vi.stubGlobal("$fetch", vi.fn(async () => ({ rules: [
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
  test("HEAD redirects too, while canonical paths and POST fall through", async () => {
    const alias = `${origin}/f%C3%B6rfattare/%C3%96stergrenCL/titlar/Dikter`
    expect((await fetch(alias, { method: "HEAD", redirect: "manual" })).status).toBe(307)
    expect((await fetch(alias, { method: "POST", redirect: "manual" })).status).toBe(200)
    expect((await fetch(`${alias}1879`, { redirect: "manual" })).status).toBe(200)
  })
})

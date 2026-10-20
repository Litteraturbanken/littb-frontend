import { describe, expect, test, vi } from "vitest"
import { createRedirectCache } from "../../server/utils/editorial-redirect-lookup"

const snapshot = (target = "B") => ({ rules: [{ source: "/författare/A", target: `/författare/${target}`, media: [] }] })
const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

describe("editorial redirect memory cache", () => {
  test("shares cold loads and resolves known and unknown paths locally", async () => {
    let resolve!: (value: unknown) => void
    const load = vi.fn(() => new Promise(r => { resolve = r }))
    const cache = createRedirectCache(load)
    const a = cache(); const b = cache()
    expect(load).toHaveBeenCalledTimes(1)
    resolve(snapshot())
    expect(await a).toBe(await b)
    expect((await cache()).get("/författare/A")?.target).toBe("/författare/B")
    expect((await cache()).has("/författare/Unknown")).toBe(false)
    expect(load).toHaveBeenCalledTimes(1)
  })
  test("refreshes in the background and atomically applies removals", async () => {
    let now = 1000
    const load = vi.fn<() => Promise<unknown>>().mockResolvedValueOnce(snapshot())
    const cache = createRedirectCache(load, () => now)
    const original = await cache()
    let resolve!: (value: unknown) => void
    load.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    now += 30_000
    expect(await cache()).toBe(original)
    expect(await cache()).toBe(original)
    expect(load).toHaveBeenCalledTimes(2)
    resolve({ rules: [] }); await tick()
    expect((await cache()).size).toBe(0)
  })
  test("retains a validated table on failure, backs off, and bounds stale use", async () => {
    let now = 1000
    const load = vi.fn<() => Promise<unknown>>().mockResolvedValueOnce(snapshot()).mockResolvedValue({ rules: [{ source: "bad" }] })
    const cache = createRedirectCache(load, () => now)
    const original = await cache()
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      now += 30_000
      expect(await cache()).toBe(original); await tick()
      expect(await cache()).toBe(original)
      expect(load).toHaveBeenCalledTimes(2)
      now = 301_000
      await expect(cache()).rejects.toThrow()
      await expect(cache()).rejects.toThrow("unavailable")
      expect(load).toHaveBeenCalledTimes(3)
      now += 5000
      load.mockResolvedValue(snapshot("C"))
      expect((await cache()).get("/författare/A")?.target).toBe("/författare/C")
    } finally { log.mockRestore() }
  })
})

import { describe, expect, test } from "vitest"
import { createRedirectCache, parseRedirectTable, resolveEditorialPath } from "../../server/utils/editorial-redirects"

const snapshot = { rules: [
  { source: "/författare/KrusenstjernaA/titlar/TonyVaxerUpp", target: "/författare/KrusenstjernaA/titlar/TonyVäxerUpp", media: [] },
  { source: "/författare/ÖstergrenCL/titlar/Dikter", target: "/författare/ÖstergrenCL/titlar/Dikter1879", media: [] },
  { source: "/författare/A/titlar/T", target: "/författare/B/titlar/New", media: [{ source: "infopost", target: "faksimil" }] },
  { source: "/författare/A", target: "/författare/B", media: [] }
] }
const table = parseRedirectTable(snapshot)

describe("editorial redirects", () => {
  test.each(["forfattare", "författare", "f%C3%B6rfattare"])("handles mixed spelling with %s", prefix => {
    expect(resolveEditorialPath(`/${prefix}/KrusenstjernaA/titlar/TonyVaxerUpp/sida/3/etext`, table))
      .toBe("/f%C3%B6rfattare/KrusenstjernaA/titlar/TonyV%C3%A4xerUpp/sida/3/etext")
  })
  test("handles already-accented titles under the ASCII route", () => {
    expect(resolveEditorialPath("/forfattare/KrusenstjernaA/titlar/TonyV%C3%A4xerUpp/sida/3/etext", table))
      .toBe("/f%C3%B6rfattare/KrusenstjernaA/titlar/TonyV%C3%A4xerUpp/sida/3/etext")
  })
  test("matches complete title segments, including a bare title route", () => {
    expect(resolveEditorialPath("/författare/ÖstergrenCL/titlar/Dikter", table)).toContain("Dikter1879")
    expect(resolveEditorialPath("/författare/ÖstergrenCL/titlar/Dikter1879", table)).toBeNull()
  })
  test("changes media without losing the page and combines author/title edits", () => {
    expect(resolveEditorialPath("/författare/A/titlar/T/sida/137/infopost", table))
      .toBe("/f%C3%B6rfattare/B/titlar/New/sida/137/faksimil")
    expect(resolveEditorialPath("/författare/A/titlar/T/infopost", table))
      .toBe("/f%C3%B6rfattare/B/titlar/New/faksimil")
  })
  test.each(["/författare/A%2FB", "/författare/..", "/författare/%ZZ", "/författare/%252f", "/api/A"])("rejects unsafe or unrelated route %s", path => {
    expect(resolveEditorialPath(path, table)).toBeNull()
  })
  test("rejects unsafe backend targets", () => {
    expect(() => parseRedirectTable({ rules: [{ source: "/författare/A", target: "https://evil.example", media: [] }] })).toThrow()
  })
  test("refreshes single-flight and atomically retains the previous good table", async () => {
    let now = 0
    let calls = 0
    let value: unknown = snapshot
    const cached = createRedirectCache(async () => { calls++; return value }, () => now)
    const [first, second] = await Promise.all([cached(), cached()])
    expect(calls).toBe(1)
    expect(first).toBe(second)
    now = 31_000
    value = { rules: [] }
    expect(await cached()).toBe(first)
    await Promise.resolve()
    await Promise.resolve()
    expect((await cached()).size).toBe(0)
    expect(calls).toBe(2)
  })
})

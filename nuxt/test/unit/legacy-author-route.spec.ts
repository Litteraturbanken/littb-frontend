import { describe, expect, test } from "vitest"

import {
  decodeAndValidatePathSegments,
  matchLegacyReaderSegments,
  normalizeLegacyRouteIdentity,
  validCanonicalSegment
} from "../../server/utils/legacy-author-route"

function errorData(action: () => unknown) {
  try {
    action()
  } catch (error) {
    return (error as { data?: unknown }).data
  }
  throw new Error("Expected action to throw")
}

describe("legacy author route parsing", () => {
  test("normalizes accented legacy route identities for the resolver index", () => {
    expect(normalizeLegacyRouteIdentity("LönnlövS", 100)).toBe("LonnlovS")
    expect(normalizeLegacyRouteIdentity("DörrarOchÖppningar", 200))
      .toBe("DorrarOchOppningar")
  })

  test("preserves compatibility expansions within each resolver identity ceiling", () => {
    expect(normalizeLegacyRouteIdentity("ﬃ".repeat(33), 100)).toBe("ffi".repeat(33))
    expect(normalizeLegacyRouteIdentity("ﬃ".repeat(66), 200)).toBe("ffi".repeat(66))
  })

  test.each([
    ["fullwidth slash", "A／B", 100],
    ["fullwidth backslash", "A＼B", 100],
    ["fullwidth percent", "A％B", 100],
    ["fullwidth dot", "．", 100],
    ["fullwidth dotdot", "．．", 100],
    ["combining marks only", "\u0301\u0308", 100],
    ["author ligature expansion", "ﬃ".repeat(34), 100],
    ["title ligature expansion", "ﬃ".repeat(67), 200]
  ])("rejects %s introduced by compatibility normalization", (_, value, maximum) => {
    expect(() => normalizeLegacyRouteIdentity(value as string, maximum as number)).toThrow()
    expect(errorData(() => normalizeLegacyRouteIdentity(
      value as string,
      maximum as number
    ))).toEqual({ code: "legacy_author_route_not_found" })
  })

  test("returns no match for every non-legacy prefix", () => {
    expect(decodeAndValidatePathSegments("/författare/LagerlöfS")).toEqual([])
    expect(decodeAndValidatePathSegments("/forfattare")).toEqual([])
  })

  test("decodes and recognizes the exact Reader structure", () => {
    const segments = decodeAndValidatePathSegments(
      "/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext"
    )
    expect(segments).toEqual([
      "forfattare", "SoderbergH", "titlar", "Forvillelser", "sida", "3", "etext"
    ])
    expect(matchLegacyReaderSegments(segments)).toEqual({
      title: "Forvillelser",
      mediaType: "etext"
    })
  })

  test.each(["etext", "faksimil"] as const)(
    "recognizes the exact %s Reader media type",
    mediaType => {
      const segments = decodeAndValidatePathSegments(
        `/forfattare/A/titlar/T/sida/1/${mediaType}`
      )
      expect(matchLegacyReaderSegments(segments)).toEqual({ title: "T", mediaType })
    }
  )

  test.each([
    "/forfattare/A/titlar/T/sida/1/audio",
    "/forfattare/A/titlar/T/sida/1/etext/extra",
    "/forfattare/A/titlar/T/etext",
    "/forfattare/A/mer/T/sida/1/etext"
  ])("keeps safe unsupported suffixes on author-only resolution %#", pathname => {
    const segments = decodeAndValidatePathSegments(pathname)
    expect(matchLegacyReaderSegments(segments)).toBeNull()
  })

  test("preserves the wider legacy bound for a non-Reader fourth segment", () => {
    const segments = decodeAndValidatePathSegments(
      `/forfattare/A/mer/${"T".repeat(201)}`
    )
    expect(segments[3]).toHaveLength(201)
    expect(matchLegacyReaderSegments(segments)).toBeNull()
  })

  test.each([
    [100, true],
    [101, false]
  ])("enforces the decoded author boundary %i -> %s", (length, accepted) => {
    const action = () => decodeAndValidatePathSegments(`/forfattare/${"A".repeat(length)}`)
    if (accepted) expect(action()).toHaveLength(2)
    else expect(action).toThrow()
  })

  test.each([
    [100, true],
    [101, true],
    [200, true],
    [201, false]
  ])("enforces the decoded Reader title boundary %i -> %s", (length, accepted) => {
    const action = () => decodeAndValidatePathSegments(
      `/forfattare/A/titlar/${"T".repeat(length)}/sida/1/etext`
    )
    if (accepted) expect(matchLegacyReaderSegments(action())).not.toBeNull()
    else expect(action).toThrow()
  })

  test("classifies structure after decoding and locally rejects an encoded 201-char title", () => {
    expect(() => decodeAndValidatePathSegments(
      `/forfattare/A/%74itlar/${"T".repeat(201)}/sida/1/etext`
    )).toThrow()
  })

  test.each([
    ["author", `/forfattare/${"%2525252541".repeat(82)}`],
    [
      "Reader title",
      `/forfattare/A/titlar/${"%2525252554".repeat(164)}/sida/1/etext`
    ]
  ])("rejects a %s whose raw encoding exceeds its semantic cap", (_, pathname) => {
    expect(() => decodeAndValidatePathSegments(pathname)).toThrow()
    expect(errorData(() => decodeAndValidatePathSegments(pathname))).toEqual({
      code: "legacy_author_route_not_found"
    })
  })

  test("accepts direct UTF-8 encodings at the author and title raw ceilings", () => {
    const author = "文".repeat(100)
    const title = "文".repeat(200)
    expect(decodeAndValidatePathSegments(
      `/forfattare/${encodeURIComponent(author)}`
    )[1]).toBe(author)
    expect(decodeAndValidatePathSegments(
      `/forfattare/A/titlar/${encodeURIComponent(title)}/sida/1/etext`
    )[3]).toBe(title)
  })

  test.each([
    "/forfattare/A%2FB",
    "/forfattare/A%252FB",
    "/forfattare/A%5CB",
    "/forfattare/%2e%2e",
    "/forfattare/%252e%252e",
    "/forfattare/%ZZ",
    "/forfattare/%00",
    "/forfattare/%C2%85",
    "/forfattare/%ED%A0%80",
    "/forfattare/A/"
  ])("rejects unsafe encoded or structural input locally %#", pathname => {
    expect(() => decodeAndValidatePathSegments(pathname)).toThrow()
    expect(errorData(() => decodeAndValidatePathSegments(pathname))).toEqual({
      code: "legacy_author_route_not_found"
    })
  })

  test("rejects a non-stabilizing segment after sixteen decode passes", () => {
    let segment = "../private"
    for (let pass = 0; pass < 17; pass += 1) segment = encodeURIComponent(segment)
    expect(() => decodeAndValidatePathSegments(`/forfattare/${segment}`)).toThrow()
  })
})

describe("canonical legacy route identities", () => {
  test.each([
    ["A".repeat(100), 100, true],
    ["A".repeat(101), 100, false],
    ["T".repeat(200), 200, true],
    ["T".repeat(201), 200, false],
    ["LagerlöfS", 100, true],
    [".", 100, false],
    ["..", 100, false],
    [" A", 100, false],
    ["A ", 100, false],
    ["A%2FB", 100, false],
    ["A/B", 100, false],
    ["A\\B", 100, false],
    ["A\u0000B", 100, false],
    ["A\u0085B", 100, false],
    ["\ud800", 100, false],
    ["\udfff", 100, false]
  ])("validates canonical identity %# at maximum %i -> %s", (value, maximum, valid) => {
    expect(validCanonicalSegment(value as string, maximum as number)).toBe(valid)
  })
})

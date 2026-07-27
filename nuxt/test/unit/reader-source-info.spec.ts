import { describe, expect, test, vi } from "vitest"

import {
  buildReaderSourceInfo,
  clearReaderSourceInfoStaticCache,
  fetchReaderSourceInfoStaticDefinitions,
  fetchWorkSourceInfo,
  loadCachedReaderSourceInfoStaticDefinitions,
  parseReaderSourceInfoRequest,
  projectReaderSourceInfoLicense,
  projectReaderSourceInfoProvenance,
  resolveReaderSourceInfoAttributions,
  sanitizeReaderSourceInfoHtml,
  validateReaderSourceInfoResponse
} from "../../server/utils/reader-source-info"
import {
  cloneRecord,
  requiredArray,
  requiredRecord,
  type JsonRecord
} from "../helpers/malformed-json"
import {
  cendrillonInfopostSourceInfo,
  doktorGlasSourceInfo,
  dramaSourceInfo,
  emptyErrataSourceInfo,
  longErrataSourceInfo,
  navigableSparseSourceInfo,
  sourceInfoLicenses,
  sourceInfoProvenance,
  sparseSourceInfo
} from "../fixtures/reader-source-info-data.mjs"

function clone<T>(value: T): T {
  return structuredClone(value)
}

function statusCode(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : undefined
}

describe("Reader source-information runtime contract", () => {
  test("accepts the exact normal, drama, and sparse generated response shapes", () => {
    expect(validateReaderSourceInfoResponse(
      doktorGlasSourceInfo,
      "SöderbergH",
      "DoktorGlas"
    )).toEqual(doktorGlasSourceInfo)
    expect(validateReaderSourceInfoResponse(
      dramaSourceInfo,
      "AlmlöfN",
      "Affarer",
      "faksimil"
    )).toEqual(dramaSourceInfo)
    expect(validateReaderSourceInfoResponse(
      sparseSourceInfo,
      "SparseA",
      "SparseTitle"
    )).toEqual(sparseSourceInfo)
  })

  test.each([
    ["navigable sparse", navigableSparseSourceInfo, "SparseA", "SparseTitle"],
    ["long errata", longErrataSourceInfo, "LongErrataA", "LongErrata"],
    ["empty errata", emptyErrataSourceInfo, "EmptyErrataA", "EmptyErrata"]
  ])("accepts the %s browser fixture", (_name, source, author, title) => {
    expect(validateReaderSourceInfoResponse(source, author, title, "etext")).toEqual(source)
  })

  test.each([
    ["navigable sparse", navigableSparseSourceInfo],
    ["long errata", longErrataSourceInfo],
    ["empty errata", emptyErrataSourceInfo]
  ])("builds the %s browser fixture", async (_name, source) => {
    await expect(buildReaderSourceInfo(
      source,
      { provenance: sourceInfoProvenance, licenses: sourceInfoLicenses },
      async authorIds => authorIds.flatMap(authorId => authorId === "DramaRedaktionen"
          ? [{
              author_id: "DramaRedaktionen",
              full_name: "Dramawebbens redaktion",
              surname: null
            }]
          : [])
    )).resolves.toMatchObject({ title: source.title })
  })

  test.each([
    ["top-level extra field", (value: JsonRecord) => { value.unexpected = true }],
    ["wrong requested title", (value: JsonRecord) => { value.title_path = "Other" }],
    ["unsafe selected author", (value: JsonRecord) => { value.author_id = "../secret" }],
    ["duplicate author", (value: JsonRecord) => {
      const authors = requiredArray(value, "authors")
      authors.push(authors[0])
    }],
    ["author extra field", (value: JsonRecord) => {
      requiredRecord({ author: requiredArray(value, "authors")[0] }, "author").unexpected = true
    }],
    ["unsafe author URL", (value: JsonRecord) => {
      requiredRecord({ author: requiredArray(value, "authors")[0] }, "author").url = "javascript:bad()"
    }],
    ["cover traversal", (value: JsonRecord) => {
      requiredRecord(value, "cover").small_url = "/txt/%2e%2e/secret"
    }],
    ["duplicate read action", (value: JsonRecord) => {
      const actions = requiredArray(value, "read_actions")
      actions.push(actions[0])
    }],
    ["read action mismatch", (value: JsonRecord) => {
      requiredRecord({ action: requiredArray(value, "read_actions")[0] }, "action").label = "faksimil"
    }],
    ["unsafe download filename", (value: JsonRecord) => {
      requiredRecord({ action: requiredArray(value, "download_actions")[0] }, "action").filename = "../book.epub"
    }],
    ["unsafe download URL", (value: JsonRecord) => {
      requiredRecord({ action: requiredArray(value, "download_actions")[0] }, "action").url = "//evil.test/book"
    }],
    ["unsafe provenance key", (value: JsonRecord) => {
      requiredRecord({ provenance: requiredArray(value, "provenance")[0] }, "provenance").library = " GUB"
    }],
    ["wrong provenance flag", (value: JsonRecord) => {
      requiredRecord({ provenance: requiredArray(value, "provenance")[0] }, "provenance").use_alternate_text = 1
    }],
    ["oversized HTML", (value: JsonRecord) => { value.source_description_html = "x".repeat(200_001) }],
    ["errata extra field", (value: JsonRecord) => {
      requiredRecord({ errata: requiredArray(value, "errata")[0] }, "errata").unexpected = true
    }],
    ["too many errata cells", (value: JsonRecord) => {
      requiredRecord({ errata: requiredArray(value, "errata")[0] }, "errata").cells_html = Array(101).fill("")
    }],
    ["drama extra field", (value: JsonRecord) => {
      value.dramawebben = { ...dramaSourceInfo.dramawebben, unexpected: true }
    }],
    ["duplicate drama fact", (value: JsonRecord) => {
      value.dramawebben = clone(dramaSourceInfo.dramawebben)
      const facts = requiredArray(requiredRecord(value, "dramawebben"), "facts")
      facts.push(facts[0])
    }],
    ["invalid drama role", (value: JsonRecord) => {
      value.dramawebben = clone(dramaSourceInfo.dramawebben)
      requiredArray(requiredRecord(value, "dramawebben"), "roles")[0] = 42
    }],
    ["unsafe control character", (value: JsonRecord) => { value.title = "Doktor\u0000 Glas" }],
    ["unsafe C1 character", (value: JsonRecord) => { value.title = "Doktor\u0080 Glas" }]
  ])("rejects %s recursively", (_name, mutate) => {
    const value = cloneRecord(doktorGlasSourceInfo)
    mutate(value)
    expect(() => validateReaderSourceInfoResponse(
      value,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )).toThrow("Invalid Reader source information")
  })

  test("accepts a selected fallback media when no media was requested", () => {
    expect(validateReaderSourceInfoResponse(
      sparseSourceInfo,
      "SparseA",
      "SparseTitle"
    ).media_type).toBe("infopost")
  })

  test("accepts a backend lookup alias absent from projected public authors", () => {
    expect(validateReaderSourceInfoResponse(
      doktorGlasSourceInfo,
      "EditorRoute",
      "DoktorGlas",
      "etext"
    )).toEqual(doktorGlasSourceInfo)
  })

  test("rejects a canonical author that is not a public response author", () => {
    const value = clone(doktorGlasSourceInfo)
    value.author_id = "OtherAuthor"

    expect(() => validateReaderSourceInfoResponse(
      value,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )).toThrow("Invalid Reader source information")
  })

  test("accepts the backend selected-media fallback for an explicit request", () => {
    expect(validateReaderSourceInfoResponse(
      doktorGlasSourceInfo,
      "SöderbergH",
      "DoktorGlas",
      "faksimil"
    ).media_type).toBe("etext")
  })
})

describe("Reader source-information request boundary", () => {
  test("accepts exact safe identity and an optional scalar Reader media", () => {
    expect(parseReaderSourceInfoRequest(
      "SöderbergH",
      "DoktorGlas",
      { media_type: "faksimil" }
    )).toEqual({ authorId: "SöderbergH", titlePath: "DoktorGlas", mediaType: "faksimil" })
    expect(parseReaderSourceInfoRequest("SöderbergH", "DoktorGlas", {})).toEqual({
      authorId: "SöderbergH",
      titlePath: "DoktorGlas",
      mediaType: null
    })
  })

  test.each([
    ["", "DoktorGlas", {}],
    ["../SöderbergH", "DoktorGlas", {}],
    ["SöderbergH", "%2e%2e", {}],
    ["SöderbergH", "Doktor/Glas", {}],
    ["SöderbergH", "DoktorGlas", { media_type: ["etext", "faksimil"] }],
    ["SöderbergH", "DoktorGlas", { media_type: "pdf" }],
    ["SöderbergH", "DoktorGlas", { media_type: "etext", other: "1" }]
  ])("rejects unsafe paths and query containers", (author, title, query) => {
    expect(() => parseReaderSourceInfoRequest(author, title, query)).toThrow()
  })

  test("calls the exact generated operation with encoded path ownership", async () => {
    const GET = vi.fn().mockResolvedValue({
      data: doktorGlasSourceInfo,
      response: new Response(null, { status: 200 })
    })
    const result = await fetchWorkSourceInfo(
      { GET } as never,
      "SöderbergH",
      "DoktorGlas",
      "etext"
    )
    expect(result).toEqual(doktorGlasSourceInfo)
    expect(GET).toHaveBeenCalledOnce()
    expect(GET).toHaveBeenCalledWith(
      "/works/{author_id}/{title_path}/source-info",
      {
        params: {
          path: { author_id: "SöderbergH", title_path: "DoktorGlas" },
          query: { media_type: "etext" }
        },
        redirect: "manual"
      }
    )
  })

  test("maps an upstream absence to 404 and all supplementary failures to 502", async () => {
    const missing = { GET: vi.fn().mockResolvedValue({
      error: { error: { code: "source_info_not_found" } },
      response: new Response(null, { status: 404 })
    }) }
    const unavailable = { GET: vi.fn().mockResolvedValue({
      error: { error: { code: "secret-provider-message" } },
      response: new Response(null, { status: 503 })
    }) }
    const disconnected = { GET: vi.fn().mockRejectedValue(new Error("secret")) }

    await expect(fetchWorkSourceInfo(
      missing as never, "MissingA", "MissingTitle", null
    )).rejects.toSatisfy((error: unknown) => statusCode(error) === 404)
    await expect(fetchWorkSourceInfo(
      unavailable as never, "SöderbergH", "DoktorGlas", null
    )).rejects.toSatisfy((error: unknown) => statusCode(error) === 502)
    await expect(fetchWorkSourceInfo(
      disconnected as never, "SöderbergH", "DoktorGlas", null
    )).rejects.toSatisfy((error: unknown) => statusCode(error) === 502)
  })
})

describe("Reader source-information sanitizer", () => {
  test("preserves editorial structure while stripping active and unknown markup", () => {
    const source = [
      '<p class="workintro modal-backdrop modal fixed hidden in" onclick="bad()">Text <em>kursiv</em> <strong>fet</strong>.</p>',
      '<table><tbody><tr><td colspan="2"><span class="role fixed hidden">Roll</span></td></tr></tbody></table>',
      '<a href="/författare/S%C3%B6derbergH">intern</a>',
      '<a href="/forfattare/Alml%C3%B6fN">legacy intern</a>',
      '<a href="https://example.test/x" target="frame">extern</a>',
      '<a href="javascript:bad()">farlig</a>',
      '<a href="/%252e%252e/private">traversal</a>',
      '<script>script-probe</script><form><p>form-probe</p></form>',
      '<iframe src="https://example.test">iframe-probe</iframe>',
      '<unknown><i>bevarad text</i></unknown>'
    ].join("")

    const html = sanitizeReaderSourceInfoHtml(source, "editorial")
    expect(html).toContain('<p>Text <em>kursiv</em> <strong>fet</strong>.</p>')
    expect(html).toContain('<td colspan="2"><span class="role">Roll</span></td>')
    expect(html).toContain('<a href="/författare/S%C3%B6derbergH">intern</a>')
    expect(html).toContain('<a href="/författare/Alml%C3%B6fN">legacy intern</a>')
    expect(html).toContain('href="https://example.test/x"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain("<i>bevarad text</i>")
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("modal-backdrop")
    expect(html).not.toContain('class="modal')
    expect(html).not.toContain("fixed")
    expect(html).not.toContain("hidden")
    expect(html).not.toContain('class="workintro')
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("%252e")
    expect(html).not.toContain("script-probe")
    expect(html).not.toContain("form-probe")
    expect(html).not.toContain("iframe-probe")
    expect(html).not.toContain("<unknown")
  })

  test("sanitizes every structured errata cell without discarding empty cells", async () => {
    const dirty = clone(doktorGlasSourceInfo)
    dirty.errata = [{
      cells_html: [
        "",
        '<b onclick="bad()">rätt</b><table><tr><td>cell-breakout</td></tr></table><img src="data:text/html,bad"><script>bad</script>'
      ]
    }]
    const result = await buildReaderSourceInfo(
      dirty,
      { provenance: sourceInfoProvenance, licenses: sourceInfoLicenses },
      async () => []
    )
    expect(result.errata).toEqual([{
      cellsHtml: ["", "<b>rätt</b>cell-breakout"]
    }])
    expect(result.errata[0]?.cellsHtml[1]).not.toContain("<table")
    expect(result.errata[0]?.cellsHtml[1]).not.toContain("<td")
  })
})

describe("Reader source-information static resources", () => {
  test("fetches the exact runtime paths with bounded no-stale request options", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = String(input)
      const body = path.endsWith("provenance.json")
        ? sourceInfoProvenance
        : sourceInfoLicenses
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" }
      })
    })

    const result = await fetchReaderSourceInfoStaticDefinitions(
      "https://content.example.test/base/",
      fetchMock as typeof fetch
    )
    expect(result).toEqual({ provenance: sourceInfoProvenance, licenses: sourceInfoLicenses })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://content.example.test/base/red/etc/provenance/provenance.json",
      { method: "GET", redirect: "manual", cache: "no-cache", headers: { accept: "application/json" } }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://content.example.test/base/red/etc/license/license.json",
      { method: "GET", redirect: "manual", cache: "no-cache", headers: { accept: "application/json" } }
    )
  })

  test("deduplicates static loads and revalidates after the bounded max age", async () => {
    clearReaderSourceInfoStaticCache()
    const fetchMock = vi.fn(async (input: string | URL | Request) => new Response(
      JSON.stringify(String(input).endsWith("provenance.json")
        ? sourceInfoProvenance
        : sourceInfoLicenses),
      { status: 200, headers: { "content-type": "application/json" } }
    ))

    const first = loadCachedReaderSourceInfoStaticDefinitions(
      "https://cache.example.test",
      fetchMock as typeof fetch,
      1_000
    )
    const simultaneous = loadCachedReaderSourceInfoStaticDefinitions(
      "https://cache.example.test",
      fetchMock as typeof fetch,
      1_000
    )
    expect(await first).toEqual(await simultaneous)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await loadCachedReaderSourceInfoStaticDefinitions(
      "https://cache.example.test",
      fetchMock as typeof fetch,
      300_999
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await loadCachedReaderSourceInfoStaticDefinitions(
      "https://cache.example.test",
      fetchMock as typeof fetch,
      301_000
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  test.each([
    ["transport failure", () => Promise.reject(new Error("offline"))],
    ["wrong status", () => Promise.resolve(new Response("{}", { status: 503 }))],
    ["wrong content type", () => Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "text/html" } }))],
    ["malformed JSON", () => Promise.resolve(new Response("{bad", { status: 200, headers: { "content-type": "application/json" } }))],
    ["oversized JSON", () => Promise.resolve(new Response(JSON.stringify({ x: "x".repeat(1_048_577) }), { status: 200, headers: { "content-type": "application/json" } }))],
    ["malformed definition", () => Promise.resolve(new Response(JSON.stringify({ GUB: { link: [] } }), { status: 200, headers: { "content-type": "application/json" } }))]
  ])("rejects %s as a non-leaking supplementary 502", async (_name, implementation) => {
    clearReaderSourceInfoStaticCache()
    const fetchMock = vi.fn(implementation)
    await expect(fetchReaderSourceInfoStaticDefinitions(
      "https://content.example.test",
      fetchMock as typeof fetch
    )).rejects.toSatisfy((error: unknown) => statusCode(error) === 502)
  })

  test("selects media text, alternate text, signum, and safe local provenance images", () => {
    const projected = projectReaderSourceInfoProvenance(
      sourceInfoProvenance,
      dramaSourceInfo.provenance,
      "faksimil",
      true
    )
    expect(projected).toEqual([
      {
        fullName: "Kungl. biblioteket",
        imageUrl: "/red/bilder/gemensamt/kblogga.png",
        link: "http://www.kb.se/",
        text: "Det avbildade exemplaret tillhör Kungl. biblioteket (Sv. teater 204)."
      },
      {
        fullName: "Dramawebben",
        imageUrl: "/red/bilder/gemensamt/dramawebben_svart.svg",
        link: "http://www.dramawebben.se/",
        text: "Tillgängliggjord i samarbete med Dramawebben."
      }
    ])
  })

  test("trusts the backend alternate-text flag even on the first projected row", () => {
    const projected = projectReaderSourceInfoProvenance(
      sourceInfoProvenance,
      [{ library: "Dramawebben", signum: null, use_alternate_text: true }],
      "etext",
      true
    )
    expect(projected[0]?.text).toBe("Litteraturbanken och Dramawebben.")
  })

  test("keeps infopost provenance identity for attribution without inventing prose", () => {
    const projected = projectReaderSourceInfoProvenance(
      sourceInfoProvenance,
      [{ library: "Dramawebben", signum: null, use_alternate_text: false }],
      "infopost",
      null
    )

    expect(projected).toEqual([{
      fullName: "Dramawebben",
      imageUrl: "/red/bilder/gemensamt/dramawebben_svart.svg",
      link: "http://www.dramawebben.se/",
      text: ""
    }])
    expect(projectReaderSourceInfoLicense(sourceInfoLicenses, "pd", projected))
      .toContain("Dramawebben")
    expect(projectReaderSourceInfoLicense(sourceInfoLicenses, "pd", projected))
      .not.toContain("hänvisar till och")
  })

  test("builds the Cendrillon infopost attribution without a dangling conjunction", async () => {
    expect(validateReaderSourceInfoResponse(
      cendrillonInfopostSourceInfo,
      "WahlenbergA",
      "Cendrillon"
    )).toEqual(cendrillonInfopostSourceInfo)
    const sourceInfo = await buildReaderSourceInfo(
      cendrillonInfopostSourceInfo,
      { provenance: sourceInfoProvenance, licenses: sourceInfoLicenses },
      async () => []
    )

    expect(sourceInfo.provenance).toHaveLength(1)
    expect(sourceInfo.licenseHtml).toContain("Vid användning ber vi att du hänvisar till")
    expect(sourceInfo.licenseHtml).toMatch(
      /<a [^>]*href="http:\/\/www\.dramawebben\.se\/"[^>]*>Dramawebben<\/a>/u
    )
    expect(sourceInfo.licenseHtml).toContain("och Litteraturbanken.se.")
  })

  test("skips unknown provenance and license keys without losing the source record", async () => {
    const projected = projectReaderSourceInfoProvenance(
      sourceInfoProvenance,
      sparseSourceInfo.provenance,
      "infopost",
      null
    )
    expect(projected).toEqual([{
      fullName: "Göteborgs universitetsbibliotek",
      imageUrl: "/red/bilder/gemensamt/gublogga.png",
      link: "http://www.ub.gu.se/",
      text: ""
    }])
    expect(projectReaderSourceInfoLicense(
      sourceInfoLicenses,
      "unknown-license",
      projected
    )).toBeNull()

    const sourceInfo = await buildReaderSourceInfo(
      sparseSourceInfo,
      { provenance: sourceInfoProvenance, licenses: sourceInfoLicenses },
      async () => []
    )
    expect(sourceInfo.workId).toBe("lbSparse1")
    expect(sourceInfo.provenance).toEqual(projected)
    expect(sourceInfo.licenseHtml).toBeNull()
  })

  test("accepts production provenance definitions with an etext-only map", () => {
    expect(projectReaderSourceInfoProvenance(
      {
        privat: {
          fullname: "Privat ägo",
          image: null,
          link: null,
          text: { etext: "Material från privat ägo{{signum}}." }
        }
      },
      [{ library: "privat", signum: "A 1", use_alternate_text: false }],
      "etext",
      true
    )).toEqual([{
      fullName: "Privat ägo",
      imageUrl: null,
      link: null,
      text: "Material från privat ägo (A 1)."
    }])
  })

  test.each([
    [
      "credentialed provenance link",
      {
        GUB: {
          ...sourceInfoProvenance.GUB,
          link: "https://user:secret@example.test/"
        }
      },
      sourceInfoLicenses
    ],
    [
      "provenance image traversal",
      {
        GUB: {
          ...sourceInfoProvenance.GUB,
          image: ".."
        }
      },
      sourceInfoLicenses
    ],
    [
      "unknown provenance token",
      {
        GUB: {
          ...sourceInfoProvenance.GUB,
          text: { ...sourceInfoProvenance.GUB.text, etext: "{{secret}}" }
        }
      },
      sourceInfoLicenses
    ],
    [
      "unknown license token",
      sourceInfoProvenance,
      { ...sourceInfoLicenses, pd: "<text><p>{{secret}}</p></text>" }
    ]
  ])("rejects %s in fetched static definitions", async (_name, provenance, licenses) => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => new Response(
      JSON.stringify(String(input).endsWith("provenance.json") ? provenance : licenses),
      { status: 200, headers: { "content-type": "application/json" } }
    ))
    await expect(fetchReaderSourceInfoStaticDefinitions(
      "https://validation.example.test",
      fetchMock as typeof fetch
    )).rejects.toSatisfy((error: unknown) => statusCode(error) === 502)
  })

  test("unwraps license text, interpolates provenance, and rewrites relative images", () => {
    const provenance = projectReaderSourceInfoProvenance(
      sourceInfoProvenance,
      dramaSourceInfo.provenance,
      "faksimil",
      true
    )
    const html = projectReaderSourceInfoLicense(sourceInfoLicenses, "pd", provenance)
    expect(html).not.toContain("<text")
    expect(html).toMatch(/<a [^>]*href="http:\/\/www\.kb\.se\/"[^>]*>Kungl\. biblioteket<\/a>/u)
    expect(html).toMatch(/<a [^>]*target="_blank"[^>]*>Kungl\. biblioteket<\/a>/u)
    expect(html).toMatch(/<a [^>]*rel="noopener noreferrer"[^>]*>Kungl\. biblioteket<\/a>/u)
    expect(html).toContain(" – ")
    expect(html).toContain('src="/red/bilder/gemensamt/cc-pd-128x128.png"')
    expect(html).not.toContain('style=')
  })
})

describe("Reader source-information attribution boundary", () => {
  test("reuses work authors and resolves missing IDs in one bounded ordered call", async () => {
    const resolver = vi.fn().mockResolvedValue([
      { author_id: "DramaRedaktionen", full_name: "Dramawebbens redaktion", surname: null },
      { author_id: "LindgrenU", full_name: "Ulrika Lindgren", surname: "Lindgren" }
    ])
    const result = await resolveReaderSourceInfoAttributions(dramaSourceInfo, resolver)
    expect(resolver).toHaveBeenCalledOnce()
    expect(resolver).toHaveBeenCalledWith(["DramaRedaktionen", "LindgrenU"])
    expect(result).toEqual({
      sourceDescriptionAuthor: {
        authorId: "DramaRedaktionen",
        fullName: "Dramawebbens redaktion",
        surname: null
      },
      workIntroductionAuthor: {
        authorId: "LindgrenU",
        fullName: "Ulrika Lindgren",
        surname: "Lindgren"
      }
    })
  })

  test("does not call the resolver for an existing work author", async () => {
    const raw = clone(doktorGlasSourceInfo)
    raw.source_description_author_id = "SöderbergH"
    const resolver = vi.fn()
    const result = await resolveReaderSourceInfoAttributions(raw, resolver)
    expect(resolver).not.toHaveBeenCalled()
    expect(result.sourceDescriptionAuthor?.fullName).toBe("Hjalmar Söderberg")
  })

  test("uses the raw ID fallback but rejects malformed resolver containers", async () => {
    const missing = await resolveReaderSourceInfoAttributions(
      dramaSourceInfo,
      async () => []
    )
    expect(missing.sourceDescriptionAuthor?.fullName).toBe("DramaRedaktionen")
    const unavailable = await resolveReaderSourceInfoAttributions(
      dramaSourceInfo,
      async () => { throw new Error("offline") }
    )
    expect(unavailable.workIntroductionAuthor?.fullName).toBe("LindgrenU")
    await expect(resolveReaderSourceInfoAttributions(
      dramaSourceInfo,
      async () => [{ author_id: "Other", full_name: "Other", surname: null }]
    )).rejects.toSatisfy((error: unknown) => statusCode(error) === 502)
  })
})

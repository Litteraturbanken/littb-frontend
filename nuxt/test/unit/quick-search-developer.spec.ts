import { describe, expect, test } from "vitest"

import {
  developerQuickSearchCommands,
  editorDestination,
  parseRedFtpResponse,
  publishQuickSearchContext,
  stableDeveloperJson,
  toBoundedDeveloperValue,
  type QuickSearchContext
} from "../../app/lib/quick-search-developer"
import { lookupRedFtp } from "../../server/utils/red-ftp"

function readerContext(owner: string): QuickSearchContext {
  return {
    kind: "reader",
    owner,
    workId: "lb123",
    editorWorkId: null,
    pageIndex: 7,
    mediaType: "etext",
    info: { title: "B", author: { name: "A", id: "a" } }
  }
}

describe("Quick Search developer context ownership", () => {
  test("an older publisher cannot clear a newer route context", () => {
    const state: { value: QuickSearchContext | null } = { value: null }
    const clearFirst = publishQuickSearchContext(state, readerContext("first"))
    const clearSecond = publishQuickSearchContext(state, readerContext("second"))

    clearFirst()
    expect(state.value?.owner).toBe("second")
    clearSecond()
    expect(state.value).toBeNull()
  })

  test("replacing one owner's value keeps its cleanup ownership", () => {
    const state: { value: QuickSearchContext | null } = { value: null }
    const clear = publishQuickSearchContext(state, readerContext("reader"))
    publishQuickSearchContext(state, { ...readerContext("reader"), pageIndex: 8 })

    expect(state.value).toMatchObject({ owner: "reader", pageIndex: 8 })
    clear()
    expect(state.value).toBeNull()
  })
})

describe("Quick Search stable developer information", () => {
  test("recursively sorts object keys before formatting JSON", () => {
    expect(stableDeveloperJson({ z: 1, a: { z: false, a: true }, m: [
      { y: 2, x: 1 }
    ] })).toBe([
      "{",
      '  "a": {',
      '    "a": true,',
      '    "z": false',
      "  },",
      '  "m": [',
      "    {",
      '      "x": 1,',
      '      "y": 2',
      "    }",
      "  ],",
      '  "z": 1',
      "}"
    ].join("\n"))
  })

  test("bounds strings, arrays, keys, depth, cycles, and non-JSON values", () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const value = toBoundedDeveloperValue({
      array: Array.from({ length: 110 }, (_, index) => index),
      cyclic,
      function: () => undefined,
      nested: { one: { two: { three: { four: { five: { six: { seven: 1 } } } } } } },
      text: "x".repeat(2_100)
    }) as Record<string, unknown>

    expect((value.array as unknown[]).length).toBeLessThanOrEqual(101)
    expect((value.text as string).length).toBeLessThanOrEqual(2_013)
    expect(value.cyclic).toEqual({ self: "[circular]" })
    expect(value.function).toBe("[unsupported]")
    expect(JSON.stringify(value).length).toBeLessThanOrEqual(65_536)
  })
})

describe("Quick Search developer commands", () => {
  test("filters contextual slash commands and lb lookup actions", () => {
    expect(developerQuickSearchCommands("/", readerContext("reader"), true)
      .map(row => row.label)).toEqual(["/id", "/editor", "/info"])
    expect(developerQuickSearchCommands("/id", {
      kind: "author",
      owner: "author",
      info: { authorId: "SöderbergH" }
    }, true).map(row => row.label)).toEqual([])
    expect(developerQuickSearchCommands("/info", {
      kind: "author",
      owner: "author",
      info: { authorId: "SöderbergH" }
    }, true).map(row => row.label)).toEqual(["/info"])
    expect(developerQuickSearchCommands("lb123", null, true).map(row => row.typeLabel))
      .toEqual(["[Red.] Gå till faksimileditorn", "[Red.] Sök i ftp"])
    expect(developerQuickSearchCommands("lb123", readerContext("reader"), false))
      .toEqual([])
  })

  test("keeps dotted work IDs eligible only for the typed FTP lookup", () => {
    expect(developerQuickSearchCommands("lb123.foo", null, true)
      .map(row => row.typeLabel)).toEqual(["[Red.] Sök i ftp"])
    expect(developerQuickSearchCommands("/", {
      ...readerContext("reader"),
      workId: "lb123.foo"
    }, true).map(row => row.label)).toEqual(["/id", "/info"])
  })

  test.each([
    ["lb123", 7, "etext", "/editor/lb123/ix/7/e"],
    ["lb123", 0, "faksimil", "/editor/lb123/ix/0/f"],
    ["lb123.foo", 0, "faksimil", null],
    ["bad/id", 0, "faksimil", null],
    ["lb123", -1, "faksimil", null],
    ["lb123", 1.5, "etext", null]
  ] as const)("builds a bounded Editor destination for %s", (
    workId,
    pageIndex,
    mediaType,
    expected
  ) => {
    expect(editorDestination(workId, pageIndex, mediaType)).toBe(expected)
  })
})

describe("Red FTP response parsing", () => {
  test("projects bounded mount paths into legacy breadcrumb handoffs", () => {
    expect(parseRedFtpResponse([
      "/mnt/ftp/red/lb123/files/page.xml",
      "/mnt/ftp/red/lb123/images/cover.jpeg",
      ""
    ].join("\n"))).toEqual([
      {
        url: "//mnt/ftp/red/lb123/files/page.xml",
        breadcrumbs: [
          { label: "lb123", url: "//mnt/ftp/red/lb123" },
          { label: "files", url: "//mnt/ftp/red/lb123/files" }
        ]
      },
      {
        url: "//mnt/ftp/red/lb123/images/cover.jpeg",
        breadcrumbs: [
          { label: "lb123", url: "//mnt/ftp/red/lb123" },
          { label: "images", url: "//mnt/ftp/red/lb123/images" }
        ]
      }
    ])
  })

  test("decodes provider labels once and reconstructs canonical safe hrefs", () => {
    expect(parseRedFtpResponse([
      "/mnt/ftp/red/lb123/F%C3%B6rfattare/Page%20One.xml",
      "/mnt/ftp/red/lb123/literal%2520name/file.xml",
      "/mnt/ftp/red/lb123/%252E%252E/safe%252f%255c%3F%23name"
    ].join("\n"))).toEqual([
      {
        url: "//mnt/ftp/red/lb123/F%C3%B6rfattare/Page%20One.xml",
        breadcrumbs: [
          { label: "lb123", url: "//mnt/ftp/red/lb123" },
          { label: "Författare", url: "//mnt/ftp/red/lb123/F%C3%B6rfattare" }
        ]
      },
      {
        url: "//mnt/ftp/red/lb123/literal%2520name/file.xml",
        breadcrumbs: [
          { label: "lb123", url: "//mnt/ftp/red/lb123" },
          { label: "literal%20name", url: "//mnt/ftp/red/lb123/literal%2520name" }
        ]
      },
      {
        url: "//mnt/ftp/red/lb123/%252E%252E/safe%252f%255c%3F%23name",
        breadcrumbs: [
          { label: "lb123", url: "//mnt/ftp/red/lb123" },
          { label: "%2E%2E", url: "//mnt/ftp/red/lb123/%252E%252E" }
        ]
      }
    ])
    const parsed = new URL(
      parseRedFtpResponse("/mnt/ftp/red/lb123/raw?# name")![0]!.url,
      "https://litteraturbanken.se"
    )
    expect({
      host: parsed.host,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash
    }).toEqual({
      host: "mnt",
      pathname: "/ftp/red/lb123/raw%3F%23%20name",
      search: "",
      hash: ""
    })
  })

  test.each([
    ["x".repeat(65_537)],
    ["https://evil.test/file"],
    ["/mnt/ftp/red/lb123/unsafe\u0080file"],
    ["/mnt/ftp/red/lb123/../secret"],
    ["/mnt/ftp/red/lb123/%2e%2e/secret"],
    ["/mnt/ftp/red/lb123/%2E/secret"],
    ["/mnt/ftp/red/lb123/safe%2Fadmin/file"],
    ["/mnt/ftp/red/lb123/safe%5Cadmin/file"],
    ["/mnt/ftp/red/lb123/unsafe%00file"],
    ["/mnt/ftp/red/lb123/unsafe\ud800file"],
    ["/mnt/ftp/red/lb123/malformed%ZZfile"],
    [Array.from({ length: 51 }, () => "/mnt/ftp/red/lb123/file").join("\n")]
  ])("rejects an unsafe or oversized provider response", source => {
    expect(parseRedFtpResponse(source)).toBeNull()
  })

  test("fetches only the fixed Red lookup endpoint and parses its response", async () => {
    const requests: string[] = []
    const entries = await lookupRedFtp("lb123", async url => {
      requests.push(url)
      return "/mnt/ftp/red/lb123/files/page.xml"
    })

    expect(requests).toEqual(["https://red.litteraturbanken.se/hitta?q=lb123"])
    expect(entries?.[0]?.url).toBe("//mnt/ftp/red/lb123/files/page.xml")
  })

  test("rejects an invalid query without contacting Red", async () => {
    let called = false
    await expect(lookupRedFtp("lb123/../../secret", async () => {
      called = true
      return ""
    })).resolves.toBeNull()
    expect(called).toBe(false)
  })
})

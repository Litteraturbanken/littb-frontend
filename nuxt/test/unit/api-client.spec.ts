import { describe, expect, test, vi } from "vitest"

import { createLbApiClient } from "../../app/lib/api/client"
import type {
  EditorManifestResponse,
  ReaderManifestResponse
} from "../../shared/types/work-manifest"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  })

const readerManifestFixture = {
  media_type: "etext",
  author_id: "SöderbergH",
  title_path: "DoktorGlas",
  work_id: "lb-reader-doktor-glas",
  editor_work_id: null,
  contributors: [{
    author_id: "SöderbergH",
    full_name: "Hjalmar Söderberg",
    author_type: null,
    role: null
  }],
  display_title: "Doktor Glas",
  full_title: "Doktor Glas. Roman",
  imprint_year: "1905",
  urn: null,
  pages: [{ page_name: "-2", page_index: 0 }],
  declared_page_count: 1,
  page_step: 1,
  start_page_name: "-2",
  end_page_name: "-2",
  parts: [],
  alternate_media: null,
  searchable: true,
  is_drama: false,
  has_dramawebben: false,
  has_nya_vagar: false
} satisfies ReaderManifestResponse

const editorManifestFixture = {
  status: "page_bounds_only",
  work_id: "lb-editor-doktor-glas",
  media_type: "etext",
  bounds: { kind: "sparse", page_indexes: [0, 2] }
} satisfies EditorManifestResponse

describe("generated LB API client", () => {
  test("exposes a response request ID without global state", async () => {
    const observeRequestId = vi.fn()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      works: 1,
      authors: 2,
      pages: { etext: 3, faksimil: 4 },
      words: { etext: 5, faksimil: 6 },
      epubs: 7
    }), {
      headers: {
        "content-type": "application/json",
        "x-request-id": "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d"
      }
    }))
    const client = createLbApiClient(
      "http://example.test/v2",
      fetchMock,
      observeRequestId
    )

    await client.GET("/stats")

    expect(observeRequestId).toHaveBeenCalledExactlyOnceWith(
      "018f47c0-4d5b-7a62-8f41-a04b5df3fd8d"
    )
  })

  test("encodes the exact typed Reader manifest identity", async () => {
    const fetchMock = vi.fn(async () => json(readerManifestFixture))
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    await client.GET("/works/{author_id}/{title_path}/manifest", {
      params: {
        path: { author_id: "SöderbergH", title_path: "DoktorGlas" },
        query: { media_type: "etext" }
      }
    })

    expect(fetchMock.mock.calls[0][0].url).toBe(
      "http://example.test/v2/works/S%C3%B6derbergH/DoktorGlas/manifest?media_type=etext"
    )
  })

  test("returns typed Editor bounds and unavailable errors", async () => {
    const successFetchMock = vi.fn(async () => json(editorManifestFixture))
    const client = createLbApiClient("http://example.test/v2", successFetchMock)

    const { data, error } = await client.GET(
      "/works/{work_id}/editor-manifest",
      {
        params: {
          path: { work_id: "lb-editor-doktor-glas" },
          query: { media_type: "etext" }
        }
      }
    )

    expect(error).toBeUndefined()
    expect(data?.status).toBe("page_bounds_only")
    expect(data?.bounds.kind).toBe("sparse")

    const unavailableFetchMock = vi.fn(async () =>
      json({
        error: {
          code: "editor_manifest_unavailable",
          message: "Unable to load Editor manifest",
          details: null
        }
      }, 503)
    )
    const unavailableClient = createLbApiClient(
      "http://example.test/v2",
      unavailableFetchMock
    )
    const unavailable = await unavailableClient.GET(
      "/works/{work_id}/editor-manifest",
      {
        params: {
          path: { work_id: "lb-editor-doktor-glas" },
          query: { media_type: "etext" }
        }
      }
    )

    if (!unavailable.error) {
      throw new Error("Expected an Editor manifest error body")
    }
    expect(unavailable.error.error.code).toBe("editor_manifest_unavailable")
  })

  test("calls the schema-relative stats path under the supplied v2 base", async () => {
    const fetchMock = vi.fn(async (_request: Request) =>
      json({
        works: 1,
        authors: 2,
        pages: { etext: 3, faksimil: 4 },
        words: { etext: 5, faksimil: 6 },
        epubs: 7
      })
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error } = await client.GET("/stats")

    expect(error).toBeUndefined()
    expect(data?.pages.etext).toBe(3)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0].url).toBe("http://example.test/v2/stats")
  })

  test("serializes the typed ranking limit", async () => {
    const fetchMock = vi.fn(async () => json({ items: [] }))
    const client = createLbApiClient("http://example.test/api/v2/", fetchMock)

    await client.GET("/works/popular", { params: { query: { limit: 30 } } })

    expect(fetchMock.mock.calls[0][0].url).toBe(
      "http://example.test/api/v2/works/popular?limit=30"
    )
  })

  test("returns the typed v2 error body for a non-2xx response", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        {
          error: {
            code: "popular_epubs_unavailable",
            message: "Unable to load popular EPUBs",
            details: null
          }
        },
        503
      )
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error, response } = await client.GET("/epubs/popular", {
      params: { query: { limit: 12 } }
    })

    expect(response.status).toBe(503)
    expect(data).toBeUndefined()
    expect(error?.error.code).toBe("popular_epubs_unavailable")
  })

  test("posts the exact typed Contact payload and accepts a 202 response", async () => {
    const fetchMock = vi.fn(async () => json({ status: "accepted" }, 202))
    const client = createLbApiClient("http://example.test/v2", fetchMock)
    const body = {
      sender_name: "Anna Andersson",
      sender_address: "anna@example.test",
      message: "Hej!",
      audience: "litteraturbanken" as const
    }

    const { data, error, response } = await client.POST("/contact", { body })

    expect(response.status).toBe(202)
    expect(error).toBeUndefined()
    expect(data).toEqual({ status: "accepted" })
    expect(fetchMock).toHaveBeenCalledOnce()
    const request = fetchMock.mock.calls[0][0]
    expect(request.url).toBe("http://example.test/v2/contact")
    expect(request.method).toBe("POST")
    expect(await request.json()).toEqual(body)
  })

  test("posts the exact typed Library body and forwards its AbortSignal", async () => {
    const fetchMock = vi.fn(async () => json({
      mode: "works",
      items: [],
      total_hits: 0,
      total_works: 0
    }))
    const client = createLbApiClient("http://example.test/v2", fetchMock)
    const controller = new AbortController()
    const body = {
      mode: "works" as const,
      filters: {
        query: "Selma",
        gender: null,
        categories: [],
        narrowing_categories: [],
        about_author_ids: [],
        media: [],
        languages: [],
        year_from: null,
        year_to: null
      },
      sort: "author" as const,
      reverse: false,
      page: 1,
      source_only: false
    }

    const { data, error } = await client.POST("/library/search", {
      body,
      signal: controller.signal
    })

    expect(error).toBeUndefined()
    expect(data?.mode).toBe("works")
    expect(fetchMock).toHaveBeenCalledOnce()
    const request = fetchMock.mock.calls[0][0]
    expect(request.url).toBe("http://example.test/v2/library/search")
    expect(request.method).toBe("POST")
    expect(request.signal.aborted).toBe(false)
    controller.abort()
    expect(request.signal.aborted).toBe(true)
    expect(await request.json()).toEqual(body)
  })

  test("returns the typed Contact delivery failure", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        {
          error: {
            code: "contact_delivery_failed",
            message: "Unable to send contact message",
            details: null
          }
        },
        502
      )
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error, response } = await client.POST("/contact", {
      body: {
        sender_name: null,
        sender_address: "a@b",
        message: "Hej!",
        audience: "oversattarlexikon"
      }
    })

    expect(response.status).toBe(502)
    expect(data).toBeUndefined()
    expect(error?.error.code).toBe("contact_delivery_failed")
  })

  test("encodes the typed Quick Search query", async () => {
    const fetchMock = vi.fn(async () => json({ items: [], correction: null }))
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    await client.GET("/quick-search", {
      params: { query: { query: "Söderberg & Strindberg" } }
    })

    expect(fetchMock.mock.calls[0][0].url).toBe(
      "http://example.test/v2/quick-search?query=S%C3%B6derberg%20%26%20Strindberg"
    )
  })

  test("returns typed Quick Search author, work, and part items", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        items: [
          {
            kind: "author",
            label: "Strindberg, August (1849-1912)",
            url: "/författare/StrindbergA",
            type_label: "Författare",
            media_type_label: null
          },
          {
            kind: "work",
            label: "Strindberg – Röda rummet",
            url: "/författare/StrindbergA/titlar/RodaRummet/sida/1/etext",
            type_label: "Verk",
            media_type_label: "etext"
          },
          {
            kind: "part",
            label: "Lagerlöf – Landskapet",
            url: "/författare/LagerlofS/titlar/GostaBerlingsSaga/sida/3/faksimil",
            type_label: "Del",
            media_type_label: "faksimil"
          }
        ],
        correction: null
      })
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error } = await client.GET("/quick-search", {
      params: { query: { query: "strindberg" } }
    })

    expect(error).toBeUndefined()
    expect(data?.items.map(item => item.kind)).toEqual(["author", "work", "part"])
    expect(data?.items[0].media_type_label).toBeNull()
    expect(data?.items[2].media_type_label).toBe("faksimil")
  })

  test("returns the typed Quick Search 503 body", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        {
          error: {
            code: "quick_search_unavailable",
            message: "Unable to load quick-search results",
            details: null
          }
        },
        503
      )
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error, response } = await client.GET("/quick-search", {
      params: { query: { query: "strindberg" } }
    })

    expect(response.status).toBe(503)
    expect(data).toBeUndefined()
    expect(error?.error.code).toBe("quick_search_unavailable")
  })

  test("posts the exact typed Unicode work lookup body and returns display rows", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        items: [
          {
            work_id: "lb238704",
            author: {
              label: "Strindberg",
              url: "/författare/StrindbergA"
            },
            title: {
              label: "Röda rummet",
              url: "/författare/StrindbergA/titlar/RodaRummet/etext"
            },
            media: [
              {
                label: "etext",
                url: "/författare/StrindbergA/titlar/RodaRummet/etext"
              },
              {
                label: "faksimil",
                url: "/författare/StrindbergA/titlar/RodaRummet/faksimil"
              }
            ]
          }
        ]
      })
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)
    const body = {
      work_id: null,
      titles: ["Röda rummet", "Gösta Berlings saga"]
    }
    const abortController = new AbortController()
    const signal = abortController.signal

    const { data, error } = await client.POST("/works/lookup", { body, signal })

    expect(error).toBeUndefined()
    expect(data?.items[0].media.map(item => item.label)).toEqual([
      "etext",
      "faksimil"
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
    const request = fetchMock.mock.calls[0][0]
    expect(request.url).toBe("http://example.test/v2/works/lookup")
    expect(request.method).toBe("POST")
    expect(await request.json()).toEqual(body)
    abortController.abort()
    expect(request.signal.aborted).toBe(true)
  })

  test("returns the typed work lookup 503 body", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        {
          error: {
            code: "work_lookup_unavailable",
            message: "Unable to load ID lookup results",
            details: null
          }
        },
        503
      )
    )
    const client = createLbApiClient("http://example.test/v2", fetchMock)

    const { data, error, response } = await client.POST("/works/lookup", {
      body: { work_id: "lb238704", titles: [] }
    })

    expect(response.status).toBe(503)
    expect(data).toBeUndefined()
    expect(error?.error.code).toBe("work_lookup_unavailable")
  })
})

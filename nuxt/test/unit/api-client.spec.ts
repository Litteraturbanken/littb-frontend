import { describe, expect, test, vi } from "vitest"

import { createLbApiClient } from "../../app/lib/api/client"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  })

describe("generated LB API client", () => {
  test("calls the schema-relative stats path under the supplied v2 base", async () => {
    const fetchMock = vi.fn(async (request: Request) =>
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
})

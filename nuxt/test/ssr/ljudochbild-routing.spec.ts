import { request as makeHttpRequest } from "node:http"
import { expect, test, type APIRequestContext } from "@playwright/test"

const externalBase = "https://litteraturbanken.se/ljudochbild/"

async function expectExternalRedirect(
  request: APIRequestContext,
  path: string,
  location: string
) {
  const response = await request.get(path, { maxRedirects: 0 })

  expect(response.status()).toBe(302)
  expect(response.headers().location).toBe(location)

  const body = await response.text()
  expect(body).not.toContain("site-shell")
  expect(body).not.toContain("leftCorridor")
}

async function expectRawNotRedirected(baseURL: string, path: string) {
  const origin = new URL(baseURL)
  const result = await new Promise<{ status?: number, location?: string }>((resolve, reject) => {
    const outgoing = makeHttpRequest({
      hostname: origin.hostname,
      port: origin.port,
      method: "GET",
      path
    }, response => {
      response.resume()
      response.on("end", () => resolve({
        status: response.statusCode,
        location: response.headers.location
      }))
    })
    outgoing.on("error", reject)
    outgoing.end()
  })

  expect(result.status).toBe(404)
  expect(result.location).toBeUndefined()
}

test("redirects both root spellings to the trailing-slash external root", async ({
  request
}) => {
  await expectExternalRedirect(request, "/ljudochbild", externalBase)
  await expectExternalRedirect(request, "/ljudochbild/", externalBase)
})

test("preserves nested path suffixes and their percent encoding", async ({ request }) => {
  const suffix = "f%C3%B6rfattare/Hjalmar%20S%C3%B6derberg/F%25C3%25B6rfattare/fr%C3%A5ga%3Fsvar%23del/"

  await expectExternalRedirect(
    request,
    `/ljudochbild/${suffix}`,
    `${externalBase}${suffix}`
  )
})

test("preserves query strings exactly", async ({ request }) => {
  const query = "?s=Hjalmar%20S%C3%B6derberg&media=ljud%2Fbild"

  await expectExternalRedirect(
    request,
    `/ljudochbild/${query}`,
    `${externalBase}${query}`
  )
})

test("hands Ljud och bild off only for safe methods", async ({ request }) => {
  const path = "/ljudochbild/f%C3%B6rfattare?media=ljud%2Fbild&empty="
  const head = await request.fetch(path, { method: "HEAD", maxRedirects: 0 })
  expect(head.status()).toBe(302)
  expect(head.headers().location).toBe(
    `${externalBase}f%C3%B6rfattare?media=ljud%2Fbild&empty=`
  )

  for (const method of ["POST", "PUT", "DELETE"] as const) {
    const response = await request.fetch(path, { method, maxRedirects: 0 })
    expect(response.status(), method).toBe(404)
    expect(response.headers().location, method).toBeUndefined()
  }
})

test("keeps absolute-looking suffixes on the fixed external origin", async ({ request }) => {
  await expectExternalRedirect(
    request,
    "/ljudochbild//evil.example/path",
    `${externalBase}/evil.example/path`
  )
})

test("does not match prefix lookalikes", async ({ request }) => {
  for (const path of ["/ljudochbilder", "/ljudochbildning"]) {
    const response = await request.get(path, { maxRedirects: 0 })

    expect(response.status()).toBe(404)
    expect(response.headers().location).toBeUndefined()
  }
})

test("rejects raw encoded Ljud och bild handoff escapes", async ({ baseURL }) => {
  expect(baseURL).toBeTruthy()
  for (const suffix of [
    "foo/%2e%2e/admin",
    "foo/%252e%252e/admin",
    "safe%2fadmin",
    "safe%252fadmin",
    "safe%5cadmin",
    "safe%255cadmin",
    "safe%250aadmin"
  ]) {
    await expectRawNotRedirected(baseURL!, `/ljudochbild/${suffix}`)
  }
})

import { request as makeHttpRequest } from "node:http"
import { expect, test, type APIRequestContext } from "@playwright/test"

const externalBase = "https://litteraturbanken.se/skolan/"

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

test("redirects both Skolan root spellings to the external trailing-slash root", async ({
  request
}) => {
  await expectExternalRedirect(request, "/skolan", externalBase)
  await expectExternalRedirect(request, "/skolan/", externalBase)
})

test("hands the legacy lyrik path to the exact external path", async ({ request }) => {
  await expectExternalRedirect(
    request,
    "/skolan/lyrik",
    `${externalBase}lyrik`
  )
})

test("preserves nested Skolan suffixes and their percent encoding", async ({ request }) => {
  const suffix = "teman/Svensk%20lyrik/F%25C3%25B6rfattare/fr%C3%A5ga%3Fsvar%23del/"

  await expectExternalRedirect(
    request,
    `/skolan/${suffix}`,
    `${externalBase}${suffix}`
  )
})

test("preserves Skolan query strings exactly", async ({ request }) => {
  const query = "?s=Svensk%20lyrik&media=text%2Fbild"

  await expectExternalRedirect(
    request,
    `/skolan/${query}`,
    `${externalBase}${query}`
  )
})

test("hands Skolan off only for safe methods", async ({ request }) => {
  const path = "/skolan/lyrik?media=text%2Fbild&empty="
  const head = await request.fetch(path, { method: "HEAD", maxRedirects: 0 })
  expect(head.status()).toBe(302)
  expect(head.headers().location).toBe(`${externalBase}lyrik?media=text%2Fbild&empty=`)

  for (const method of ["POST", "PUT", "DELETE"] as const) {
    const response = await request.fetch(path, { method, maxRedirects: 0 })
    expect(response.status(), method).toBe(404)
    expect(response.headers().location, method).toBeUndefined()
  }
})

test("keeps absolute-looking Skolan suffixes on the fixed external origin", async ({
  request
}) => {
  await expectExternalRedirect(
    request,
    "/skolan//evil.example/path",
    `${externalBase}/evil.example/path`
  )
})

test("does not match Skolan prefix lookalikes", async ({ request }) => {
  for (const path of ["/skolans", "/skolaning"]) {
    const response = await request.get(path, { maxRedirects: 0 })

    expect(response.status()).toBe(404)
    expect(response.headers().location).toBeUndefined()
  }
})

test("rejects raw encoded Skolan handoff escapes", async ({ baseURL }) => {
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
    await expectRawNotRedirected(baseURL!, `/skolan/${suffix}`)
  }
})

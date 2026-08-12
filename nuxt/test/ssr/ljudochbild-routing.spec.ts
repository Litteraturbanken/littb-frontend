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

test("redirects both root spellings to the trailing-slash external root", async ({
  request
}) => {
  await expectExternalRedirect(request, "/ljudochbild", externalBase)
  await expectExternalRedirect(request, "/ljudochbild/", externalBase)
})

test("preserves nested path suffixes and their percent encoding", async ({ request }) => {
  const suffix = "f%C3%B6rfattare/Hjalmar%20S%C3%B6derberg/"

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

test("rejects encoded dot-segment escapes", async ({ request }) => {
  const response = await request.get("/ljudochbild/%2E%2E%2Fadmin", {
    maxRedirects: 0
  })

  expect(response.status()).toBe(404)
  expect(response.headers().location).toBeUndefined()
})

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
  const suffix = "teman/Svensk%20lyrik/"

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

test("rejects encoded Skolan dot-segment escapes", async ({ request }) => {
  const response = await request.get("/skolan/%2E%2E%2Fadmin", {
    maxRedirects: 0
  })

  expect(response.status()).toBe(404)
  expect(response.headers().location).toBeUndefined()
})

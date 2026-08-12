import { request as makeHttpRequest } from "node:http"
import { expect, test, type APIRequestContext } from "@playwright/test"

type ExternalProject = {
  slug: string
  encodedSlug: string
  lookalike: string
}

const projects: ExternalProject[] = [
  {
    slug: "översättarlexikon",
    encodedSlug: "%C3%B6vers%C3%A4ttarlexikon",
    lookalike: "översättarlexikons"
  },
  {
    slug: "bibliotekariesidor",
    encodedSlug: "%62ibliotekariesidor",
    lookalike: "bibliotekariesidornas"
  },
  {
    slug: "diktensmuseum",
    encodedSlug: "%64iktensmuseum",
    lookalike: "diktensmuseums"
  }
]

function externalBase(project: ExternalProject) {
  return encodeURI(`https://litteraturbanken.se/${project.slug}/`)
}

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

async function expectNotRedirected(request: APIRequestContext, path: string) {
  const response = await request.get(path, { maxRedirects: 0 })

  expect(response.status()).toBe(404)
  expect(response.headers().location).toBeUndefined()
}

async function expectRawNotRedirected(baseURL: string, path: string) {
  const origin = new URL(baseURL)
  const result = await new Promise<{
    status: number | undefined
    location: string | undefined
  }>((resolve, reject) => {
    const outgoing = makeHttpRequest(
      {
        hostname: origin.hostname,
        port: origin.port,
        method: "GET",
        path
      },
      response => {
        response.resume()
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            location: response.headers.location
          })
        })
      }
    )

    outgoing.on("error", reject)
    outgoing.end()
  })

  expect(result.status).toBe(404)
  expect(result.location).toBeUndefined()
}

test("does not hand off non-project object property names", async ({ request }) => {
  await expectNotRedirected(request, "/toString/nested")
})

for (const project of projects) {
  test(`hands off ${project.slug} only for safe methods`, async ({ request }) => {
    const path = `/${project.encodedSlug}/samling?view=text%2Fbild&empty=`
    const head = await request.fetch(path, { method: "HEAD", maxRedirects: 0 })
    expect(head.status()).toBe(302)
    expect(head.headers().location).toBe(
      `${externalBase(project)}samling?view=text%2Fbild&empty=`
    )

    for (const method of ["POST", "PUT", "DELETE"] as const) {
      const response = await request.fetch(path, { method, maxRedirects: 0 })
      expect(response.status(), method).toBe(404)
      expect(response.headers().location, method).toBeUndefined()
    }
  })

  test(`redirects every ${project.slug} root spelling to the external trailing-slash root`, async ({
    request
  }) => {
    const base = externalBase(project)

    await expectExternalRedirect(request, `/${project.slug}`, base)
    await expectExternalRedirect(request, `/${project.slug}/`, base)
    await expectExternalRedirect(request, `/${project.encodedSlug}`, base)
    await expectExternalRedirect(request, `/${project.encodedSlug}/`, base)
  })

  test(`preserves the raw nested ${project.slug} suffix`, async ({ request }) => {
    const suffix = "samling/F%C3%B6rfattare%20A/%E2%80%93/"

    await expectExternalRedirect(
      request,
      `/${project.encodedSlug}/${suffix}`,
      `${externalBase(project)}${suffix}`
    )
  })

  test(`preserves the exact ${project.slug} query string`, async ({ request }) => {
    const query = "?s=Hjalmar%20S%C3%B6derberg&view=text%2Fbild&empty="

    await expectExternalRedirect(
      request,
      `/${project.slug}/${query}`,
      `${externalBase(project)}${query}`
    )
  })

  test(`keeps absolute-looking ${project.slug} suffixes on the fixed origin`, async ({
    request
  }) => {
    await expectExternalRedirect(
      request,
      `/${project.slug}//evil.example/path`,
      `${externalBase(project)}/evil.example/path`
    )
  })

  test(`does not match a ${project.slug} prefix lookalike`, async ({ request }) => {
    await expectNotRedirected(request, `/${project.lookalike}/nested`)
  })

  test(`rejects malformed and unsafe ${project.slug} suffixes`, async ({ baseURL }) => {
    expect(baseURL).toBeTruthy()
    for (const suffix of [
      "%E0%A4%A",
      "./admin",
      "../admin",
      "%2E",
      "%2E%2E/admin",
      "safe%2Fadmin",
      "safe%5Cadmin"
    ]) {
      await expectRawNotRedirected(baseURL!, `/${project.encodedSlug}/${suffix}`)
    }
  })
}

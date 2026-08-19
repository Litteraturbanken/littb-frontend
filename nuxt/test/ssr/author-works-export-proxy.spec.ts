import { expect, test, type APIRequestContext } from "@playwright/test"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin
const sentinel = "author-works-generated-pdf-fixture"

async function reset(request: APIRequestContext) {
  await request.delete(`${fixture}/_export_faksimil_requests`)
}

async function requests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_export_faksimil_requests`)
  return (await response.json() as { requests: string[] }).requests
}

test.beforeEach(async ({ request }) => reset(request))

test("generated Author Works PDF proxy preserves the exact path and query", async ({
  request
}) => {
  const path = "/export/faksimil/lb238704.pdf?download=1&name=R%C3%B6da"
  const response = await request.get(path)

  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toBe("application/pdf")
  expect((await response.body()).toString()).toBe(sentinel)
  expect(await requests(request)).toEqual([path])
})

test("generated PDF proxy excludes export prefix lookalikes", async ({ request }) => {
  for (const path of [
    "/export/faksimils",
    "/export/faksimil-preview",
    "/export/faksimilx/lb238704.pdf"
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    expect(await response.text(), path).not.toContain(sentinel)
  }
  expect(await requests(request)).toEqual([])
})

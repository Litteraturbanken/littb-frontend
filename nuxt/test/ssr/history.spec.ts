import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"
import { fixtureOrigin } from "../helpers/test-origins"

const fixture = fixtureOrigin

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_resolve_requests`),
    request.delete(`${fixture}/_author_resolve_failure`),
    request.delete(`${fixture}/_author_resolve_delays`)
  ])
}

async function authorRequests(request: APIRequestContext) {
  const response = await request.get(`${fixture}/_author_resolve_requests`)
  return (await response.json()).requests
}

test.beforeEach(async ({ request }) => reset(request))

test("History renders the exact SSR shell without reading browser history", async ({
  request
}) => {
  const response = await request.get("/historik")
  expect(response.status()).toBe(200)

  const { document } = parseHTML(await response.text())
  expect(document.title).toBe("History | Litteraturbanken")
  expect(document.body.className).toBe("focus page-history ready")
  expect(document.querySelector(".site-shell")).not.toBeNull()
  expect(document.querySelector("#leftCorridor .lb-logo")).not.toBeNull()
  expect(document.querySelector("#rightCorridor")).not.toBeNull()

  const wrapper = document.querySelector("#mainview h1")?.parentElement ?? null
  expect(wrapper).not.toBeNull()
  expect(wrapper?.querySelector(":scope > h1")?.textContent).toBe("Senast lästa verk")
  expect(wrapper?.querySelector(":scope > ul")).toBeNull()
  expect(await authorRequests(request)).toEqual([])
})

import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_profile_requests`),
    request.delete(`${fixture}/_author_profile_failure`),
    request.delete(`${fixture}/_bibliography_requests`),
    request.delete(`${fixture}/_bibliography_failure`),
    request.delete(`${fixture}/_bibliography_disconnect`),
    request.delete(`${fixture}/_bibliography_delays`)
  ])
}

test.beforeEach(async ({ request }) => reset(request))

test("SSR renders the author bibliographic database from typed private requests", async ({
  request
}) => {
  const response = await request.get("/författare/StrindbergA/biblinfo")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("August Strindberg, Bibliografisk databas | Litteraturbanken")
  expect(document.body.className).toBe("focus page-authorInfo ready")
  expect(document.querySelector("h1")?.textContent).toContain("August Strindberg")
  expect(document.querySelector(".page_content h1")?.textContent?.trim())
    .toBe("Bibliografisk databas")
  expect([...document.querySelectorAll("ul.links a")].map(link => link.textContent?.trim()))
    .toEqual(["Introduktion", "Verk", "Dramawebben", "Sök i texterna"])
  expect(document.querySelector('form.search input[placeholder="Fritextsökning i hela databasen"]'))
    .not.toBeNull()
  expect([...document.querySelectorAll(".page_content input[type=checkbox]")]).toHaveLength(4)
  expect([...document.querySelectorAll(".results > div")]).toHaveLength(1)
  expect(document.querySelector(".results")?.textContent).toContain("Gösta Berlings saga")
  expect(document.querySelector(".results")?.textContent).not.toContain("En herrgårdssägen")

  expect(await (await request.get(`${fixture}/_author_profile_requests`)).json())
    .toEqual({ requests: ["/private-v2/authors/StrindbergA"] })
  expect(await (await request.get(`${fixture}/_bibliography_requests`)).json())
    .toEqual({ requests: ["/private-v2/bibliography/entries"] })
})

test("SSR preserves the author shell across missing authors and provider failures", async ({
  request
}) => {
  const missing = await request.get("/författare/Unknown/biblinfo")
  expect(missing.status()).toBe(404)
  expect(await missing.text()).toContain("författarid")

  await reset(request)
  await request.put(`${fixture}/_bibliography_failure`)
  const unavailable = await request.get("/författare/StrindbergA/biblinfo")
  expect(unavailable.status()).toBe(503)
  const { document } = parseHTML(await unavailable.text())
  expect(document.querySelector("h1")?.textContent).toContain("August Strindberg")
  expect(document.querySelector(".error")?.textContent).toContain(
    "Den bibliografiska databasen kan inte visas just nu."
  )

  await reset(request)
  await request.put(`${fixture}/_bibliography_disconnect`)
  const disconnected = await request.get("/författare/StrindbergA/biblinfo")
  expect(disconnected.status()).toBe(503)
  const disconnectedDocument = parseHTML(await disconnected.text()).document
  expect(disconnectedDocument.querySelector("h1")?.textContent).toContain("August Strindberg")
  expect(disconnectedDocument.querySelector(".error")?.textContent).toContain(
    "Den bibliografiska databasen kan inte visas just nu."
  )
})

test("SSR restores the conditional external audio author link", async ({ request }) => {
  const response = await request.get("/författare/NoIntro/biblinfo")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const audio = [...document.querySelectorAll("ul.links a")].find(
    link => link.textContent?.trim() === "Ljud"
  )

  expect(audio?.getAttribute("href")).toBe(
    "https://litteraturbanken.se/ljudochbild/författare/nointro"
  )
  expect(audio?.getAttribute("target")).toBe("_blank")
})

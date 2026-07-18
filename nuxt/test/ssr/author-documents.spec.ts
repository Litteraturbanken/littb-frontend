import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = "http://127.0.0.1:4100"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_document_requests`),
    request.delete(`${fixture}/_author_document_failure`),
    request.delete(`${fixture}/_author_document_delay`)
  ])
}

async function requests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_author_document_requests`)).json()).requests
}

async function setFailure(request: APIRequestContext, failure: string) {
  const response = await request.put(`${fixture}/_author_document_failure`, {
    data: { failure }
  })
  expect(response.status()).toBe(200)
}

test.beforeEach(async ({ request }) => reset(request))

for (const documentCase of [
  {
    route: "/författare/S%C3%B6derbergH/presentation",
    title: "Hjalmar Söderberg, Presentation | Litteraturbanken",
    description: "Hjalmar Söderberg, Presentation",
    heading: "Hjalmar Söderberg (1869-1941)",
    links: ["Introduktion", "Verk", "Ljud", "Sök i texterna"],
    body: "Hjalmar Söderberg, född 1869",
    author: "S%C3%B6derbergH",
    source: "/red/forfattare/SoderbergH/presentation/index.html"
  },
  {
    route: "/författare/Lagerl%C3%B6fS/bibliografi",
    title: "Selma Lagerlöf, Bibliografi | Litteraturbanken",
    description: "Selma Lagerlöf, Bibliografi",
    heading: "Selma Lagerlöf (1858-1940)",
    links: ["Introduktion", "Verk", "Ljud", "Dramawebben", "Sök i texterna"],
    body: "Selma Lagerlöf. Bibliografi",
    author: "Lagerl%C3%B6fS",
    source: "/red/forfattare/LagerlofS/bibliografi/index.html"
  }
] as const) {
  test(`SSR renders the exact ${documentCase.description} shell and managed body`, async ({
    request
  }) => {
    const response = await request.get(documentCase.route)
    expect(response.status()).toBe(200)
    const html = await response.text()
    const { document } = parseHTML(html)

    expect(document.title).toBe(documentCase.title)
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
      .toBe(documentCase.description)
    expect(document.documentElement.getAttribute("style")).toMatch(/forf2_bkg(?:\.[A-Za-z0-9_-]+)?\.jpg/u)
    expect(document.body.getAttribute("class")).toBe("focus page-authorInfo ready")
    expect(document.querySelector("h1")?.textContent?.replace(/\s+/gu, " ").trim())
      .toBe(documentCase.heading)
    expect([...document.querySelectorAll("ul.links a")].map(link => link.textContent?.trim()))
      .toEqual(documentCase.links)
    expect(document.querySelectorAll("ul.links li.active")).toHaveLength(0)
    expect(document.querySelector(".page_content > .content.unbox")?.textContent)
      .toContain(documentCase.body)
    expect(document.querySelector(".page_content script, .page_content style, .page_content form"))
      .toBeNull()
    const audio = [...document.querySelectorAll("ul.links a")]
      .find(link => link.textContent?.trim() === "Ljud")
    expect(audio?.getAttribute("target")).toBe("_blank")
    expect(audio?.getAttribute("rel")).toBe("noopener noreferrer")
    expect(await requests(request)).toEqual([
      {
        kind: "descriptor",
        path: `/private-v2/authors/${documentCase.author}/documents/${documentCase.route.split("/").at(-1)}`
      },
      { kind: "content", path: documentCase.source }
    ])
  })
}

test("SSR preserves normalized Reader and bibliography PDF link behavior", async ({ request }) => {
  const presentation = parseHTML(await (await request.get(
    "/författare/S%C3%B6derbergH/presentation"
  )).text()).document
  const reader = presentation.querySelector(
    'a[href="/forfattare/SoderbergH/titlar/Forvillelser/sida/3/etext"]'
  )
  expect(reader?.textContent).toContain("Förvillelser")

  await reset(request)
  const bibliography = parseHTML(await (await request.get(
    "/författare/Lagerl%C3%B6fS/bibliografi"
  )).text()).document
  const pdf = bibliography.querySelector('a[href$="LagerlofS_bibliografi.pdf"]')
  expect(pdf?.getAttribute("href")).toBe(
    "/red/forfattare/LagerlofS/bibliografi/LagerlofS_bibliografi.pdf"
  )
  expect(pdf?.getAttribute("target")).toBe("_blank")
  expect(pdf?.getAttribute("rel")).toBe("noopener noreferrer")
})

test("SSR renders the sparse document with only the permanent Verk navigation", async ({ request }) => {
  const response = await request.get("/författare/SparseDocument/presentation")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect([...document.querySelectorAll("ul.links a")].map(link => link.textContent?.trim()))
    .toEqual(["Verk"])
  expect(document.querySelector(".page_content")?.textContent)
    .toContain("Ett litet giltigt författardokument")
})

for (const [failure, status, message] of [
  [
    "descriptor-404",
    404,
    "Ett fel har inträffat: författarid SöderbergH kan inte hittas. Kontrollera adressen."
  ],
  [
    "content-404",
    404,
    "Ett fel har inträffat: dokumentet kan inte hittas. Kontrollera adressen."
  ],
  [
    "content-503",
    502,
    "Ett fel har inträffat. Författardokumentet kan inte visas just nu."
  ]
] as const) {
  test(`SSR maps ${failure} to the exact local ${status} page`, async ({ request }) => {
    await setFailure(request, failure)
    const response = await request.get("/författare/S%C3%B6derbergH/presentation")
    expect(response.status()).toBe(status)
    const { document } = parseHTML(await response.text())
    expect(document.querySelector(".error")?.textContent?.replace(/\s+/gu, " ").trim())
      .toBe(message)
    expect(document.body.textContent).not.toMatch(/private-v2|red\/forfattare|content unavailable/iu)
  })
}

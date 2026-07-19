import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = "http://127.0.0.1:4100"

const requestLedgers = [
  "/_requests",
  "/_author_document_requests",
  "/_author_profile_requests",
  "/_author_works_requests",
  "/_home_requests",
  "/_library_query_requests",
  "/_presentation_requests",
  "/_text_search/requests"
] as const

async function resetRequestLedgers(request: APIRequestContext) {
  await Promise.all(requestLedgers.map(path => request.delete(`${fixture}${path}`)))
}

async function expectNoDataRequests(request: APIRequestContext) {
  for (const path of requestLedgers) {
    const payload = await (await request.get(`${fixture}${path}`)).json()
    const values = path === "/_text_search/requests"
      ? [...payload.results, ...payload.count, ...payload.options]
      : payload.requests
    expect(values, path).toEqual([])
  }
}

function expectStartShell(html: string) {
  const { document } = parseHTML(html)

  expect(document.title).toBe("Litteraturbanken")
  expect(document.body.className).toBe("focus page-dramaweb ready")
  expect(document.querySelector("#mainview > .cover")).not.toBeNull()
  expect(document.querySelector("#mainview > .cover.show")).toBeNull()

  const wrapper = document.querySelector("#mainview > .startpage")
  expect(wrapper).not.toBeNull()
  expect(wrapper?.classList.contains("subpage")).toBe(false)
  expect(wrapper?.querySelector(".logo h1 a")?.getAttribute("href")).toBe("/dramawebben")
  const logo = wrapper?.querySelector(".logo h1 img")
  expect(logo?.getAttribute("src")).toMatch(/dramawebben_vit(?:\.[A-Za-z0-9_-]+)?\.svg/u)
  expect(logo?.getAttribute("alt")).toBe("Dramawebben")
  expect(wrapper?.querySelector(".logo h2")?.textContent?.replace(/\s+/gu, " ").trim())
    .toBe("Fri svensk dramatik hos Litteraturbanken")

  const links = [...(wrapper?.querySelectorAll("ul.links a") ?? [])].map(link => ({
    href: link.getAttribute("href"),
    label: link.textContent?.replace(/\s+/gu, " ").trim()
  }))
  expect(links).toEqual([
    { href: "/dramawebben/pjäser", label: "Pjäser" },
    { href: "/dramawebben/kringtexter", label: "Mer läsning" },
    {
      href: "/sok?avancerad&keywords=keyword:Dramawebben",
      label: "Sök i pjäserna"
    },
    { href: "/dramawebben/om", label: "Om dramawebben" },
    { href: "/", label: "Till Litteraturbanken" }
  ])
  expect(wrapper?.querySelectorAll("ul.links li.active")).toHaveLength(0)

  const content = wrapper?.querySelector(".page_content")
  expect(content).not.toBeNull()
  expect(content?.children).toHaveLength(0)
  expect(content?.textContent?.trim()).toBe("")
}

test.beforeEach(async ({ request }) => resetRequestLedgers(request))

test("SSR renders the exact data-free Dramawebben start shell", async ({ request }) => {
  const response = await request.get("/dramawebben")

  expect(response.status()).toBe(200)
  expectStartShell(await response.text())
  await expectNoDataRequests(request)
})

test("a root query leaves the empty shell and request ownership unchanged", async ({
  request
}) => {
  const response = await request.get(
    "/dramawebben?fran=test&repeat=one&repeat=two&unknown=%2F"
  )

  expect(response.status()).toBe(200)
  expectStartShell(await response.text())
  await expectNoDataRequests(request)
})

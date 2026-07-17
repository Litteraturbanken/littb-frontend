import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = "http://127.0.0.1:4100"
const relevancePath = "/legacy-api/relevance/etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`)
  ])
}

async function requests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_relevance_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

test.beforeEach(async ({ request }) => reset(request))

test("SSR renders the populated default Library relevance slice from the private base", async ({
  request
}) => {
  const response = await request.get("/bibliotek?filter=R%C3%B6da%20rummet&sort=relevans")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("Biblioteket – Titlar och författare | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("Blädda bland Litteraturbankens författare och titlar.")
  expect(document.body.className).toBe("focus page-library ready")
  expect(document.documentElement.getAttribute("style"))
    .toContain("/red/bilder/bakgrundsbilder/biblioteket_bakgrund.jpg")
  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Botanisera i biblioteket")
  expect(document.querySelector<HTMLInputElement>('[data-library-filter]')?.value)
    .toBe("Röda rummet")
  expect([...document.querySelectorAll("[data-library-tab]")].map(node => node.textContent?.trim()))
    .toEqual(["Alla träffar", "Nytt", "Författare", "Verk", "Dikt, novell, etc.", "Epub", "PDF"])
  expect([...document.querySelectorAll("[data-library-result]")]).toHaveLength(1)
  expect(document.querySelector('[data-library-result] a[href*="RodaRummet"]')?.textContent?.trim())
    .toBe("Röda rummet")

  const ledger = await requests(request)
  expect(ledger).toHaveLength(1)
  expect(ledger[0]?.path).toBe(relevancePath)
  expect(ledger[0]?.query).toEqual({
    exclude: "text,parts,sourcedesc,pages,errata,intro,workintro,content,article.ArticleText,works,intro_text,bibliography_types,wikidata.wikipedia_text,content_vector",
    q: "(Röda rummet)",
    from: "0",
    to: "100",
    show_all: "false",
    sort_field: "_score|desc",
    vectorize: "true",
    sid: "true"
  })
})

test("SSR preserves the legacy empty and failed result messages", async ({ request }) => {
  const empty = parseHTML(await (await request.get("/bibliotek?filter=inga")).text()).document
  expect(empty.querySelector("[data-library-empty]")?.textContent?.trim()).toBe("Inga träffar.")
  expect(empty.querySelectorAll("[data-library-result]")).toHaveLength(0)

  await request.put(`${fixture}/_library_relevance_failure`)
  const failed = parseHTML(await (await request.get("/bibliotek?filter=failed")).text()).document
  expect(failed.querySelector("[data-library-error]")?.textContent?.trim()).toBe("Ett fel uppstod.")
  expect(failed.querySelectorAll("[data-library-result]")).toHaveLength(0)
})

for (const filter of ["null-suggest", "missing-suggest"]) {
  test(`SSR renders Library results when suggest is ${filter.split("-")[0]}`, async ({ request }) => {
    const response = await request.get(`/bibliotek?filter=${filter}`)
    expect(response.status()).toBe(200)
    const { document } = parseHTML(await response.text())

    expect(document.querySelectorAll("[data-library-result]")).toHaveLength(3)
    expect(document.querySelector("[data-library-error]")).toBeNull()
  })
}

test("SSR rejects a present non-array suggest value", async ({ request }) => {
  const response = await request.get("/bibliotek?filter=malformed-suggest")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector("[data-library-error]")?.textContent?.trim())
    .toBe("Ett fel uppstod.")
  expect(document.querySelectorAll("[data-library-result]")).toHaveLength(0)
})

test("SSR renders every safe mixed family and rejects malformed rows and destinations", async ({
  request
}) => {
  const response = await request.get("/bibliotek?filter=blandat&sort=titlar")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const rows = [...document.querySelectorAll("[data-library-result]")]
  const destinations = rows.map(row => row.querySelector("a")?.getAttribute("href"))

  expect(rows).toHaveLength(10)
  expect(destinations).toEqual([
    "/författare/StrindbergA/titlar/RodaRummet/sida/1/etext",
    "/författare/LagerlofS/titlar/GostaBerlingsSaga/sida/3/faksimil",
    "/txt/lb-pdf/lb-pdf.pdf",
    "/författare/NovellA/titlar/Novellsamling/sida/7/etext",
    "/författare/DiktA/titlar/Diktsamling/sida/9/faksimil",
    "/författare/StrindbergA/",
    "/presentationer/forfattare/StrindbergA.html",
    "https://litteraturbanken.se/översättarlexikon/artiklar/Ada_Nilsson",
    "https://litteraturbanken.se/litteraturkartan/?id=G%C3%B6teborg&article=artikel%2F1",
    "https://litteraturbanken.se/skolan/litteratur/"
  ])
  expect(document.querySelectorAll('a[href^="javascript:"], a[href^="data:"], a[href^="//"]'))
    .toHaveLength(0)
  expect(document.querySelector("[data-library-author-name] .surname")?.textContent)
    .toBe("Strindberg")
  expect(document.querySelector("[data-library-author-mobile-years]")?.textContent?.trim())
    .toBe("(1849–1912)")
  expect(document.querySelector("[data-library-filter-icon] path")?.getAttribute("d"))
    .toBe("M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25")
  expect(document.querySelector<HTMLButtonElement>("[data-library-advanced]")?.disabled)
    .toBe(true)
  expect([...document.querySelectorAll<HTMLButtonElement>("[data-library-tab][data-deferred]")]
    .every(button => button.disabled)).toBe(true)
  expect([...document.querySelectorAll<HTMLButtonElement>("[data-library-tab][data-deferred]")])
    .toHaveLength(6)

  const ledger = await requests(request)
  expect(ledger).toHaveLength(1)
  expect(ledger[0]?.query.sort_field).toBe("sortkey|asc")
})

for (const [sort, expression] of [
  ["relevans", "_score|desc"],
  ["forfattare", "main_author.name_for_index|asc,sortkey|asc"],
  ["titlar", "sortkey|asc"],
  ["kronologi", "sort_date_imprint.date|desc"]
 ] as const) {
  test(`SSR sends the exact ${sort} sort expression`, async ({ request }) => {
    const response = await request.get(`/bibliotek?filter=inga&sort=${sort}`)
    expect(response.status()).toBe(200)
    const ledger = await requests(request)
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.query).toEqual({
      exclude: "text,parts,sourcedesc,pages,errata,intro,workintro,content,article.ArticleText,works,intro_text,bibliography_types,wikidata.wikipedia_text,content_vector",
      show_all: "false",
      sort_field: expression,
      from: "0",
      to: "100",
      vectorize: "true",
      sid: "true",
      q: "(inga)"
    })
  })
}

test("SSR treats malformed top-level Library payloads as a generic failure", async ({ request }) => {
  const response = await request.get("/bibliotek?filter=malformed-top")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("[data-library-error]")?.textContent?.trim())
    .toBe("Ett fel uppstod.")
  expect(document.querySelectorAll("[data-library-result]")).toHaveLength(0)
})

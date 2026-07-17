import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = "http://127.0.0.1:4100"
const relevancePath = "/legacy-api/relevance/etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"
const epubPath = "/legacy-api/query_string/etext,faksimil,pdf"
const epubExclude = "text,parts,sourcedesc,pages,errata"
const epubInclude = "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword"
const epubQueryPrefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`),
    request.delete(`${fixture}/_library_query_requests`),
    request.delete(`${fixture}/_library_query_failure`),
    request.delete(`${fixture}/_library_query_delays`)
  ])
}

async function requests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_relevance_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

async function epubRequests(request: APIRequestContext) {
  return (await (await request.get(`${fixture}/_library_query_requests`)).json()).requests as
    Array<{ path: string, query: Record<string, string> }>
}

function epubRows(document: Document) {
  return [...document.querySelectorAll("[data-library-epub-row]")].map(row => ({
    title: row.querySelector("[data-library-epub-title]")?.textContent?.trim(),
    titleHref: row.querySelector("[data-library-epub-title]")?.getAttribute("href"),
    year: row.querySelector("[data-library-epub-year]")?.textContent?.trim(),
    author: row.querySelector("[data-library-epub-author]")?.textContent?.trim(),
    authorHref: row.querySelector("[data-library-epub-author]")?.getAttribute("href"),
    downloadHref: row.querySelector("[data-library-epub-download]")?.getAttribute("href")
  }))
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
    .toHaveLength(5)
  expect(document.querySelector('[data-library-tab="epub"]')?.tagName).toBe("A")
  expect(document.querySelector('[data-library-tab="epub"]')?.getAttribute("href"))
    .toBe("/bibliotek?visa=epub&filter=blandat&sort=popularitet")

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

test("SSR renders Library EPUB mode with its Library shell and exact private request", async ({
  request
}) => {
  const library = parseHTML(await (await request.get(
    "/bibliotek?visa=epub&sort=popularitet&filter=Selma"
  )).text()).document

  expect(library.title).toBe("Biblioteket – Titlar och författare | Litteraturbanken")
  expect(library.body.className).toBe("focus page-library ready")
  expect(library.documentElement.getAttribute("style")).toContain("biblioteket_bakgrund.jpg")
  expect(library.querySelector("h1")?.textContent?.trim()).toBe("Botanisera i biblioteket")
  expect(library.querySelector('[data-library-tab="epub"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect([...library.querySelectorAll("[data-library-tab]")].map(node => node.textContent?.trim()))
    .toEqual([
      "Alla träffar", "Nytt", "Författare: 0", "Verk", "Dikt, novell, etc.", "Epub: 1", "PDF"
    ])
  expect(epubRows(library)).toEqual([{
    title: "Gösta Berlings saga",
    titleHref: "/författare/LagerlofS/titlar/GostaBerlingsSaga/etext?om-boken",
    year: "1891",
    author: "Lagerlöf",
    authorHref: "/författare/LagerlofS",
    downloadHref: "/txt/epub/LagerlofS_GostaBerlingsSaga.epub"
  }])

  expect(await epubRequests(request)).toEqual([{
    path: epubPath,
    query: {
      exclude: epubExclude,
      include: epubInclude,
      partial_string: "true",
      q: `${epubQueryPrefix} (has_epub:true AND (Selma))`,
      sort_field: "popularity|desc",
      from: "0",
      to: "100",
      suggest: "true"
    }
  }])
  expect(await requests(request)).toEqual([])
})

test("SSR aliases bare and canonical EPUB routes to one row model with the standalone shell", async ({
  request
}) => {
  const libraryResponse = await request.get("/bibliotek?visa=epub&sort=popularitet")
  const bareResponse = await request.get("/epub")
  const canonicalResponse = await request.get("/epub?visa=epub&sort=popularitet")
  expect(libraryResponse.status()).toBe(200)
  expect(bareResponse.status()).toBe(200)
  expect(canonicalResponse.status()).toBe(200)
  const library = parseHTML(await libraryResponse.text()).document
  const bare = parseHTML(await bareResponse.text()).document
  const canonical = parseHTML(await canonicalResponse.text()).document

  for (const standalone of [bare, canonical]) {
    expect(standalone.title).toBe("E-böcker för nedladdning | Litteraturbanken")
    expect(standalone.body.className).toBe("focus page-epub ready")
    expect(standalone.documentElement.getAttribute("style")).toContain("background-image:none")
    expect(standalone.querySelector("h1")?.textContent?.trim()).toBe("Hämta e-böcker")
    expect([...standalone.querySelectorAll("[data-library-tab]")]
      .map(node => node.textContent?.trim())).toEqual(["Epub: 201", "PDF"])
    expect(standalone.querySelector('[data-library-tab="epub"]')?.getAttribute("aria-current"))
      .toBe("page")
  }
  expect(epubRows(library)).toEqual(epubRows(bare))
  expect([...library.querySelectorAll("[data-library-tab]")]
    .map(node => node.textContent?.trim()))
    .toEqual([
      "Alla träffar", "Nytt", "Författare: 0", "Verk", "Dikt, novell, etc.", "Epub: 201", "PDF"
    ])
  expect(epubRows(bare)).toEqual(epubRows(canonical))
  expect(epubRows(bare)).toHaveLength(3)

  const firstRow = bare.querySelector("[data-library-epub-row]")
  const titleHref = firstRow?.querySelector("[data-library-epub-title]")?.getAttribute("href")
  const authorHref = firstRow?.querySelector("[data-library-epub-author]")?.getAttribute("href")
  const download = firstRow?.querySelector("[data-library-epub-download]")
  expect(titleHref).toBe("/författare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken")
  expect(authorHref).toBe("/författare/S%C3%B6derbergH")
  expect(download?.getAttribute("href"))
    .toBe("/txt/epub/S%C3%B6derbergH_DoktorGlas.epub")
  expect(download?.getAttribute("download")).not.toBeNull()
  expect(download?.getAttribute("target")).toBe("_self")
  expect(bare.querySelector('[data-library-epub-row]:nth-child(2) .author')
    ?.textContent?.trim()).toBe("Geijer (red.)")
  expect(bare.querySelector('[data-library-epub-row]:nth-child(3) .author')
    ?.textContent?.trim()).toBe("Bauer (ill.)")
})

for (const [sort, expression] of [
  ["forfattare", "main_author.name_for_index|asc,sortkey|asc"],
  ["titlar", "sortkey|asc"],
  ["popularitet", "popularity|desc"],
  ["kronologi", "sort_date_imprint.date|desc"]
] as const) {
  test(`SSR sends the exact EPUB ${sort} sort expression`, async ({ request }) => {
    const response = await request.get(`/bibliotek?visa=epub&sort=${sort}`)
    expect(response.status()).toBe(200)
    const ledger = await epubRequests(request)
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.path).toBe(epubPath)
    expect(ledger[0]?.query.sort_field).toBe(expression)
    expect(ledger[0]?.query.q).toBe(`${epubQueryPrefix} (has_epub:true)`)
    expect(await requests(request)).toEqual([])
  })
}

test("SSR selects EPUB page two and renders semantic query pagination", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?keep=ja&visa=epub&filter=&sort=popularitet&sida=2"
  )).text()).document

  expect(epubRows(document).map(row => row.title)).toEqual(["Gösta Berlings saga"])
  expect(document.querySelector('[data-library-page="2"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector('[data-library-page="1"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=ja&visa=epub&sort=popularitet&sida=1")
  expect(document.querySelector("[data-library-pagination-previous]")?.getAttribute("href"))
    .toBe("/bibliotek?keep=ja&visa=epub&sort=popularitet&sida=1")
  expect(document.querySelector("[data-library-pagination-next]")?.getAttribute("href"))
    .toBe("/bibliotek?keep=ja&visa=epub&sort=popularitet&sida=3")

  expect((await epubRequests(request))[0]?.query).toMatchObject({ from: "100", to: "200" })
})

test("SSR disables EPUB pagination at the final boundary", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=epub&sort=popularitet&sida=3"
  )).text()).document

  expect(document.querySelector('[data-library-page="3"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector("[data-library-pagination-next]")?.getAttribute("aria-disabled"))
    .toBe("true")
  expect((await epubRequests(request))[0]?.query).toMatchObject({ from: "200", to: "300" })
})

test("SSR preserves bare and repeated unrelated query keys in EPUB pagination hrefs", async ({
  request
}) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?keep&keep=ja&visa=epub&sort=popularitet&sida=2"
  )).text()).document

  expect(document.querySelector('[data-library-page="1"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=epub&sort=popularitet&sida=1")
})

for (const invalid of ["saknas", "0", "-2", "1.5"]) {
  test(`SSR normalizes invalid EPUB page ${invalid} to one and preserves unrelated keys`, async ({
    request
  }) => {
    const document = parseHTML(await (await request.get(
      `/bibliotek?visa=epub&sort=popularitet&sida=${invalid}&keep=ja`
    )).text()).document

    expect(document.querySelector('[data-library-page="1"]')?.getAttribute("aria-current"))
      .toBe("page")
    expect(document.querySelector("[data-library-pagination-previous]")
      ?.getAttribute("aria-disabled")).toBe("true")
    expect(document.querySelector('[data-library-page="2"]')?.getAttribute("href"))
      .toBe("/bibliotek?keep=ja&visa=epub&sort=popularitet&sida=2")
    expect((await epubRequests(request))[0]?.query).toMatchObject({ from: "0", to: "100" })
  })
}

for (const filter of ["missing-suggest", "null-suggest"]) {
  test(`SSR accepts EPUB responses with ${filter}`, async ({ request }) => {
    const document = parseHTML(await (await request.get(
      `/bibliotek?visa=epub&filter=${filter}`
    )).text()).document
    expect(document.querySelectorAll("[data-library-epub-row]")).toHaveLength(3)
    expect(document.querySelector("[data-library-error]")).toBeNull()
  })
}

test("SSR distinguishes valid empty EPUB responses from malformed envelopes", async ({ request }) => {
  const empty = parseHTML(await (await request.get(
    "/bibliotek?visa=epub&filter=inga"
  )).text()).document
  expect(empty.querySelector("[data-library-empty]")?.textContent?.trim()).toBe("Inga träffar.")
  expect(empty.querySelectorAll("[data-library-epub-row]")).toHaveLength(0)

  const malformed = parseHTML(await (await request.get(
    "/bibliotek?visa=epub&filter=malformed-top"
  )).text()).document
  expect(malformed.querySelector("[data-library-error]")?.textContent?.trim())
    .toBe("Ett fel uppstod.")
  expect(malformed.querySelectorAll("[data-library-epub-row]")).toHaveLength(0)
})

test("SSR omits malformed EPUB rows and unsafe synthesized path identifiers", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=epub&filter=malformed-row"
  )).text()).document

  expect(epubRows(document)).toHaveLength(1)
  expect(document.querySelector('[href*="UnsafeWork"], [href*="unsafe"]')).toBeNull()
})

test("SSR omits numeric and unencodable EPUB identifiers without rejecting the envelope", async ({
  request
}) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=epub&filter=strict-row"
  )).text()).document

  expect(epubRows(document).map(row => row.title)).toEqual(["Doktor Glas"])
  expect(document.querySelector("[data-library-error]")).toBeNull()
  expect(document.querySelector('[href*="NumericIdentifier"], [href*="UnencodableIdentifier"]'))
    .toBeNull()
})

test("SSR renders a generic EPUB error when the private transport fails", async ({ request }) => {
  await request.put(`${fixture}/_library_query_failure`)
  const document = parseHTML(await (await request.get("/epub")).text()).document
  expect(document.querySelector("[data-library-error]")?.textContent?.trim())
    .toBe("Ett fel uppstod.")
  expect(document.querySelectorAll("[data-library-epub-row]")).toHaveLength(0)
})

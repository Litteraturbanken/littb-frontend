import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

import {
  duplicatePdfExportRepresentation,
  exportedEtextPdfRepresentation,
  exportedFaksimilPdfRepresentation,
  groupedDirectPdfRepresentation,
  groupedPdfExportRepresentation,
  indexedPdfRepresentation,
  libraryPdfPageOneResponse,
  libraryPdfTupleCollisionResponse,
  pageTwoPdfRepresentation
} from "../fixtures/library-pdf-data.mjs"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const relevancePath = "/legacy-api/relevance/etext,faksimil,pdf,etext-part,faksimil-part,author,presentations,sol,litteraturkartan,wordpress"
const epubPath = "/legacy-api/query_string/etext,faksimil,pdf"
const epubExclude = "text,parts,sourcedesc,pages,errata"
const epubInclude = "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain,main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type,work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword"
const pdfInclude = `${epubInclude},license,authors.authorid,authors.surname`
const epubQueryPrefix = "@type=cross_fields @default_operator=AND @fields=autocomplete.scandinavian"
const pdfPredicate = "((export>type:pdf AND license:pd) OR mediatype:pdf)"

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_library_relevance_requests`),
    request.delete(`${fixture}/_library_relevance_failure`),
    request.delete(`${fixture}/_library_relevance_delays`),
    request.delete(`${fixture}/_library_query_requests`),
    request.delete(`${fixture}/_library_query_failure`),
    request.delete(`${fixture}/_library_query_delays`),
    request.delete(`${fixture}/_library_imprint_range`),
    request.delete(`${fixture}/_library_imprint_failure`),
    request.delete(`${fixture}/_library_imprint_requests`),
    request.delete(`${fixture}/_library_metadata_variant`)
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

function pdfRows(document: Document) {
  return [...document.querySelectorAll("[data-library-pdf-row]")].map(row => ({
    title: row.querySelector("[data-library-pdf-title]")?.textContent?.trim(),
    titleHref: row.querySelector("[data-library-pdf-title]")?.getAttribute("href"),
    year: row.querySelector("[data-library-pdf-year]")?.textContent?.trim(),
    author: row.querySelector("[data-library-pdf-author]")?.textContent?.trim(),
    authorHref: row.querySelector("[data-library-pdf-author]")?.getAttribute("href"),
    downloadHref: row.querySelector("[data-library-pdf-download]")?.getAttribute("href"),
    download: row.querySelector("[data-library-pdf-download]")?.getAttribute("download"),
    target: row.querySelector("[data-library-pdf-download]")?.getAttribute("target")
  }))
}

function selectedChipTitles(document: Document, selector: string) {
  return [...document.querySelectorAll(`${selector} .select2-selection__choice`)]
    .map(chip => chip.getAttribute("title"))
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

test("SSR keeps full relevance titles and contribution labels separate from their links", async ({
  request
}) => {
  const response = await request.get("/bibliotek?filter=titelmetadata")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const rows = [...document.querySelectorAll("[data-library-result]")]
  const longTitle = rows[0]?.querySelector<HTMLElement>("[data-library-result-title]")

  expect(longTitle?.textContent?.trim()).toBe(
    "En avsiktligt mycket lång korttitel som måste förkortas visuellt utan att flytta årtal eller författare i resultatraden"
  )
  expect(longTitle?.getAttribute("title")).toBe(
    "Den fullständiga titeln som ska visas som verktygstips när den korta titeln kapas"
  )
  expect(rows[1]?.querySelector("[data-library-result-title]")?.getAttribute("title")).toBeNull()
  expect(rows[1]?.querySelector("[data-library-author-contribution]")?.textContent?.trim())
    .toBe("(red.)")
  expect(rows[2]?.querySelector("[data-library-author-contribution]")?.textContent?.trim())
    .toBe("(ill.)")
  expect(rows[3]?.querySelector("[data-library-author-contribution]")).toBeNull()
  expect(rows[1]?.querySelector("[data-library-author-contribution]")?.closest("a")).toBeNull()
  expect(rows[1]?.querySelector("[data-library-result-title]")?.className)
    .toContain("text-ellipsis")
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
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/sida/1/etext",
    "/f%C3%B6rfattare/LagerlofS/titlar/GostaBerlingsSaga/sida/3/faksimil",
    "/txt/lb-pdf/lb-pdf.pdf",
    "/f%C3%B6rfattare/NovellA/titlar/Novellsamling/sida/7/etext",
    "/f%C3%B6rfattare/DiktA/titlar/Diktsamling/sida/9/faksimil",
    "/f%C3%B6rfattare/StrindbergA/",
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
    .toBe(false)
  expect(document.querySelector('[data-library-tab="latest"]')?.getAttribute("href"))
    .toBe("/bibliotek?visa=latest&filter=blandat&sort=nytillkommet")
  expect(document.querySelector('[data-library-tab="latest"]')?.hasAttribute("data-deferred"))
    .toBe(false)
  expect(document.querySelectorAll("[data-library-tab][data-deferred]")).toHaveLength(0)
  expect([...document.querySelectorAll('[data-library-tab="authors"], [data-library-tab="works"], [data-library-tab="parts"]')]
    .every(tab => tab.tagName === "A")).toBe(true)
  expect(document.querySelector('[data-library-tab="epub"]')?.tagName).toBe("A")
  expect(document.querySelector('[data-library-tab="epub"]')?.getAttribute("href"))
    .toBe("/bibliotek?visa=epub&filter=blandat&sort=popularitet")

  const ledger = await requests(request)
  expect(ledger).toHaveLength(1)
  expect(ledger[0]?.query.sort_field).toBe("sortkey|asc")
})

test("SSR restores validated advanced Library controls and sends the exact legacy predicate", async ({
  request
}) => {
  const response = await request.get(
    "/bibliotek?keep=ja&avancerat=1&k%C3%B6n=female" +
    "&mediatypes=mediatype%3Aetext%2Chas_epub%3Atrue" +
    "&languages=language%3Aswe%2Cproofread%3Afalse&intervall=1900%2C1910"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector("[data-library-advanced]")?.getAttribute("aria-expanded"))
    .toBe("true")
  expect(document.querySelector("[data-library-advanced-panel]")).not.toBeNull()
  const mediaControl = document.querySelector('[data-library-media] [role="combobox"]')
  const languageControl = document.querySelector('[data-library-languages] [role="combobox"]')
  expect(mediaControl?.getAttribute("aria-label"))
    .toBe("Utgivningsformat")
  expect(mediaControl?.getAttribute("tabindex")).toBe("0")
  expect(languageControl?.getAttribute("aria-label"))
    .toBe("Språk …")
  expect(languageControl?.getAttribute("tabindex")).toBe("0")
  expect(document.querySelector<HTMLOptionElement>("[data-library-gender] option[selected]")?.value)
    .toBe("female")
  expect(selectedChipTitles(document, "[data-library-media]")).toEqual(["Etext", "Epub"])
  expect(selectedChipTitles(document, "[data-library-languages]")).toEqual([
    "Svenska", "Ej korrekturläst"
  ])
  expect([...document.querySelectorAll<HTMLInputElement>(
    "[data-library-chronology-range] input[type=range]"
  )].map(input => input.value)).toEqual(["1900", "1910"])

  const ledger = await requests(request)
  expect(ledger).toHaveLength(1)
  expect(ledger[0]?.query.q).toBe(
    "(gender:female OR authors>(gender:female)) AND " +
    "(sort_date_imprint.date:[1900 TO 1910] OR birth.date:[1900 TO 1910] OR death.date:[1900 TO 1910]) AND " +
    "(language:swe OR proofread:false) AND (mediatype:etext OR has_epub:true)"
  )
})

test("SSR composes ordinary Library collections with OR and narrowing collections with AND", async ({
  request
}) => {
  const response = await request.get(
    "/bibliotek?avancerat=1" +
    "&keywords=texttype%3Aroman%2Cprovenance.library%3ASA" +
    "&keywords_aux=keyword%3AHumor%2Ctexttype%3Abrev%3Bbrevsamling" +
    "&about_authors=Lagerl%C3%B6fS"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(selectedChipTitles(document, "[data-library-keywords]")).toEqual([
    "Romaner", "Svenska Akademien"
  ])
  expect(selectedChipTitles(document, "[data-library-narrowing]")).toEqual([
    "Humoristiska verk", "Brev"
  ])
  expect(selectedChipTitles(document, "[data-library-about-authors]")).toEqual([
    "Selma Lagerlöf"
  ])

  expect((await requests(request))[0]?.query.q).toBe(
    "(keyword:(Humor) AND texttype:(brev OR brevsamling)) AND " +
    "(authorkeyword>(authorid:LagerlöfS)) AND " +
    "(texttype:roman OR provenance.library:SA)"
  )
})

test("SSR fails closed for unsupported Library facet bytes", async ({ request }) => {
  const response = await request.get(
    "/bibliotek?avancerat=1" +
    "&keywords=keyword%3AHumor%2CRAW%3A*" +
    "&keywords_aux=keyword%3AHumor%2CNOT%20keyword%3A1800" +
    "&about_authors=..%2Funsafe"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(selectedChipTitles(document, "[data-library-keywords]")).toEqual([])
  expect(selectedChipTitles(document, "[data-library-narrowing]")).toEqual([])
  expect(selectedChipTitles(document, "[data-library-about-authors]")).toEqual([])
  expect((await requests(request))[0]?.query.q).toBeUndefined()
})

test("SSR discards duplicate about-author records and keyword IDs", async ({ request }) => {
  for (const variant of ["duplicate-authors", "duplicate-keywords"] as const) {
    await request.put(`${fixture}/_library_metadata_variant`, { data: { variant } })
    await request.delete(`${fixture}/_library_relevance_requests`)

    const response = await request.get(
      "/bibliotek?avancerat=1&about_authors=Lagerl%C3%B6fS"
    )
    expect(response.status()).toBe(200)
    const { document } = parseHTML(await response.text())
    expect(selectedChipTitles(document, "[data-library-about-authors]")).toEqual([])
    expect((await requests(request))[0]?.query.q).toBeUndefined()
  }
})

test("SSR emits Nuxt-client-compatible encoded author and Reader prefixes", async ({ request }) => {
  const response = await request.get("/bibliotek?filter=blandat")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const internal = [...document.querySelectorAll<HTMLAnchorElement>("[data-library-result] a")]
    .map(link => link.getAttribute("href"))
    .filter(href => href?.startsWith("/författare/") || href?.startsWith("/f%C3%B6rfattare/"))

  expect(internal.length).toBeGreaterThan(0)
  expect(internal.every(href => href?.startsWith("/f%C3%B6rfattare/"))).toBe(true)
})

test("Library route aliases preserve supported query bytes and keep hide1800 recent-only", async ({
  request
}) => {
  const redirect = await request.get(
    "/titlar?visa=works&keywords=texttype%3Aroman&keep=ja",
    { maxRedirects: 0 }
  )
  expect(redirect.status()).toBe(308)
  expect(redirect.headers().location)
    .toBe("/bibliotek?visa=works&keywords=texttype:roman&keep=ja")

  const all = parseHTML(await (await request.get("/bibliotek?hide1800")).text()).document
  expect(all.querySelector("[data-library-hide-1800]")).toBeNull()
  expect((await requests(request)).at(-1)?.query.q ?? "").not.toContain("NOT keyword:1800")

  const works = parseHTML(
    await (await request.get("/bibliotek?visa=works&hide1800")).text()
  ).document
  expect(works.querySelector("[data-library-hide-1800]")).toBeNull()
  expect((await epubRequests(request)).at(-1)?.query.q ?? "").not.toContain("NOT keyword:1800")

  const standalone = parseHTML(await (await request.get("/epub?hide1800")).text()).document
  expect(standalone.querySelector("[data-library-hide-1800]")).toBeNull()
  expect((await epubRequests(request)).at(-1)?.query.q ?? "").not.toContain("NOT keyword:1800")

  const latest = parseHTML(
    await (await request.get("/bibliotek?visa=latest&hide1800")).text()
  ).document
  expect(latest.querySelector("[data-library-hide-1800]")).not.toBeNull()
  expect((await epubRequests(request)).at(-1)?.query.q).toContain("NOT keyword:1800")
})

test("download mode is Library-only, forces Works, and requests source exports on SSR", async ({
  request
}) => {
  const library = parseHTML(
    await (await request.get("/bibliotek?visa=pdf&nedladdning=1")).text()
  ).document
  expect(library.querySelector(".dl_mode")).not.toBeNull()
  expect(library.querySelector('[data-library-tab="works"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(library.querySelectorAll("[data-library-source-checkbox]")).toHaveLength(3)
  expect((await epubRequests(request)).at(-1)?.query.q)
    .toContain("export>type:(xml OR txt OR workdb)")

  const standalone = parseHTML(await (await request.get("/epub?nedladdning=1")).text()).document
  expect(standalone.querySelector(".dl_mode")).toBeNull()
  expect(standalone.querySelector("[data-library-source-checkbox]")).toBeNull()
  expect((await epubRequests(request)).at(-1)?.query.q ?? "")
    .not.toContain("export>type:(xml OR txt OR workdb)")
})

test("SSR obtains deterministic chronology bounds from the typed imprint-range response", async ({
  request
}) => {
  await request.put(`${fixture}/_library_imprint_range`, {
    data: { start_year: { value_as_string: "1814" }, end_year: { value_as_string: "1915" } }
  })
  const response = await request.get("/bibliotek?avancerat=1&intervall=1850%2C1900")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const ranges = [...document.querySelectorAll<HTMLInputElement>(
    "[data-library-chronology-range] input[type=range]"
  )]
  expect(ranges.map(input => [
    input.getAttribute("min"), input.getAttribute("max"), input.value
  ])).toEqual([
    ["1814", "1915", "1850"],
    ["1814", "1915", "1900"]
  ])
  expect((await (await request.get(`${fixture}/_library_imprint_requests`)).json()).requests)
    .toEqual([{ path: "/legacy-api/imprint_range" }])
  expect((await requests(request))[0]?.query.q).toContain(
    "sort_date_imprint.date:[1850 TO 1900]"
  )
})

test("SSR fails chronology closed when imprint bounds are malformed", async ({ request }) => {
  await request.put(`${fixture}/_library_imprint_range`, {
    data: { start_year: { value_as_string: "later" }, end_year: { value_as_string: "earlier" } }
  })
  const response = await request.get("/bibliotek?avancerat=1&intervall=1850%2C1900")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("[data-library-chronology-unavailable]")?.textContent?.trim())
    .toBe("Tidslinjen kunde inte hämtas.")
  expect(document.querySelector("[data-library-chronology-range]")).toBeNull()
  expect((await requests(request))[0]?.query.q).toBeUndefined()
})

test("author mode derives rows and count from filtered work and part aggregations", async ({
  request
}) => {
  const response = await request.get(
    "/bibliotek?visa=authors&sort=namn&k%C3%B6n=female&mediatypes=mediatype%3Aetext"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector('[data-library-tab="authors"]')?.textContent?.trim())
    .toBe("Författare: 4")
  expect([...document.querySelectorAll("[data-library-author-row]")]).toHaveLength(4)

  const authorDetail = (await requests(request)).find(entry => entry.path.endsWith("/author"))
  expect(authorDetail?.query.q).toBeUndefined()
  expect(authorDetail?.query.to).toBe("10000")
  const aggregates = (await epubRequests(request)).filter(entry => entry.query.to === "0")
  expect(aggregates.map(entry => entry.path)).toEqual([
    "/legacy-api/query_string/etext,faksimil,pdf",
    "/legacy-api/query_string/etext-part,faksimil-part"
  ])
  expect(aggregates.every(entry => entry.query.q.includes("gender:female"))).toBe(true)
  expect(aggregates.every(entry => entry.query.q.includes("mediatype:etext"))).toBe(true)
})

test("SSR preserves malformed advanced bytes but never executes them", async ({ request }) => {
  const response = await request.get(
    "/bibliotek?keep=%28unsafe%29&avancerat=maybe&k%C3%B6n=other" +
    "&mediatypes=mediatype%3Aetext%2Cmediatype%3Aunknown" +
    "&languages=language%3Aswe%2CRAW%3A%2A&intervall=1910%2C1900"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector("[data-library-advanced]")?.getAttribute("aria-expanded"))
    .toBe("false")
  expect(document.querySelector<HTMLSelectElement>("[data-library-gender]")).toBeNull()
  expect(document.querySelector('[data-library-tab="epub"]')?.getAttribute("href"))
    .toContain("keep=%28unsafe%29")
  expect((await requests(request))[0]?.query.q).toBeUndefined()
})

test("SSR composes advanced predicates in EPUB and work query-string modes", async ({
  request
}) => {
  const advanced = "k%C3%B6n=female&mediatypes=mediatype%3Aetext"
  const expectedAdvanced =
    "(gender:female OR authors>(gender:female)) AND (mediatype:etext)"

  const epub = await request.get(`/bibliotek?visa=epub&sort=popularitet&${advanced}`)
  expect(epub.status()).toBe(200)
  expect((await epubRequests(request))[0]?.query.q).toBe(
    `${epubQueryPrefix} (has_epub:true AND ${expectedAdvanced})`
  )

  await reset(request)
  const works = await request.get(`/bibliotek?visa=works&sort=popularitet&${advanced}`)
  expect(works.status()).toBe(200)
  expect((await epubRequests(request))[0]?.query.q).toBe(
    `${epubQueryPrefix} ${expectedAdvanced}`
  )
})

test("SSR renders the canonical latest-work slice with imported-date groups", async ({ request }) => {
  const response = await request.get("/bibliotek?visa=latest&sort=nytillkommet")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector('[data-library-tab="latest"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector('[data-library-tab="latest"]')?.classList.contains("active"))
    .toBe(true)
  expect([...document.querySelectorAll("[data-library-latest-header]")].map(node =>
    node.textContent?.trim()
  )).toEqual(["18 juli 2026 (3 verk)", "17 juli 2026 (1 verk)"])
  expect([...document.querySelectorAll("[data-library-latest-row]")]).toHaveLength(3)
  expect(document.querySelector('[data-library-latest-title="DoktorGlas"]')?.textContent?.trim())
    .toBe("Doktor Glas")
  expect(document.querySelector('[data-library-latest-title="DoktorGlas"]')?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken")
  const latestRow = document.querySelector("[data-library-latest-row]")
  expect(latestRow?.querySelector('[data-library-tooltip-kind="title"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Doktor Glas. Roman")
  expect(latestRow?.querySelector('[data-library-tooltip-kind="author"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Hjalmar Söderberg (1869-1941)")

  const ledger = await epubRequests(request)
  expect(ledger).toHaveLength(1)
  expect(ledger[0]).toEqual({
    path: "/legacy-api/query_string/etext,faksimil,pdf",
    query: {
      author_aggregation: "true",
      exclude: epubExclude,
      from: "0",
      imported_aggregation: "true",
      include: epubInclude,
      partial_string: "true",
      q: `${epubQueryPrefix} *`,
      sort_field: "imported|desc,main_author.name_for_index|asc,sortkey|asc,sort_date_imprint.date|asc",
      suggest: "true",
      to: "100"
    }
  })
})

test("SSR renders the three primary browse tabs as live routed result modes", async ({ request }) => {
  const cases = [
    {
      mode: "authors",
      sort: "namn",
      row: "[data-library-author-row]",
      text: "Bauer, John",
      path: "/legacy-api/relevance/author",
      sortField: "name_for_index|asc"
    },
    {
      mode: "works",
      sort: "popularitet",
      row: "[data-library-work-row]",
      text: "Doktor Glas",
      path: epubPath,
      sortField: "popularity|desc"
    },
    {
      mode: "parts",
      sort: "titlar",
      row: "[data-library-part-row]",
      text: "En novell",
      path: "/legacy-api/query_string/etext-part,faksimil-part",
      sortField: "sortkey|asc"
    }
  ] as const

  for (const item of cases) {
    await reset(request)
    const response = await request.get(`/bibliotek?visa=${item.mode}&sort=${item.sort}`)
    expect(response.status(), item.mode).toBe(200)
    const { document } = parseHTML(await response.text())
    const tab = document.querySelector(`[data-library-tab="${item.mode}"]`)

    expect(tab?.tagName, item.mode).toBe("A")
    expect(tab?.hasAttribute("data-deferred"), item.mode).toBe(false)
    expect(tab?.getAttribute("aria-current"), item.mode).toBe("page")
    expect(document.querySelector(item.row)?.textContent, item.mode).toContain(item.text)

    if (item.mode === "works") {
      const row = document.querySelector(item.row)
      expect(row?.querySelector('[data-library-tooltip-kind="title"]')
        ?.getAttribute("data-library-tooltip-content")).toBe("Doktor Glas. Roman")
      expect(row?.querySelector('[data-library-tooltip-kind="author"]')
        ?.getAttribute("data-library-tooltip-content")).toBe("Hjalmar Söderberg (1869-1941)")
      expect(document.querySelector('[role="tooltip"]')).toBeNull()
    }

    if (item.mode === "authors") {
      expect(tab?.textContent?.trim()).toBe("Författare: 4")
      expect(document.querySelector(item.row)?.querySelectorAll("td")).toHaveLength(2)
      expect(document.querySelector("[data-library-pagination-next]")).toBeNull()
      expect(document.querySelector('[data-library-sort="popularitet"]')?.getAttribute("href"))
        .not.toContain("sida=")
    } else if (item.mode === "works") {
      expect(tab?.textContent?.trim()).toBe("Verk: 3")
      expect(document.querySelectorAll(item.row)).toHaveLength(3)
      expect([...document.querySelectorAll("[data-library-work-actions] a")]
        .map(link => link.textContent?.trim())).toEqual([
        "Läs som etext",
        "Läs som faksimil",
        "Ladda ner epub",
        "Ladda ner pdf",
        "Gör en sökning i verket",
        "Läs mer om verket",
        "Läs som etext",
        "Ladda ner epub",
        "Läs mer om verket",
        "Läs som etext",
        "Ladda ner epub",
        "Läs mer om verket"
      ])
    } else {
      expect(tab?.textContent?.trim()).toBe("Dikt, novell, etc.: 201")
      expect(document.querySelectorAll(item.row)).toHaveLength(1)
      expect(document.querySelector('[data-library-page="3"]')?.textContent?.trim()).toBe("3")
      expect(document.querySelector(`${item.row} .title_inner a`)?.getAttribute("href"))
        .toBe("/f%C3%B6rfattare/NovellA/titlar/Novellsamling/sida/7/etext")
      expect(document.querySelector(`${item.row} td:last-child a`)?.textContent?.trim()).toBe("Poet")
    }

    const ledger = item.mode === "authors" ? await requests(request) : await epubRequests(request)
    expect(ledger, item.mode).toHaveLength(1)
    expect(ledger[0]?.path, item.mode).toBe(item.path)
    expect(ledger[0]?.query.sort_field, item.mode).toBe(item.sortField)
    expect(ledger[0]?.query.to, item.mode).toBe(item.mode === "authors" ? "10000" : "100")
  }
})

test("Works prefers real PDF downloads, keeps raw filenames, and never invents About for infopost", async ({
  request
}) => {
  const realPdfResponse = await request.get(
    "/bibliotek?visa=works&sort=popularitet&filter=real-pdf"
  )
  expect(realPdfResponse.status()).toBe(200)
  const realPdf = parseHTML(await realPdfResponse.text()).document
  const realPdfRow = realPdf.querySelector("[data-library-work-row]")
  expect(realPdf.querySelectorAll("[data-library-work-row]")).toHaveLength(1)
  expect(realPdfRow?.querySelectorAll('a[href^="/export/faksimil/"]')).toHaveLength(0)
  expect(realPdfRow?.querySelector('a[href="/txt/lb-RealPdf/lb-RealPdf.pdf"]')
    ?.getAttribute("download")).toBe("SöderbergH_RealPdf.pdf")
  expect(realPdfRow?.querySelector('a[href="/txt/epub/S%C3%B6derbergH_RealPdf.epub"]')
    ?.getAttribute("download")).toBe("SöderbergH_RealPdf.epub")

  const infopostResponse = await request.get(
    "/bibliotek?visa=works&sort=popularitet&filter=infopost-test"
  )
  expect(infopostResponse.status()).toBe(200)
  const infopost = parseHTML(await infopostResponse.text()).document
  const infopostActions = [...infopost.querySelectorAll("[data-library-work-actions] a")]
  expect(infopostActions.map(link => link.textContent?.trim())).toEqual(["Läs som infopost"])
  expect(infopostActions[0]?.getAttribute("href")).toBe(
    "/dramawebben/pjäser?om-boken&authorid=S%C3%B6derbergH&titlepath=InfopostWork"
  )
})

test("Nytt groups a work by its newest representation while keeping the preferred display row", async ({
  request
}) => {
  const response = await request.get(
    "/bibliotek?visa=latest&sort=nytillkommet&filter=latest-regression"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect([...document.querySelectorAll("[data-library-latest-header]")].map(node =>
    node.textContent?.trim()
  )).toEqual(["19 juli 2026 (1 verk)", "17 juli 2026 (1 verk)"])
  expect(document.querySelector('[data-library-latest-title="LatestMixed"]')?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/S%C3%B6derbergH/titlar/LatestMixed/etext?om-boken")
})

test("Nytt never links a selected PDF representation to an unsupported Reader mode", async ({
  request
}) => {
  const response = await request.get(
    "/bibliotek?visa=latest&sort=nytillkommet&filter=latest-regression"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector('[data-library-latest-title="LatestPdfOnly"]')?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/S%C3%B6derbergH/titlar/LatestPdfOnly/faksimil?om-boken")
  expect(document.querySelector('a[href$="/LatestPdfOnly/pdf?om-boken"]')).toBeNull()
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
      "Alla träffar", "Nytt", "Författare", "Verk", "Dikt, novell, etc.", "Epub: 1", "PDF"
    ])
  expect(epubRows(library)).toEqual([{
    title: "Gösta Berlings saga",
    titleHref: "/f%C3%B6rfattare/LagerlofS/titlar/GostaBerlingsSaga/etext?om-boken",
    year: "1891",
    author: "Lagerlöf",
    authorHref: "/f%C3%B6rfattare/LagerlofS",
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
      .map(node => node.textContent?.trim())).toEqual(["Epub: 201", "PDF: 201"])
    expect(standalone.querySelector('[data-library-tab="epub"]')?.getAttribute("aria-current"))
      .toBe("page")
  }
  expect(epubRows(library)).toEqual(epubRows(bare))
  expect([...library.querySelectorAll("[data-library-tab]")]
    .map(node => node.textContent?.trim()))
    .toEqual([
      "Alla träffar", "Nytt", "Författare", "Verk", "Dikt, novell, etc.", "Epub: 201", "PDF"
    ])
  expect(epubRows(bare)).toEqual(epubRows(canonical))
  expect(epubRows(bare)).toHaveLength(3)

  const firstRow = bare.querySelector("[data-library-epub-row]")
  const titleHref = firstRow?.querySelector("[data-library-epub-title]")?.getAttribute("href")
  const authorHref = firstRow?.querySelector("[data-library-epub-author]")?.getAttribute("href")
  const download = firstRow?.querySelector("[data-library-epub-download]")
  expect(titleHref).toBe("/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/etext?om-boken")
  expect(authorHref).toBe("/f%C3%B6rfattare/S%C3%B6derbergH")
  expect(download?.getAttribute("href"))
    .toBe("/txt/epub/S%C3%B6derbergH_DoktorGlas.epub")
  expect(download?.getAttribute("download")).not.toBeNull()
  expect(download?.getAttribute("target")).toBe("_self")
  expect(bare.querySelector('[data-library-epub-row]:nth-child(2) .author')
    ?.textContent?.trim()).toBe("Geijer (red.)")
  expect(bare.querySelector('[data-library-epub-row]:nth-child(3) .author')
    ?.textContent?.trim()).toBe("Bauer (ill.)")
  expect(firstRow?.querySelector('[data-library-tooltip-kind="title"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Doktor Glas. Roman")
  expect(firstRow?.querySelector('[data-library-tooltip-kind="author"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Hjalmar Söderberg (1869-1941)")
  expect(bare.querySelector('[data-library-epub-row]:nth-child(2) [data-library-tooltip-kind="title"]')
    ?.getAttribute("data-library-tooltip-content")).toBeNull()
  expect(bare.querySelector('[data-library-epub-row]:nth-child(3) [data-library-tooltip-kind="title"]')
    ?.getAttribute("data-library-tooltip-content")).toBeNull()
  expect(bare.querySelector('[role="tooltip"]')).toBeNull()
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

test("SSR renders grouped PDF actions in the Library shell from one private request", async ({
  request
}) => {
  const response = await request.get("/bibliotek?visa=pdf&sort=popularitet")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("Biblioteket – Titlar och författare | Litteraturbanken")
  expect(document.body.className).toBe("focus page-library ready")
  expect(document.documentElement.getAttribute("style")).toContain("biblioteket_bakgrund.jpg")
  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Botanisera i biblioteket")
  expect(document.querySelector('[data-library-tab="pdf"]')?.tagName).toBe("A")
  expect(document.querySelector('[data-library-tab="pdf"]')?.getAttribute("aria-current"))
    .toBe("page")

  expect(pdfRows(document)).toEqual([
    {
      title: exportedEtextPdfRepresentation.shorttitle,
      titleHref: "/f%C3%B6rfattare/LagerlofS/titlar/GostaBerlingsSaga/etext?om-boken",
      year: exportedEtextPdfRepresentation.sort_date_imprint.plain,
      author: exportedEtextPdfRepresentation.main_author.surname,
      authorHref: "/f%C3%B6rfattare/LagerlofS",
      downloadHref: "/export/faksimil/lb-GostaBerlingsSaga.pdf",
      download: "LagerlofS_GostaBerlingsSaga.pdf",
      target: "_self"
    },
    {
      title: exportedFaksimilPdfRepresentation.shorttitle,
      titleHref: "/f%C3%B6rfattare/GeijerEGA/titlar/SvenskaFolkvisor/faksimil?om-boken",
      year: exportedFaksimilPdfRepresentation.sort_date_imprint.plain,
      author: exportedFaksimilPdfRepresentation.main_author.surname,
      authorHref: "/f%C3%B6rfattare/GeijerEGA",
      downloadHref: "/export/faksimil/lb-SvenskaFolkvisor.pdf",
      download: "AfzeliusAA_SvenskaFolkvisor.pdf",
      target: "_self"
    },
    {
      title: indexedPdfRepresentation.shorttitle,
      titleHref: "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/faksimil?om-boken",
      year: indexedPdfRepresentation.sort_date_imprint.plain,
      author: indexedPdfRepresentation.main_author.surname,
      authorHref: "/f%C3%B6rfattare/StrindbergA",
      downloadHref: "/txt/lb-RodaRummet/lb-RodaRummet.pdf",
      download: "ArchiveA_RodaRummet.pdf",
      target: "_self"
    },
    {
      title: groupedPdfExportRepresentation.shorttitle,
      titleHref: "/f%C3%B6rfattare/LagerlofS/titlar/NilsHolgersson/faksimil?om-boken",
      year: groupedPdfExportRepresentation.sort_date_imprint.plain,
      author: groupedPdfExportRepresentation.main_author.surname,
      authorHref: `/f%C3%B6rfattare/${groupedPdfExportRepresentation.main_author.authorid}`,
      downloadHref: "/txt/lb-NilsHolgersson/lb-NilsHolgersson.pdf",
      download: "DirectPdfA_NilsHolgerssonPdf.pdf",
      target: "_self"
    },
    {
      title: duplicatePdfExportRepresentation.shorttitle,
      titleHref: "/f%C3%B6rfattare/LagerlofS/titlar/Jerusalem/etext?om-boken",
      year: duplicatePdfExportRepresentation.sort_date_imprint.plain,
      author: duplicatePdfExportRepresentation.main_author.surname,
      authorHref: "/f%C3%B6rfattare/LagerlofS",
      downloadHref: "/export/faksimil/lb-Jerusalem.pdf",
      download: "LagerlofS_Jerusalem.pdf",
      target: "_self"
    }
  ])
  const firstPdfRow = document.querySelector("[data-library-pdf-row]")
  expect(firstPdfRow?.querySelector('[data-library-tooltip-kind="title"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Gösta Berlings saga. Roman")
  expect(firstPdfRow?.querySelector('[data-library-tooltip-kind="author"]')
    ?.getAttribute("data-library-tooltip-content")).toBe("Selma Lagerlöf (1858-1940)")
  expect(document.querySelector('[role="tooltip"]')).toBeNull()
  expect(document.body.textContent).not.toContain("Begränsad export")
  expect([...document.querySelectorAll("[data-library-page]")].map(node => node.textContent))
    .toEqual(["1", "2", "3"])
  expect(document.querySelector('[data-library-page="4"]')).toBeNull()
  expect(document.querySelector("[data-library-pagination-previous]")
    ?.getAttribute("aria-disabled")).toBe("true")
  expect(document.querySelector("[data-library-pagination-next]")?.getAttribute("href"))
    .toBe("/bibliotek?visa=pdf&sort=popularitet&sida=2")

  expect(await epubRequests(request)).toEqual([{
    path: epubPath,
    query: {
      exclude: epubExclude,
      include: pdfInclude,
      partial_string: "true",
      q: `${epubQueryPrefix} (${pdfPredicate})`,
      sort_field: "popularity|desc",
      from: "0",
      to: "100",
      suggest: "true"
    }
  }])
  expect(await requests(request)).toEqual([])
  expect(libraryPdfPageOneResponse.hits).not.toBe(libraryPdfPageOneResponse.distinct_hits)
})

test("SSR renders one PDF request and exact tab hrefs in the standalone shell", async ({
  request
}) => {
  const pdfResponse = await request.get("/epub?visa=pdf")
  expect(pdfResponse.status()).toBe(200)
  const pdf = parseHTML(await pdfResponse.text()).document

  expect(pdf.title).toBe("E-böcker för nedladdning | Litteraturbanken")
  expect(pdf.body.className).toBe("focus page-epub ready")
  expect(pdf.documentElement.getAttribute("style")).toContain("background-image:none")
  expect(pdf.querySelector("h1")?.textContent?.trim()).toBe("Hämta e-böcker")
  expect(pdf.querySelector('[data-library-tab="pdf"]')?.tagName).toBe("A")
  expect(pdf.querySelector('[data-library-tab="pdf"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(pdfRows(pdf)).toHaveLength(5)
  expect([...pdf.querySelectorAll("[data-library-tab]")].map(tab => ({
    label: tab.textContent?.trim(),
    href: tab.getAttribute("href")
  }))).toEqual([
    { label: "Epub: 201", href: "/epub?sort=popularitet" },
    { label: "PDF: 201", href: "/epub?visa=pdf&sort=popularitet" }
  ])
  expect(await epubRequests(request)).toEqual(expect.arrayContaining([{
    path: epubPath,
    query: expect.objectContaining({
      exclude: epubExclude,
      from: "0",
      to: "0",
      q: `${epubQueryPrefix} (has_epub:true)`
    })
  }]))
  expect((await epubRequests(request)).filter(entry => entry.query.to !== "0")).toEqual([{
    path: epubPath,
    query: expect.objectContaining({
      include: pdfInclude,
      q: `${epubQueryPrefix} (${pdfPredicate})`,
      from: "0",
      to: "100"
    })
  }])
  expect(await requests(request)).toEqual([])
})

test("SSR defaults an unsupported standalone visa value to EPUB", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/epub?visa=unsupported"
  )).text()).document

  expect(document.querySelector('[data-library-tab="epub"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect([...document.querySelectorAll("[data-library-tab]")].map(tab => ({
    label: tab.textContent?.trim(),
    href: tab.getAttribute("href")
  }))).toEqual([
    { label: "Epub: 201", href: "/epub?sort=popularitet" },
    { label: "PDF: 201", href: "/epub?visa=pdf&sort=popularitet" }
  ])
  expect(epubRows(document)).toHaveLength(3)
  expect(pdfRows(document)).toHaveLength(0)
  expect((await epubRequests(request)).filter(entry => entry.query.to !== "0")).toEqual([{
    path: epubPath,
    query: {
      exclude: epubExclude,
      include: epubInclude,
      partial_string: "true",
      q: `${epubQueryPrefix} (has_epub:true)`,
      sort_field: "popularity|desc",
      from: "0",
      to: "100",
      suggest: "true"
    }
  }])
  expect((await epubRequests(request)).filter(entry => entry.query.to === "0")).toEqual([
    expect.objectContaining({
      path: epubPath,
      query: expect.objectContaining({ q: `${epubQueryPrefix} (${pdfPredicate})` })
    })
  ])
  expect(await requests(request)).toEqual([])
})

test("SSR isolates an invalid inactive PDF count from active EPUB rows", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/epub?filter=invalid-hits&sort=popularitet"
  )).text()).document

  expect(document.querySelectorAll("[data-library-epub-row]")).toHaveLength(3)
  expect(document.querySelector("[data-library-error]")).toBeNull()
  expect(document.querySelector('[data-library-tab="epub"]')?.textContent?.trim())
    .toBe("Epub: 201")
  expect(document.querySelector('[data-library-tab="pdf"]')?.textContent?.trim())
    .toBe("PDF")
  expect((await epubRequests(request)).filter(entry => entry.query.to === "0"))
    .toHaveLength(1)
})

for (const [sort, expression] of [
  ["forfattare", "main_author.name_for_index|asc,sortkey|asc"],
  ["titlar", "sortkey|asc"],
  ["popularitet", "popularity|desc"],
  ["kronologi", "sort_date_imprint.date|desc"]
] as const) {
  test(`SSR sends the exact PDF ${sort} sort expression`, async ({ request }) => {
    const response = await request.get(`/bibliotek?visa=pdf&sort=${sort}`)
    expect(response.status()).toBe(200)
    expect(await epubRequests(request)).toEqual([{
      path: epubPath,
      query: expect.objectContaining({
        q: `${epubQueryPrefix} (${pdfPredicate})`,
        sort_field: expression,
        from: "0",
        to: "100"
      })
    }])
    expect(await requests(request)).toEqual([])
  })
}

for (const [label, path] of [
  ["default", "/bibliotek?visa=pdf"],
  ["invalid", "/bibliotek?visa=pdf&sort=saknas"]
] as const) {
  test(`SSR normalizes ${label} PDF sort to popularitet`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const ledger = await epubRequests(request)
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.query).toMatchObject({
      q: `${epubQueryPrefix} (${pdfPredicate})`,
      sort_field: "popularity|desc"
    })
  })
}

for (const invalid of ["saknas", "0", "-2", "1.5"]) {
  test(`SSR normalizes invalid PDF page ${invalid} to one`, async ({ request }) => {
    const document = parseHTML(await (await request.get(
      `/bibliotek?visa=pdf&sort=popularitet&sida=${invalid}`
    )).text()).document
    expect(document.querySelector('[data-library-page="1"]')?.getAttribute("aria-current"))
      .toBe("page")
    expect((await epubRequests(request))[0]?.query).toMatchObject({
      q: `${epubQueryPrefix} (${pdfPredicate})`,
      from: "0",
      to: "100"
    })
  })
}

test("SSR selects PDF page two with encoded author and exact bounds", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&sort=popularitet&sida=2"
  )).text()).document

  expect(pdfRows(document)).toEqual([{
    title: pageTwoPdfRepresentation.shorttitle,
    titleHref: "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/faksimil?om-boken",
    year: pageTwoPdfRepresentation.sort_date_imprint.plain,
    author: pageTwoPdfRepresentation.main_author.surname,
    authorHref: "/f%C3%B6rfattare/S%C3%B6derbergH",
    downloadHref: "/export/faksimil/lb-DoktorGlas.pdf",
    download: "SöderbergH_DoktorGlas.pdf",
    target: "_self"
  }])
  expect(document.querySelector('[data-library-page="2"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector("[data-library-pagination-previous]")?.getAttribute("href"))
    .toBe("/bibliotek?visa=pdf&sort=popularitet&sida=1")
  expect(document.querySelector("[data-library-pagination-next]")?.getAttribute("href"))
    .toBe("/bibliotek?visa=pdf&sort=popularitet&sida=3")
  expect((await epubRequests(request))[0]?.query).toMatchObject({
    q: `${epubQueryPrefix} (${pdfPredicate})`,
    from: "100",
    to: "200"
  })
})

test("SSR disables PDF pagination at the distinct-hit final boundary", async ({ request }) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&sort=popularitet&sida=3"
  )).text()).document

  expect(document.querySelector('[data-library-page="3"]')?.getAttribute("aria-current"))
    .toBe("page")
  expect(document.querySelector("[data-library-pagination-previous]")?.getAttribute("href"))
    .toBe("/bibliotek?visa=pdf&sort=popularitet&sida=2")
  expect(document.querySelector("[data-library-pagination-next]")
    ?.getAttribute("aria-disabled")).toBe("true")
  expect((await epubRequests(request))[0]?.query).toMatchObject({
    q: `${epubQueryPrefix} (${pdfPredicate})`,
    from: "200",
    to: "300"
  })
})

test("SSR sanitizes PDF free text and combines it with the exact predicate", async ({ request }) => {
  const response = await request.get(
    "/bibliotek?visa=pdf&filter=Selma%E2%80%93Lagerl%C3%B6f%2C%20%22roman%22"
  )
  expect(response.status()).toBe(200)
  expect((await epubRequests(request))[0]?.query.q).toBe(
    `${epubQueryPrefix} (${pdfPredicate} AND (Selma Lagerlöf roman))`
  )
  expect(await requests(request)).toEqual([])
})

test("SSR groups PDFs by the exact tuple and selects the first valid export source", async ({
  request
}) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&filter=tuple-collision"
  )).text()).document
  const selected = [
    ...libraryPdfTupleCollisionResponse.data.slice(0, 7),
    libraryPdfTupleCollisionResponse.data[8]!
  ]

  expect(pdfRows(document)).toEqual(selected.map(record => ({
    title: record.shorttitle,
    titleHref: `/f%C3%B6rfattare/${record.main_author.authorid}/titlar/${record.work_titleid}/${record.mediatype}?om-boken`,
    year: record.sort_date_imprint.plain,
    author: record.main_author.surname,
    authorHref: `/f%C3%B6rfattare/${record.main_author.authorid}`,
    downloadHref: `/export/faksimil/${record.lbworkid}.pdf`,
    download: `${record.main_author.authorid}_${record.work_titleid}.pdf`,
    target: "_self"
  })))
  expect(pdfRows(document).map(row => row.title)).not.toContain("Andra exakta gruppen")
  expect(pdfRows(document).map(row => row.title)).not.toContain("Senare PDF-exportkälla")
  expect(libraryPdfTupleCollisionResponse).toMatchObject({ hits: 10, distinct_hits: 8 })
  expect((await epubRequests(request))[0]?.query.q).toBe(
    `${epubQueryPrefix} (${pdfPredicate} AND (tuple collision))`
  )
})

test("SSR preserves repeated unrelated keys in PDF tab, sort, and page hrefs", async ({
  request
}) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?keep&keep=ja&visa=pdf&filter=R%C3%B6d&sort=popularitet&sida=2"
  )).text()).document

  expect(document.querySelector('[data-library-tab="epub"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=epub&filter=R%C3%B6d&sort=popularitet")
  expect(document.querySelector('[data-library-tab="pdf"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=pdf&filter=R%C3%B6d&sort=popularitet")
  expect(document.querySelector('[data-library-sort="titlar"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=pdf&filter=R%C3%B6d&sort=titlar&sida=1")
  expect(document.querySelector('[data-library-page="1"]')?.getAttribute("href"))
    .toBe("/bibliotek?keep=&keep=ja&visa=pdf&filter=R%C3%B6d&sort=popularitet&sida=1")
})

test("SSR omits unsupported and unsafe PDF rows without invalidating the safe group", async ({
  request
}) => {
  const document = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&filter=malformed-row"
  )).text()).document

  expect(pdfRows(document)).toEqual([
    {
      title: exportedEtextPdfRepresentation.shorttitle,
      titleHref: "/f%C3%B6rfattare/LagerlofS/titlar/GostaBerlingsSaga/etext?om-boken",
      year: exportedEtextPdfRepresentation.sort_date_imprint.plain,
      author: exportedEtextPdfRepresentation.main_author.surname,
      authorHref: "/f%C3%B6rfattare/LagerlofS",
      downloadHref: "/export/faksimil/lb-GostaBerlingsSaga.pdf",
      download: "LagerlofS_GostaBerlingsSaga.pdf",
      target: "_self"
    },
    {
      title: "Tom verkförfattarlista",
      titleHref: "/f%C3%B6rfattare/SafeA/titlar/EmptyWorkAuthors/faksimil?om-boken",
      year: "1902",
      author: "Säker",
      authorHref: "/f%C3%B6rfattare/SafeA",
      downloadHref: "/txt/lb-EmptyWorkAuthors/lb-EmptyWorkAuthors.pdf",
      download: "SafeA_EmptyWorkAuthors.pdf",
      target: "_self"
    },
    {
      title: "Giltig gruppexport",
      titleHref: "/f%C3%B6rfattare/SafeA/titlar/MalformedGroupedFallback/faksimil?om-boken",
      year: "1902",
      author: "Säker",
      authorHref: "/f%C3%B6rfattare/SafeA",
      downloadHref: "/export/faksimil/lb-MalformedGroupedFallback.pdf",
      download: "SafeA_MalformedGroupedFallback.pdf",
      target: "_self"
    }
  ])
  expect(document.querySelector("[data-library-error]")).toBeNull()
  for (const rejected of [
    "UnsafeAuthor",
    "UnsafeTitle",
    "UnsupportedAudio",
    "UnsafeDotWork",
    "UnsafeSlashWork",
    "UnsafeControlWork",
    "NumericWork",
    "UnencodableWork",
    "UnsafeWorkAuthor",
    "MalformedAuthors",
    "MissingYear",
    "MissingDisplayTitle",
    "MissingAuthorName"
  ]) {
    expect(document.querySelector(`[href*="${rejected}"]`)).toBeNull()
  }
})

for (const marker of [
  "primitive-envelope",
  "invalid-hits",
  "invalid-distinct",
  "invalid-suggest"
]) {
  test(`SSR rejects the strict PDF ${marker} boundary`, async ({ request }) => {
    const document = parseHTML(await (await request.get(
      `/bibliotek?visa=pdf&filter=${marker}`
    )).text()).document

    expect(document.querySelector("[data-library-error]")?.textContent?.trim())
      .toBe("Ett fel uppstod.")
    expect(document.querySelector("[data-library-empty]")).toBeNull()
    expect(pdfRows(document)).toHaveLength(0)
    expect((await epubRequests(request))[0]?.query.q).toBe(
      `${epubQueryPrefix} (${pdfPredicate} AND (${marker.replaceAll("-", " ")}))`
    )
  })
}

test("SSR distinguishes PDF empty, malformed, failed, and nullable suggest states", async ({
  request
}) => {
  const empty = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&filter=inga"
  )).text()).document
  expect(empty.querySelector("[data-library-empty]")?.textContent?.trim()).toBe("Inga träffar.")
  expect(pdfRows(empty)).toHaveLength(0)

  await reset(request)
  const malformed = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&filter=malformed-top"
  )).text()).document
  expect(malformed.querySelector("[data-library-error]")?.textContent?.trim())
    .toBe("Ett fel uppstod.")
  expect(pdfRows(malformed)).toHaveLength(0)

  for (const filter of ["missing-suggest", "null-suggest"]) {
    await reset(request)
    const nullable = parseHTML(await (await request.get(
      `/bibliotek?visa=pdf&filter=${filter}`
    )).text()).document
    expect(pdfRows(nullable)).toHaveLength(5)
    expect(nullable.querySelector("[data-library-error]")).toBeNull()
  }

  await reset(request)
  await request.put(`${fixture}/_library_query_failure`)
  const failed = parseHTML(await (await request.get(
    "/bibliotek?visa=pdf&filter=failed"
  )).text()).document
  expect(failed.querySelector("[data-library-error]")?.textContent?.trim())
    .toBe("Ett fel uppstod.")
  expect(pdfRows(failed)).toHaveLength(0)
})

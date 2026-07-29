import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || "4100"}`

async function reset(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_author_works_requests`),
    request.delete(`${fixture}/_author_works_failures`),
    request.delete(`${fixture}/_author_works_delays`),
    request.delete(`${fixture}/_requests`)
  ])
}

async function authorWorksRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_author_works_requests`)
  return (await response.json() as { requests: string[] }).requests
}

async function generalRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_requests`)
  return (await response.json() as { requests: string[] }).requests
}

function compactText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? ""
}

type ParsedDocument = ReturnType<typeof parseHTML>["document"]

function hrefs(document: ParsedDocument, selector: string): Array<string | null> {
  return [...document.querySelectorAll(selector)].map(link => link.getAttribute("href"))
}

async function expectOnlyWorksRequest(
  request: APIRequestContext,
  expectedPath: string
) {
  expect(await authorWorksRequests(request)).toEqual([expectedPath])
  expect(await generalRequests(request)).toEqual([])
}

test.beforeEach(async ({ request }) => reset(request))

test("SSR renders rich authored works with the legacy DOM, actions, and sidebar", async ({
  request
}) => {
  const response = await request.get("/författare/StrindbergA/titlar")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.title).toBe("August Strindberg, Tillgängliga verk | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("August Strindberg, Tillgängliga verk")
  expect(document.body.className).toBe("focus page-authorInfo ready")
  expect(document.documentElement.getAttribute("style")).toContain("forf2_bkg.jpg")
  expect(compactText(document.querySelector("h1.text-balance.max-w-5xl")?.textContent))
    .toBe("August Strindberg (1849-1912)")

  const navigation = document.querySelector('nav[aria-label="Författarsidor"]')
  expect([...navigation?.querySelectorAll("a") ?? []].map(link => [
    link.textContent?.trim(),
    link.getAttribute("href")
  ])).toEqual([
    ["Introduktion", "/f%C3%B6rfattare/StrindbergA"],
    ["Verk", "/f%C3%B6rfattare/StrindbergA/titlar"],
    ["Ljud", "https://litteraturbanken.se/ljudochbild/författare/strindberga"],
    ["Dramawebben", "/f%C3%B6rfattare/StrindbergA/dramawebben"],
    ["Sök i texterna", "/s%C3%B6k?forfattare=StrindbergA&avancerad"]
  ])
  const activeNavigation = navigation?.querySelectorAll("li.active") ?? []
  expect(activeNavigation).toHaveLength(1)
  expect(activeNavigation[0]?.textContent?.trim()).toBe("Verk")
  expect(activeNavigation[0]?.querySelector("a")?.getAttribute("aria-current")).toBe("page")
  const audio = navigation?.querySelector("a[href^=\"https://litteraturbanken.se/ljudochbild\"]")
  expect(audio?.getAttribute("target")).toBe("_blank")
  expect(audio?.getAttribute("rel")?.split(/\s+/)).toEqual(
    expect.arrayContaining(["noopener", "noreferrer"])
  )

  const listing = document.querySelector(".page_content .unbox")
  expect(listing).not.toBeNull()
  expect([...listing?.querySelectorAll(":scope > div > h2") ?? []].map(node => (
    node.textContent?.trim()
  ))).toEqual([
    "Tillgängliga verk",
    "Dikter, noveller, essäer, etc. som ingår i andra verk",
    "Som fotograf",
    "Som illustratör",
    "Som utgivare",
    "Som översättare"
  ])

  const tables = [...listing?.querySelectorAll("table.contenttable") ?? []]
  expect(tables).toHaveLength(6)
  expect(tables.map(table => table.classList.contains("extra_wide")))
    .toEqual([false, false, true, true, true, true])
  expect(tables.map(table => table.querySelectorAll("tr").length))
    .toEqual([1, 1, 1, 1, 1, 1])
  expect(tables.map(table => table.querySelector("tr")?.querySelectorAll(":scope > td").length))
    .toEqual([2, 2, 3, 3, 3, 3])

  const firstRow = tables[0]!.querySelector("tr")!
  const actionLinks = [...firstRow.querySelectorAll("td.mediatypes a")]
  expect(actionLinks.map(link => link.textContent?.trim()))
    .toEqual(["etext", "faksimil", "infopost", "epub", "pdf"])
  expect(actionLinks.map(link => link.getAttribute("href"))).toEqual([
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/sida/-1/etext",
    "/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/sida/1/faksimil",
    "/dramawebben/pjäser?om-boken&authorid=StrindbergA&titlepath=RodaRummet",
    "/txt/epub/StrindbergA_RodaRummet.epub",
    "/export/faksimil/lb238704.pdf"
  ])
  expect(actionLinks.slice(0, 3).map(link => [
    link.getAttribute("target"),
    link.getAttribute("download")
  ])).toEqual([[null, null], [null, null], [null, null]])
  expect(actionLinks.slice(3).map(link => [
    link.getAttribute("target"),
    link.getAttribute("download")
  ])).toEqual([
    ["_self", "StrindbergA_RodaRummet.epub"],
    ["_self", "StrindbergA_RodaRummet.pdf"]
  ])

  const title = firstRow.querySelector(".title")
  expect(title?.getAttribute("title") ?? title?.querySelector("a")?.getAttribute("title"))
    .toBe("Röda rummet")
  expect(title?.querySelector("a")?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/StrindbergA/titlar/RodaRummet/sida/-1/etext?om-boken")
  expect(compactText(title?.textContent)).toBe("Röda rummet (1879)")
  expect(firstRow.querySelector(".dots")).not.toBeNull()

  const containing = tables[1]!.querySelector(".extras")
  expect(compactText(containing?.textContent)).toBe("i Strindberg: Ett drömspel")
  expect(containing?.querySelector("a.author")?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/StrindbergA")
  const contributor = tables[2]!.querySelector("tr > td:nth-child(2) a")
  expect(contributor?.textContent?.trim()).toBe("Lundin, Claës (författare)")
  expect(contributor?.getAttribute("href")).toBe("/f%C3%B6rfattare/LundinC")

  const portrait = document.querySelector(".page_content .portrait_container")
  expect(portrait?.querySelector("img.author_img")?.getAttribute("src"))
    .toBe("/red/forfattare/StrindbergA/StrindbergA_large.jpeg")
  expect(portrait?.querySelector("img.author_img")?.getAttribute("alt"))
    .toBe("Porträtt av August Strindberg")
  expect(compactText(portrait?.querySelector("figcaption")?.textContent))
    .toBe("August Strindberg, fotograferad 1902.")

  const linkBoxes = [...portrait?.querySelectorAll(".ext_links") ?? []]
  expect(linkBoxes).toHaveLength(2)
  expect(linkBoxes.map(box => box.querySelector("h3")?.textContent?.trim()))
    .toEqual(["Mer om författarskapet", "Författaren i uppslagsverk"])
  expect([...linkBoxes[0]!.querySelectorAll("a")].map(link => [
    link.textContent?.trim(),
    link.getAttribute("href")
  ])).toEqual([
    ["Texter om August Strindberg", "/f%C3%B6rfattare/StrindbergA/mer"],
    ["Presentation", "/f%C3%B6rfattare/StrindbergA/presentation"],
    ["Bibliografi", "/f%C3%B6rfattare/StrindbergA/bibliografi"],
    ["Strindbergsmuseet", "/presentationer/specialomraden/Strindberg.html"],
    ["Litteraturkartan", "https://litteraturbanken.se/litteraturkartan?s=lb_author.authorid:StrindbergA"]
  ])
  expect([...linkBoxes[1]!.querySelectorAll("a")].map(link => link.textContent?.trim()))
    .toEqual(["Svenskt biografiskt lexikon", "Wikipedia"])
  for (const link of [
    linkBoxes[0]!.querySelectorAll("a")[4]!,
    ...linkBoxes[1]!.querySelectorAll("a")
  ]) {
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")?.split(/\s+/)).toEqual(
      expect.arrayContaining(["noopener", "noreferrer"])
    )
  }

  expect(html).not.toContain("/semer")
  await expectOnlyWorksRequest(request, "/private-v2/authors/StrindbergA/works")
})

test("SSR renders rich about works without the portrait sidebar", async ({ request }) => {
  const response = await request.get("/författare/StrindbergA/mer")
  expect(response.status()).toBe(200)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.title).toBe("August Strindberg, Mer | Litteraturbanken")
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe("August Strindberg, Mer")
  expect(document.body.className).toBe("focus page-authorInfo ready")
  expect(document.documentElement.getAttribute("style")).toContain("forf2_bkg.jpg")
  expect(compactText(document.querySelector("h1")?.textContent))
    .toBe("August Strindberg (1849-1912)")
  expect(document.querySelector("nav li.active, nav [aria-current=page]")).toBeNull()

  const listing = document.querySelector(".page_content .unbox")
  expect([...listing?.querySelectorAll(":scope > div > h2") ?? []].map(node => (
    node.textContent?.trim()
  ))).toEqual([
    "Verk om August Strindberg",
    "Kortare texter om August Strindberg",
    "Som utgivare",
    "Som översättare"
  ])
  const tables = [...listing?.querySelectorAll("table.contenttable.extra_wide") ?? []]
  expect(tables).toHaveLength(4)
  expect(tables.map(table => table.querySelector("tr")?.querySelectorAll(":scope > td").length))
    .toEqual([3, 3, 3, 3])
  expect(tables[0]?.querySelector("tr > td:nth-child(2) a")?.textContent?.trim())
    .toBe("Lamm, Martin (levnadstecknare)")
  expect(compactText(tables[0]?.querySelector(".title")?.textContent))
    .toBe("August Strindberg (1940)")
  expect(compactText(tables[1]?.querySelector(".extras")?.textContent))
    .toBe("i Bergman: Studier i svensk dramatik")
  const download = tables[3]?.querySelector("td.mediatypes a")
  expect(download?.textContent?.trim()).toBe("pdf")
  expect(download?.getAttribute("href")).toBe("/txt/lb-about-translator-1/lb-about-translator-1.pdf")
  expect(download?.getAttribute("target")).toBe("_self")
  expect(download?.getAttribute("download")).toBe("JohnsonW_StrindbergInEnglish.pdf")
  expect(document.querySelector(".page_content .portrait_container, .page_content .ext_links"))
    .toBeNull()

  expect(html).not.toContain("/semer")
  await expectOnlyWorksRequest(request, "/private-v2/authors/StrindbergA/works")
})

test("SSR omits sparse and empty sections without inventing author content", async ({ request }) => {
  const sparse = await request.get("/författare/Lagerl%C3%B6fS/titlar")
  expect(sparse.status()).toBe(200)
  const sparseDocument = parseHTML(await sparse.text()).document

  expect(sparseDocument.title).toBe("Selma Lagerlöf, Tillgängliga verk | Litteraturbanken")
  expect(compactText(sparseDocument.querySelector("h1")?.textContent))
    .toBe("Selma Lagerlöf (1858-1940)")
  expect([...sparseDocument.querySelectorAll(".page_content .unbox h2")].map(node => (
    node.textContent?.trim()
  ))).toEqual(["Tillgängliga verk"])
  expect(sparseDocument.querySelectorAll("table.contenttable")).toHaveLength(1)
  expect(compactText(sparseDocument.querySelector(".title")?.textContent))
    .toBe("Gösta Berlings saga (1891)")
  expect(sparseDocument.querySelector(".portrait_container img, .ext_links + .ext_links"))
    .toBeNull()
  expect([...sparseDocument.querySelectorAll(".ext_links a")].map(link => (
    link.textContent?.trim()
  ))).toEqual(["Presentation", "Bibliografi"])
  expect(sparseDocument.body.textContent).not.toContain("Texter om Selma Lagerlöf")
  await expectOnlyWorksRequest(request, "/private-v2/authors/Lagerl%C3%B6fS/works")

  for (const variant of ["titlar", "mer"] as const) {
    await reset(request)
    const empty = await request.get(`/författare/NoWorks/${variant}`)
    expect(empty.status(), variant).toBe(200)
    const emptyDocument = parseHTML(await empty.text()).document
    expect(compactText(emptyDocument.querySelector("h1")?.textContent))
      .toBe("Författare utan tillgängliga verk")
    expect(emptyDocument.querySelector(".page_content h2, table.contenttable"), variant)
      .toBeNull()
    expect(emptyDocument.querySelector(".portrait_container img, .ext_links"), variant).toBeNull()
    expect(emptyDocument.querySelector(".portrait_container") !== null, variant)
      .toBe(variant === "titlar")
    expect(emptyDocument.title).toBe(
      `Författare utan tillgängliga verk, ${variant === "titlar" ? "Tillgängliga verk" : "Mer"} | Litteraturbanken`
    )
    await expectOnlyWorksRequest(request, "/private-v2/authors/NoWorks/works")
  }
})

test("SSR accepts an RFC3986 author route once without double-encoding links", async ({ request }) => {
  const response = await request.get("/f%C3%B6rfattare/O%27Neil%28A/titlar")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.title).toBe("Pat O'Neil (A), Tillgängliga verk | Litteraturbanken")
  expect(document.querySelector("h1")?.textContent?.trim()).toBe("Pat O'Neil (A)")
  expect(hrefs(document, 'nav[aria-label="Författarsidor"] a')).toEqual([
    "/f%C3%B6rfattare/O%27Neil%28A",
    "/f%C3%B6rfattare/O%27Neil%28A/titlar",
    "/f%C3%B6rfattare/O%27Neil%28A/dramawebben",
    "/s%C3%B6k?forfattare=O%27Neil%28A&avancerad"
  ])
  expect(document.querySelector(".title a")?.getAttribute("href"))
    .toBe("/f%C3%B6rfattare/O%27Neil%28A/titlar/TestTitle/sida/1/etext?om-boken")
  expect(document.documentElement.outerHTML).not.toContain("%2527")
  expect(document.documentElement.outerHTML).not.toContain("%2528")
  await expectOnlyWorksRequest(request, "/private-v2/authors/O'Neil(A/works")
})

test("SSR returns a local non-leaking 404 for an unknown author", async ({ request }) => {
  const response = await request.get("/författare/Ok%C3%A4nd/titlar")
  expect(response.status()).toBe(404)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.querySelector(".error")).not.toBeNull()
  expect(document.querySelector(".error code")?.textContent).toBe("Okänd")
  expect(document.querySelector('nav[aria-label="Huvudnavigation"]')).not.toBeNull()
  expect(document.querySelector("h1, .page_content")).toBeNull()
  expect(html).not.toContain("Resource not found")
  expect(html).not.toContain('"code":"not_found"')
  expect(html).not.toContain("/semer")
  await expectOnlyWorksRequest(request, "/private-v2/authors/Ok%C3%A4nd/works")
})

test("SSR maps an Author Works provider failure to a non-leaking 503", async ({ request }) => {
  await request.put(`${fixture}/_author_works_failures`, {
    data: { StrindbergA: true }
  })

  const response = await request.get("/författare/StrindbergA/mer")
  expect(response.status()).toBe(503)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.querySelector(".error")).not.toBeNull()
  expect(document.querySelector('nav[aria-label="Huvudnavigation"]')).not.toBeNull()
  expect(document.querySelector("h1, .page_content")).toBeNull()
  expect(html).not.toContain("backend_unavailable")
  expect(html).not.toContain("Search backend unavailable")
  expect(html).not.toContain("/semer")
  await expectOnlyWorksRequest(request, "/private-v2/authors/StrindbergA/works")
})

test("SSR rejects malformed Author Works before serializing provider data", async ({ request }) => {
  const response = await request.get("/författare/MalformedA/titlar")
  expect(response.status()).toBe(503)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.querySelector(".error")).not.toBeNull()
  expect(document.querySelector('nav[aria-label="Huvudnavigation"]')).not.toBeNull()
  expect(document.querySelector("h1, .page_content")).toBeNull()
  expect(html).not.toContain('"full_name":42')
  expect(html).not.toContain('\\"full_name\\":42')
  expect(html).not.toContain("Författare utan tillgängliga verk")
  expect(html).not.toContain("/semer")
  await expectOnlyWorksRequest(request, "/private-v2/authors/MalformedA/works")
})

test("SSR rejects a structurally valid response for the wrong author identity", async ({
  request
}) => {
  const response = await request.get("/författare/WrongIdentityA/titlar")
  expect(response.status()).toBe(503)
  const html = await response.text()
  const { document } = parseHTML(html)

  expect(document.querySelector(".error")).not.toBeNull()
  expect(document.querySelector('nav[aria-label="Huvudnavigation"]')).not.toBeNull()
  expect(document.querySelector("h1, .page_content")).toBeNull()
  expect(html).not.toContain("August Strindberg")
  expect(html).not.toContain("Röda rummet")
  expect(html).not.toContain('\\"author_id\\":\\"StrindbergA\\"')
  await expectOnlyWorksRequest(request, "/private-v2/authors/WrongIdentityA/works")
})

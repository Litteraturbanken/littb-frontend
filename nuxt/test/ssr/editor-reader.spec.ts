import { expect, test } from "@playwright/test"
import { parseHTML } from "linkedom"

test("SSR renders editor metadata, OCR, and raw page bounds", async ({ request }) => {
  const apiResponse = await request.get("/api/editor/lb-editor-doktor/1/f")
  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    endPageName: "-1",
    imprintYear: "1905",
    metadataAvailable: true,
    pageName: null
  })

  const response = await request.get("/editor/lb-editor-doktor/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  expect(document.querySelector(".editor-reader .img_area")?.getAttribute("style"))
    .toContain("width:625px")
  expect(document.querySelector(".editor-reader .overlay")?.textContent).toContain("OCR")
  expect(document.querySelector(".editor-reader .overlay")?.getAttribute("style"))
    .toContain("scale(0.25)")
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("2")
  expect(document.querySelector(".reader-context-ssr .editor-imprint-year")?.textContent)
    .toBe(" (1905)")
  expect(document.querySelector(".reader-context-ssr .pages")?.textContent)
    .toBe("av -1")

  expect((await request.get("/editor/lb-editor-doktor/ix/3/f")).status()).toBe(404)
})

test("SSR falls back to count_pages when editor metadata is unavailable", async ({
  request
}) => {
  const apiResponse = await request.get("/api/editor/lb-editor-fallback/1/f")
  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    endPageName: null,
    imprintYear: null,
    metadataAvailable: false,
    pageName: null
  })

  const response = await request.get("/editor/lb-editor-fallback/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-fallback/lb-editor-fallback_3/lb-editor-fallback_3_0002.jpeg"
  )
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("2")
  expect(document.querySelector(".editor-reader .overlay")?.textContent).toContain(
    "SAFE OCR"
  )
  expect(document.querySelector(".editor-reader script")).toBeNull()
  expect(document.querySelector(".editor-reader [onclick]")).toBeNull()
  expect(document.querySelector(".editor-reader .overlay #mainview")?.textContent)
    .toContain("SAFE OCR")
  expect(document.querySelector(".editor-reader .overlay .absolute")).toBeNull()
  expect(document.querySelector(".editor-reader .overlay .pointer-events-auto")).toBeNull()
  expect(document.querySelector(".editor-reader .overlay > [data-size]")?.getAttribute("style"))
    .not.toContain("999999999999")
  expect(document.querySelector(".reader-context-ssr .editor-metadata-controls")).toBeNull()
  expect(document.querySelector('.reader-context-ssr a[rel="next"]')).not.toBeNull()

  expect((await request.get("/editor/lb-editor-fallback/ix/3/f")).status()).toBe(404)
})

test("SSR keeps the facsimile useful when optional OCR is unavailable", async ({
  request
}) => {
  const response = await request.get("/editor/lb-editor-no-ocr/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")).not.toBeNull()
  expect(document.querySelector(".editor-reader .overlay")).toBeNull()
})

test("SSR reports an unavailable editor when both metadata and page count fail", async ({
  request
}) => {
  expect((await request.get("/editor/lb-editor-unavailable/ix/1/f")).status()).toBe(502)
})

test("SSR sanitizes bounded editor e-text before it enters the DTO", async ({ request }) => {
  const response = await request.get("/api/editor/lb-editor-doktor/1/e")
  expect(response.status()).toBe(200)
  const body = await response.json()

  expect(body.html).toContain("EDITORSSIDA 1")
  expect(body.html).toContain('<em class="emphasis">bevarad</em>')
  expect(body.html).not.toMatch(/script|onclick|javascript:/iu)
})

test("SSR fails clearly when the selected editor facsimile asset is missing", async ({
  request
}) => {
  expect((await request.get("/api/editor/lb-editor-missing-image/1/f")).status()).toBe(502)
  expect((await request.get("/editor/lb-editor-missing-image/ix/1/f")).status()).toBe(502)
})

test("SSR derives editor page count from a valid pages array", async ({ request }) => {
  const apiResponse = await request.get("/api/editor/lb-reader-doktor-glas/2/e")
  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    metadataAvailable: true,
    pageCount: 4,
    pageIndex: 2
  })

  const response = await request.get("/editor/lb-reader-doktor-glas/ix/2/e")
  expect(response.status()).toBe(200)
  expect((await response.text())).toContain("DOKTOR")
})

test("SSR derives sparse raw Editor bounds from the largest page index", async ({ request }) => {
  const response = await request.get("/api/editor/lb-editor-sparse/12/f")

  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    pageCount: 58,
    pageIndex: 12,
    nextIndex: 57,
    previousIndex: 2
  })

  expect((await request.get("/api/editor/lb-editor-sparse/13/f")).status()).toBe(404)
})

test("SSR selects the requested representation and derives the close target from raw works", async ({
  request
}) => {
  const response = await request.get("/editor/lb-editor-mixed/ix/4/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-mixed/lb-editor-mixed_3/lb-editor-mixed_3_0005.jpeg"
  )
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("4")
  expect([...document.querySelectorAll('a[href*="/f%C3%B6rfattare/"]')]
    .find(link => link.textContent?.includes("Stäng editor"))?.getAttribute("href")).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  )
})

test("SSR keeps the exact raw query spelling in editor page links", async ({ request }) => {
  const response = await request.get(
    "/editor/lb-editor-doktor/ix/1/f?bare&repeat=%2f&repeat=%2F"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector('a[rel="next"]')?.getAttribute("href")).toBe(
    "/editor/lb-editor-doktor/ix/2/f?bare&repeat=%2f&repeat=%2F"
  )
})

test("SSR exposes bounded Editor contributors, mapped readable bounds, and part navigation", async ({
  request
}) => {
  const apiResponse = await request.get("/api/editor/lb-editor-boye/0/f")

  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    contributors: [
      { authorType: null, id: "BoyeK", name: "Karin Boye", role: null },
      { authorType: "editor", id: "HelgesonP", name: "Paulina Helgeson", role: null }
    ],
    currentPart: null,
    firstReadableIndex: 2,
    lastReadableIndex: 8,
    nextPartIndex: 4,
    previousPartIndex: null,
    searchable: true,
    titlePath: "EttVerkligtJordiskt"
  })

  const response = await request.get("/editor/lb-editor-boye/ix/0/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector(".reader-context-ssr .author")?.textContent)
    .toContain("Karin Boye")
  expect(document.querySelector(".reader-context-ssr .author")?.textContent)
    .toContain("Paulina Helgeson red.")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/2/f"]')
    ?.textContent).toContain("Gå till första sidan")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/4/f"]')
    ?.textContent).toContain("Gå till nästa del")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/0/f?innehall"]')
    ?.textContent).toBe("Innehållsförteckning")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/0/f?om-boken"]')
    ?.textContent).toBe("Mer om boken")
  expect(document.querySelector('.reader-context-ssr a[href="/editor/lb-editor-boye/ix/0/f?fokus"]')
    ?.textContent).toBe("Läsfokus")
  expect(document.querySelector(".reader-context-ssr .reader-work-search-trigger")?.textContent)
    .toBe("Sök i verket")

  expect(document.querySelector(".reader-context-ssr .current_part")).toBeNull()

  const partResponse = await request.get("/editor/lb-editor-boye/ix/4/f")
  expect(partResponse.status()).toBe(200)
  const partDocument = parseHTML(await partResponse.text()).document
  expect(partDocument.querySelector(".reader-context-ssr .current_part .header")?.textContent)
    .toContain("Paulina Helgeson")
  expect(partDocument.querySelector(".reader-context-ssr .current_part .navtitle")?.textContent)
    .toBe("Förord")
})

test("SSR renders a requested Editor source-information dialog", async ({ request }) => {
  const response = await request.get("/editor/lb-editor-doktor/ix/1/f?keep=%2f&om-boken")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const dialog = document.querySelector('.modal.about[role="dialog"]')
  expect(dialog?.textContent).toContain("Doktor Glas. Roman")
  expect(dialog?.querySelector('a[href="/författare/S%C3%B6derbergH"]')?.textContent)
    .toContain("Hjalmar Söderberg")
})

test("SSR restores a serialized Editor search hit and marquee", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?show_search_work&s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent).toContain("Träff 1, sida 5")
  expect(document.querySelector("#w5_1.markee")).not.toBeNull()
  expect(document.querySelector("#w5_2.markee.flip")).not.toBeNull()
})

test("SSR rejects partial Editor contributor and part metadata atomically", async ({ request }) => {
  for (const workId of [
    "lb-editor-malformed-contributor",
    "lb-editor-malformed-part"
  ]) {
    const apiResponse = await request.get(`/api/editor/${workId}/0/f`)
    expect(apiResponse.status()).toBe(200)
    expect(await apiResponse.json()).toMatchObject({
      authorId: null,
      authorName: null,
      closeHref: null,
      contributors: [],
      currentPart: null,
      firstReadableIndex: 0,
      imprintYear: null,
      lastReadableIndex: 8,
      metadataAvailable: false,
      nextPartIndex: null,
      parts: [],
      previousPartIndex: null,
      searchable: false,
      title: null,
      titlePath: null
    })

    const response = await request.get(`/editor/${workId}/ix/0/f`)
    expect(response.status()).toBe(200)
    const document = parseHTML(await response.text()).document
    expect(document.querySelector("title")?.textContent)
      .toBe(`${workId} sida 0 | Litteraturbanken`)
    expect(document.querySelector(".reader-context-ssr .editor-metadata-controls")).toBeNull()
    expect(document.body.textContent).not.toContain("Ett verkligt jordiskt liv. Brev")
    expect(document.body.textContent).not.toContain("2022")
    expect(document.querySelector('a[href*="EttVerkligtJordiskt"]')).toBeNull()
    expect(document.querySelector('.reader-context-ssr a[href$="/ix/4/f"]')).toBeNull()
    expect(document.querySelector('.reader-context-ssr a[rel="next"]')?.getAttribute("href"))
      .toBe(`/editor/${workId}/ix/1/f`)
  }
})

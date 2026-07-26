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
  expect(document.querySelector(".editor-reader .overlay [id]")).toBeNull()
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
    nextIndex: 13,
    previousIndex: 11
  })
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
  expect(document.querySelector('a[href*="/f%C3%B6rfattare/"]')?.getAttribute("href")).toBe(
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

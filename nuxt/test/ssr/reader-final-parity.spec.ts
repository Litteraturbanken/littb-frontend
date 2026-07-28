import { expect, test, type APIRequestContext } from "@playwright/test"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const etextPath = "/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext"
const facsimilePath = "/författare/LagerlöfS/titlar/GostaBerlingsSaga/sida/3/faksimil"
const nyaVagarPath = "/författare/SöderbergH/titlar/NyaVagarReader/sida/-2/etext"

async function resetReader(request: APIRequestContext) {
  await Promise.all([
    request.delete(`${fixture}/_reader_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_html_requests`),
    request.delete(`${fixture}/_reader_ocr_requests`),
    request.delete(`${fixture}/_reader_jpeg_requests`)
  ])
}

async function ocrRequests(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${fixture}/_reader_ocr_requests`)
  return (await response.json() as { requests: string[] }).requests
}

test.beforeEach(async ({ request }) => resetReader(request))

test("canonical faksimil OCR API returns one sanitized optional overlay", async ({
  request
}) => {
  const response = await request.get(
    "/api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/3/faksimil?ocr=1"
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    mediaType: "faksimil",
    ocrOverlay: {
      height: 900,
      html: expect.stringContaining("OCR fixture"),
      width: 625
    }
  })
  expect(await ocrRequests(request)).toEqual([
    "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"
  ])
})

test("searchable facsimile API always returns OCR while non-searchable facsimile skips it", async ({
  request
}) => {
  const ordinary = await request.get(
    "/api/reader/Lagerl%C3%B6fS/GostaBerlingsSaga/3/faksimil"
  )
  expect(ordinary.status()).toBe(200)
  expect(await ordinary.json()).toMatchObject({
    searchable: true,
    ocrOverlay: { html: expect.stringContaining("OCR fixture") }
  })
  expect(await ocrRequests(request)).toEqual([
    "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"
  ])

  await resetReader(request)
  const inert = await request.get(
    "/api/reader/Lagerl%C3%B6fS/UnsearchableFacsimileReader/3/faksimil?ocr=1"
  )
  expect(inert.status()).toBe(200)
  expect(await inert.json()).toMatchObject({ searchable: false, ocrOverlay: null })
  expect(await ocrRequests(request)).toEqual([])
})

test("direct public OCR mode is server rendered without sacrificing the scan", async ({
  request
}) => {
  const response = await request.get(`${facsimilePath}?ocr`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toMatch(/class="reader_main[^"]*\bocr\b/u)
  expect(html).toContain("OCR fixture")
  expect(html).toContain('class="faksimil"')
  expect(await ocrRequests(request)).toEqual([
    "/txt/lb-reader-gosta-berlings-saga/ocr_00001.html"
  ])
})

test("direct Läsfokus mode is represented truthfully in SSR markup", async ({ request }) => {
  const response = await request.get(`${etextPath}?fokus`)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toMatch(/class="reader_main[^"]*\bfocus\b/u)
  expect(html).toContain("Läsfokus")
})

test("eligible Reader SSR exposes the exact Nya vägar authority link", async ({ request }) => {
  const response = await request.get(nyaVagarPath)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).toContain(
    'href="https://litteraturbanken.se/diktensmuseum/nya-vagar-inledning/"'
  )
  expect(html).toContain('alt="Logotyp för Nya vägar"')
})

test("ordinary Reader SSR has no empty Nya vägar handoff", async ({ request }) => {
  const response = await request.get(etextPath)
  expect(response.status()).toBe(200)
  const html = await response.text()

  expect(html).not.toContain("nya-vagar-inledning")
  expect(html).not.toContain("Logotyp för Nya vägar")
})

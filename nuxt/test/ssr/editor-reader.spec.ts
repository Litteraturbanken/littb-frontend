import { expect, test, type APIRequestContext } from "@playwright/test"
import { parseHTML } from "linkedom"

const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`

const snapshotEditorPath = "/editor/lb8345227/ix/4/f?s_query=brev&s_lbworkid=lb8345227"
  + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2"
const expiredSnapshotMessage = "Sökresultatet har gått ut. Starta om sökningen för att använda den aktuella textsamlingen."

test("snapshot Editor SSR pins requests and next links", async ({ request }) => {
  await request.delete(`${fixture}/_reader_hit_requests`)
  const response = await request.get(`${snapshotEditorPath}&s_snapshot=gen-0123456789abcdef`)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent).toContain("Träff 1, sida 5")
  expect(new URL(document.querySelector('#search_nav a[rel="next"]')!.getAttribute("href")!, "https://example.test").searchParams.get("s_snapshot"))
    .toBe("gen-0123456789abcdef")
  const ledger = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(ledger.requests.map((item: { query: string }) => new URLSearchParams(item.query).get("snapshot")))
    .toEqual(["gen-0123456789abcdef"])
})

test("snapshot Editor SSR distinguishes expiry from response mismatch", async ({ request }) => {
  for (const snapshot of ["gen-expired", "gen-mismatch"]) {
    const response = await request.get(`${snapshotEditorPath}&s_snapshot=${snapshot}`)
    const { document } = parseHTML(await response.text())
    expect(document.querySelector("#search_nav")?.textContent).toContain(snapshot === "gen-expired"
      ? expiredSnapshotMessage : "Sökträffen kunde inte hämtas.")
    expect(document.querySelector(".editor-reader .markee")).toBeNull()
  }
})

test("snapshot Editor rejects malformed serialized generation without an unpinned request", async ({ request }) => {
  for (const suffix of ["&s_snapshot", "&s_snapshot=", "&s_snapshot=gen.tmp", "&s_snapshot=gen/x", "&s_snapshot=a&s_snapshot=b"]) {
    await request.delete(`${fixture}/_reader_hit_requests`)
    const response = await request.get(`${snapshotEditorPath}${suffix}`)
    const { document } = parseHTML(await response.text())
    expect(document.querySelector("#search_nav")).toBeNull()
    expect((await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests).toEqual([])
  }
})

test("snapshot Editor uncached mismatch keeps the active hit and reports integrity failure", async ({ page }) => {
  await page.goto(`${snapshotEditorPath}&s_snapshot=gen-0123456789abcdef`, { waitUntil: "networkidle" })
  const navigation = page.locator("#search_nav")
  await expect(navigation).toContainText("Träff 1, sida 5")
  await page.route("**/api/v2/works/*/search-hits?**", async route => {
    const response = await route.fetch()
    await route.fulfill({ json: { ...await response.json(), snapshot: "gen-other" } })
  })
  await navigation.getByRole("button", { name: "Gå till sista träffen" }).click()
  await expect(navigation).toContainText("Sökträffen kunde inte hämtas.")
  await expect(navigation).toContainText("Träff 1, sida 5")
  await expect(navigation).not.toContainText(expiredSnapshotMessage)
  await expect(page.locator("#w5_1.markee")).toHaveCount(1)
  expect(new URL(page.url()).searchParams.get("s_snapshot")).toBe("gen-0123456789abcdef")
  expect(new URL(page.url()).searchParams.get("hit_index")).toBe("0")
})

test("snapshot Editor restart bypasses old unpinned cache and ignores a held obsolete 409", async ({ page, request }) => {
  await page.goto(snapshotEditorPath, { waitUntil: "networkidle" })
  const navigation = page.locator("#search_nav")
  await expect(navigation).toContainText("Träff 1, sida 5")
  const navigate = async (snapshot: string) => {
    await page.evaluate(path => {
      history.pushState({}, "", path)
      dispatchEvent(new PopStateEvent("popstate"))
    }, `${snapshotEditorPath}&s_snapshot=${snapshot}`)
  }
  await navigate("gen-expired-continuation")
  await expect.poll(async () => {
    const ledger = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    return ledger.requests.some((item: { query: string }) => item.query.includes("snapshot=gen-expired-continuation"))
  }).toBe(true)
  await expect(navigation.locator('a[rel="next"]')).toHaveAttribute("href", /s_snapshot=gen-expired-continuation/)
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const state = { started: false, release }
    Object.assign(window, { snapshotGate: state })
    window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init)
      const url = new URL(input instanceof Request ? input.url : String(input), location.href)
      if (url.pathname.endsWith("/search-hits") && url.searchParams.get("offset") === "235") {
        const buffered = new Response(await response.text(), { status: response.status, headers: response.headers })
        if (buffered.status !== 409) throw new Error("Expected a held expired response")
        state.started = true
        await gate
        return buffered
      }
      return response
    }
  })
  await navigation.getByRole("button", { name: "Gå till sista träffen" }).click()
  await page.waitForFunction(() => (window as unknown as { snapshotGate: { started: boolean } }).snapshotGate.started)
  await navigate("gen-expired")
  await expect(navigation).toContainText(expiredSnapshotMessage)
  await request.delete(`${fixture}/_reader_hit_requests`)
  await navigation.getByRole("button", { name: "Starta om sökningen", exact: true }).click()
  await expect(navigation).not.toContainText(expiredSnapshotMessage)
  await expect(navigation).toContainText("Träff 1, sida 5")
  const ledger = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(ledger.requests.filter((item: { query: string }) => {
    const query = new URLSearchParams(item.query)
    return !query.has("snapshot") && query.get("limit") === "1"
  })).toHaveLength(1)
  await page.evaluate(async () => {
    (window as unknown as { snapshotGate: { release: () => void } }).snapshotGate.release()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await expect(navigation).not.toContainText(expiredSnapshotMessage)
  expect(new URL(page.url()).searchParams.get("s_snapshot")).toBe("gen-fixture-0001")
})

for (const continuation of [false, true]) {
  test(`snapshot Editor ${continuation ? "continuation" : "initial"} expiry restarts explicitly`, async ({ page, request }) => {
    await request.delete(`${fixture}/_reader_hit_requests`)
    const snapshot = continuation ? "gen-expired-continuation" : "gen-expired"
    await page.goto(`${snapshotEditorPath}&s_snapshot=${snapshot}&s_prefix=true&s_suffix=true`, { waitUntil: "networkidle" })
    const navigation = page.locator("#search_nav")
    if (continuation) {
      await expect(navigation).toContainText("Träff 1, sida 5")
      await navigation.getByRole("button", { name: "Gå till sista träffen" }).click()
    }
    await expect(navigation).toContainText(expiredSnapshotMessage)
    expect(new URL(page.url()).searchParams.get("hit_index")).toBe("0")
    const before = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    expect(before.requests.every((item: { query: string }) => new URLSearchParams(item.query).get("snapshot") === snapshot)).toBe(true)
    await navigation.getByRole("button", { name: "Starta om sökningen", exact: true }).click()
    await expect(navigation).not.toContainText(expiredSnapshotMessage)
    await expect(navigation).toContainText("Träff 1, sida 5")
    expect(new URL(page.url()).searchParams.get("s_snapshot")).toBe("gen-fixture-0001")
    await navigation.getByRole("link", { name: "Nästa sökträff" }).click()
    await expect(navigation).toContainText("Träff 2, sida 6")
    const ledger = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    const queries = ledger.requests.map((item: { query: string }) => new URLSearchParams(item.query)) as URLSearchParams[]
    expect(Object.fromEntries(queries.find(item => !item.has("snapshot"))!))
      .toMatchObject({ query: "brev", media_type: "faksimil", offset: "0", limit: "1", word_forms: "false", include_older_spellings: "true", prefix: "true", suffix: "true" })
    expect(queries.at(-1)!.get("snapshot")).toBe("gen-fixture-0001")
  })
}

async function resetEditorRequests(request: APIRequestContext): Promise<void> {
  await Promise.all([
    request.delete(`${fixture}/_editor_manifest_requests`),
    request.delete(`${fixture}/_editor_facsimile_requests`),
    request.delete(`${fixture}/_reader_manifest_requests`),
    request.delete(`${fixture}/_reader_metadata_requests`),
    request.delete(`${fixture}/_reader_requests`)
  ])
}

async function requestLedger(
  request: APIRequestContext,
  path: string
): Promise<string[]> {
  const response = await request.get(`${fixture}${path}`)
  return (await response.json() as { requests: string[] }).requests
}

async function editorFacsimileRequests(
  request: APIRequestContext
): Promise<Array<{ method: string, path: string }>> {
  const response = await request.get(`${fixture}/_editor_facsimile_requests`)
  return (await response.json() as {
    requests: Array<{ method: string, path: string }>
  }).requests
}

test.beforeEach(async ({ request }) => resetEditorRequests(request))
test.afterEach(async ({ request }) => {
  expect(await requestLedger(request, "/_reader_manifest_requests")).toEqual([])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])
  expect((await requestLedger(request, "/_reader_requests")).some(path => (
    path.includes("get_work_info") || path.includes("count_pages")
  ))).toBe(false)
})

test("SSR and the Editor API reject the same malformed route identities", async ({ request }) => {
  for (const path of [
    "/editor/%20/ix/1/f",
    `/editor/${"a".repeat(101)}/ix/1/f`,
    "/editor/lb-editor-doktor/ix/10000000/f",
    "/editor/lb-editor-doktor/ix/01/f"
  ]) {
    expect((await request.get(path)).status()).toBe(404)
    expect((await request.get(path.replace("/editor/", "/nuxt-api/editor/").replace("/ix", ""))).status())
      .toBe(404)
  }
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([])
})

for (const [partition, path] of [
  ["path", "/v2/works/%20/editor-manifest?media_type=faksimil"],
  ["query", "/v2/works/lb-editor-fallback/editor-manifest?media_type=pdf"]
] as const) {
  test(`the Editor fixture ledgers one invalid ${partition} request before its 422 response`, async ({
    request
  }) => {
    const response = await request.get(`${fixture}${path}`)

    expect(response.status()).toBe(422)
    expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([path])
  })
}

test("SSR renders editor metadata, OCR, and generated page bounds", async ({ request }) => {
  const apiResponse = await request.get("/nuxt-api/editor/lb-editor-doktor/1/f")
  expect(apiResponse.status()).toBe(200)
  expect(apiResponse.headers()["cache-control"]).toBe("no-store")
  expect(await apiResponse.json()).toMatchObject({
    endPageName: "-1",
    facsimileSources: [
      {
        size: 2,
        url: "/txt/lb-editor-doktor/lb-editor-doktor_2/lb-editor-doktor_2_0002.jpeg",
        width: 450
      },
      {
        size: 3,
        url: "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg",
        width: 625
      },
      {
        size: 4,
        url: "/txt/lb-editor-doktor/lb-editor-doktor_4/lb-editor-doktor_4_0002.jpeg",
        width: 900
      },
      {
        size: 5,
        url: "/txt/lb-editor-doktor/lb-editor-doktor_5/lb-editor-doktor_5_0002.jpeg",
        width: 1250
      }
    ],
    imageUrl: "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg",
    imageWidth: 625,
    imprintYear: "1905",
    metadataAvailable: true,
    pageName: "-2"
  })
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])
  expect((await requestLedger(request, "/_reader_requests")).some(path => (
    path.includes("get_work_info") || path.includes("count_pages")
  ))).toBe(false)

  await resetEditorRequests(request)

  const response = await request.get("/editor/lb-editor-doktor/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("srcset")).toBe(
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg 1x, "
    + "/txt/lb-editor-doktor/lb-editor-doktor_5/lb-editor-doktor_5_0002.jpeg 2x"
  )
  expect(document.querySelector(".editor-reader .img_area")?.getAttribute("style"))
    .toContain("width:625px")
  const overlay = document.querySelector(".editor-reader .overlay")
  expect(overlay?.localName).toBe("div")
  expect(overlay?.innerHTML).toBe(
    '<div data-size="2500x3600"><span class="w">OCR</span></div>'
  )
  expect(overlay?.getAttribute("style"))
    .toContain("scale(0.25)")
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("2")
  expect(document.querySelector(".reader-context-ssr .editor-imprint-year")?.textContent)
    .toBe(" (1905)")
  expect(document.querySelector(".reader-context-ssr .pages")?.textContent)
    .toBe("-2 av -1")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  expect((await request.get("/editor/lb-editor-doktor/ix/3/f")).status()).toBe(404)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ))
})

test("SSR renders typed bounds-only navigation without metadata controls", async ({
  request
}) => {
  const apiResponse = await request.get("/nuxt-api/editor/lb-editor-fallback/1/f")
  expect(apiResponse.status()).toBe(200)
  expect(apiResponse.headers()["cache-control"]).toBe("no-store")
  expect(await apiResponse.json()).toMatchObject({
    endPageName: null,
    facsimileSources: [{
      size: 3,
      url: "/txt/lb-editor-fallback/lb-editor-fallback_3/" +
        "lb-editor-fallback_3_0002.jpeg",
      width: null
    }],
    imageUrl: "/txt/lb-editor-fallback/lb-editor-fallback_3/" +
      "lb-editor-fallback_3_0002.jpeg",
    imageWidth: null,
    imprintYear: null,
    metadataAvailable: false,
    pageCount: 3,
    pageIndexes: null,
    pageName: null
  })
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  await resetEditorRequests(request)

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
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  expect((await request.get("/editor/lb-editor-fallback/ix/3/f")).status()).toBe(404)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-fallback/editor-manifest?media_type=faksimil"
  ))
})

test("SSR keeps the facsimile useful when optional OCR is unavailable", async ({
  request
}) => {
  const response = await request.get("/editor/lb-editor-no-ocr/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")).not.toBeNull()
  expect(document.querySelector(".editor-reader .overlay")).toBeNull()
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-no-ocr/editor-manifest?media_type=faksimil"
  ])
})

test("SSR reports an unavailable editor when both metadata and page count fail", async ({
  request
}) => {
  expect((await request.get("/editor/lb-editor-unavailable/ix/1/f")).status()).toBe(502)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-unavailable/editor-manifest?media_type=faksimil"
  ])
})

test("SSR contains an empty 200 Editor manifest as the existing source 502", async ({
  request
}) => {
  const response = await request.get("/nuxt-api/editor/lb-editor-empty-manifest/0/f")

  expect(response.status()).toBe(502)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-empty-manifest/editor-manifest?media_type=faksimil"
  ])
})

test("SSR renders a complete Editor manifest without contributors", async ({ request }) => {
  const apiResponse = await request.get("/nuxt-api/editor/lb-editor-no-contributors/1/f")

  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    authorId: null,
    authorName: null,
    closeHref: null,
    contributors: [],
    imageUrl: "/txt/lb-editor-no-contributors/lb-editor-no-contributors_3/" +
      "lb-editor-no-contributors_3_0002.jpeg",
    metadataAvailable: true,
    pageName: "-2",
    title: "Doktor Glas",
    titlePath: "DoktorGlas"
  })

  const response = await request.get("/editor/lb-editor-no-contributors/ix/1/f")
  expect(response.status()).toBe(200)
  const document = parseHTML(await response.text()).document
  expect(document.querySelector("title")?.textContent)
    .toBe("Doktor Glas sida 1 | Litteraturbanken")
  expect(document.querySelector(".reader-context-ssr .editor-metadata-controls")?.textContent)
    .toContain("Doktor Glas")
  expect(document.querySelector(".reader-context-ssr .editor-metadata-controls .author")?.textContent)
    .toBe("")
  expect(document.querySelector('.reader-context-ssr a[href*="/f%C3%B6rfattare/"]')).toBeNull()
  expect(document.querySelector('a[href*="forfattare="]')).toBeNull()
  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src"))
    .toBe("/txt/lb-editor-no-contributors/lb-editor-no-contributors_3/" +
      "lb-editor-no-contributors_3_0002.jpeg")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-no-contributors/editor-manifest?media_type=faksimil"
  ))
})

test("SSR sanitizes bounded editor e-text before it enters the DTO", async ({ request }) => {
  const response = await request.get("/nuxt-api/editor/lb-editor-doktor-glas/1/e")
  expect(response.status()).toBe(200)
  const body = await response.json()

  expect(body.html).toContain("EDITORSSIDA 1")
  expect(body.html).toContain('<em class="emphasis">bevarad</em>')
  expect(body.html).not.toMatch(/script|onclick|javascript:/iu)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor-glas/editor-manifest?media_type=etext"
  ])
})

test("SSR fails clearly when the selected editor facsimile asset is missing", async ({
  request
}) => {
  expect((await request.get("/nuxt-api/editor/lb-editor-missing-image/1/f")).status()).toBe(502)
  expect((await request.get("/editor/lb-editor-missing-image/ix/1/f")).status()).toBe(502)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-missing-image/editor-manifest?media_type=faksimil"
  ))
})

test("complete Editor manifests use an available size when size 3 is absent", async ({
  request
}) => {
  const imageUrl = "/txt/lb-editor-size-four/lb-editor-size-four_4/" +
    "lb-editor-size-four_4_0002.jpeg"
  const apiResponse = await request.get("/nuxt-api/editor/lb-editor-size-four/1/f")

  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    facsimileSources: [{ size: 4, url: imageUrl, width: 900 }],
    imageUrl,
    imageWidth: 900
  })
  expect(await editorFacsimileRequests(request)).toEqual([{
    method: "HEAD",
    path: imageUrl
  }])

  await resetEditorRequests(request)

  const response = await request.get("/editor/lb-editor-size-four/ix/1/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src"))
    .toBe(imageUrl)
  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("srcset"))
    .toBeNull()
  expect(document.querySelector(".editor-reader .img_area")?.getAttribute("style"))
    .toContain("width:900px")
  expect(await editorFacsimileRequests(request)).toEqual([{
    method: "HEAD",
    path: imageUrl
  }])
})

test("SSR uses generated dense bounds for the exact e-text representation", async ({ request }) => {
  const apiResponse = await request.get("/nuxt-api/editor/lb-editor-doktor-glas/2/e")
  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    metadataAvailable: true,
    pageCount: 3,
    pageIndex: 2
  })

  const response = await request.get("/editor/lb-editor-doktor-glas/ix/2/e")
  expect(response.status()).toBe(200)
  expect((await response.text())).toContain("EDITORSSIDA 2")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-doktor-glas/editor-manifest?media_type=etext"
  ))
})

test("SSR derives sparse typed Editor bounds from the largest page index", async ({ request }) => {
  const response = await request.get("/nuxt-api/editor/lb-editor-sparse/12/f")

  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    pageCount: 58,
    pageIndex: 12,
    pageIndexes: [2, 12, 57],
    nextIndex: 57,
    previousIndex: 2
  })
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-sparse/editor-manifest?media_type=faksimil"
  ])
  expect(await requestLedger(request, "/_reader_metadata_requests")).toEqual([])

  expect((await request.get("/nuxt-api/editor/lb-editor-sparse/13/f")).status()).toBe(404)
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(2).fill(
    "/v2/works/lb-editor-sparse/editor-manifest?media_type=faksimil"
  ))
})

test("SSR selects the requested representation and uses its typed close target", async ({
  request
}) => {
  const response = await request.get("/editor/lb-editor-mixed/ix/4/f")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())

  expect(document.querySelector(".editor-reader .faksimil")?.getAttribute("src")).toBe(
    "/txt/lb-editor-mixed/lb-editor-mixed_4/lb-editor-mixed_4_0005.jpeg"
  )
  expect(document.querySelector('input[aria-label="Gå till sida"]')?.getAttribute("max"))
    .toBe("4")
  expect([...document.querySelectorAll('a[href*="/f%C3%B6rfattare/"]')]
    .find(link => link.textContent?.includes("Stäng editor"))?.getAttribute("href")).toBe(
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  )
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-mixed/editor-manifest?media_type=faksimil"
  ])
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
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
})

test("SSR exposes bounded Editor contributors, mapped readable bounds, and part navigation", async ({
  request
}) => {
  const apiResponse = await request.get("/nuxt-api/editor/lb-editor-boye/0/f")

  expect(apiResponse.status()).toBe(200)
  expect(await apiResponse.json()).toMatchObject({
    contributors: [
      { author_id: "BoyeK", author_type: null, full_name: "Karin Boye", role: null },
      {
        author_id: "HelgesonP",
        author_type: "editor",
        full_name: "Paulina Helgeson",
        role: null
      }
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
    .toBe("Karin Boye & Paulina Helgeson red.")
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
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual(Array(3).fill(
    "/v2/works/lb-editor-boye/editor-manifest?media_type=faksimil"
  ))
})

test("SSR renders a requested Editor source-information dialog", async ({ request }) => {
  const response = await request.get("/editor/lb-editor-doktor/ix/1/f?keep=%2f&om-boken")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const dialog = document.querySelector('.modal.about[role="dialog"]')
  expect(dialog?.textContent).toContain("Doktor Glas. Roman")
  expect(dialog?.querySelector('a[href="/f%C3%B6rfattare/S%C3%B6derbergH"]')?.textContent)
    .toContain("Hjalmar Söderberg")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-doktor/editor-manifest?media_type=faksimil"
  ])
})

test("SSR renders a requested Editor contents dialog", async ({ request }) => {
  const response = await request.get("/editor/lb-editor-boye/ix/4/f?keep=%2f&innehall")
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const dialog = document.querySelector('.modal.chapters[role="dialog"]')
  expect(dialog?.textContent).toContain("Innehållsförteckning")
  expect(dialog?.querySelector('a[href="/editor/lb-editor-boye/ix/4/f?keep=%2f"]')?.textContent)
    .toContain("Förord")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-boye/editor-manifest?media_type=faksimil"
  ])
})

test("SSR restores a serialized Editor search hit and marquee", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?show_search_work&s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  const navigation = document.querySelector("#search_nav")
  expect(navigation?.textContent).toContain("Träff 1, sida 5")
  expect(document.querySelector("#w5_1.markee")).not.toBeNull()
  expect(document.querySelector("#w5_2.markee.flip")).not.toBeNull()
  expect([...navigation?.querySelectorAll("a") ?? []].some(link => (
    link.getAttribute("href") === ""
  ))).toBe(false)
  expect(navigation?.querySelector('a[href="/editor/lb8345227/ix/4/f"]')?.textContent)
    .toBe("Stäng träffvisningen")
  expect(navigation?.textContent).not.toContain("Gå direkt till träff")
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb8345227/editor-manifest?media_type=faksimil"
  ])
})

test("SSR rejects serialized Editor markers that do not match the fetched hit", async ({
  request
}) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_9&traffslut=w5_9"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent)
    .toContain("Sökträffen kunde inte hämtas.")
  expect(document.querySelector(".editor-reader .markee")).toBeNull()
})

test("SSR rejects an Editor hit serialized for a different page", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/5/f?s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent)
    .toContain("Sökträffen kunde inte hämtas.")
  expect(document.querySelector(".editor-reader .markee")).toBeNull()
})

test("SSR preserves the exact nested search-return URL", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2" +
    "&s_return=%2Fs%25C3%25B6k%3Ffras%3Da%252Bb%26keep%3D%252f%26keep%3D%252F"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav a[href^='/s']")?.getAttribute("href"))
    .toBe("/s%C3%B6k?fras=a%2Bb&keep=%2f&keep=%2F")
})

test("SSR restores a live-style bare prefix Editor search session", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?keep=%2f&keep=%2F&show_search_work&s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_prefix&s_word_form_only" +
    "&s_include_modernized&hit_index=0&traff=w5_1&traffslut=w5_2#prefix-session"
  )
  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent).toContain("357 sökträffar")
  expect(document.querySelector("#w5_1.markee")).not.toBeNull()
  expect(document.querySelector('#search_nav a[rel="next"]')?.getAttribute("href")).toBe(
    "/editor/lb8345227/ix/5/f?keep=%2f&keep=%2F&show_search_work" +
      "&s_query=brev&s_lbworkid=lb8345227&s_mediatype=faksimil" +
      "&s_word_form_only=true&s_include_modernized=true&s_snapshot=gen-fixture-0001&s_prefix=true" +
      "&hit_index=1&traff=w6_1&traffslut=w6_1"
  )
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb8345227/editor-manifest?media_type=faksimil"
  ])
})

test("SSR accepts the last Editor hit reachable through the bounded API offset", async ({
  request
}) => {
  await request.delete(`${fixture}/_reader_hit_requests`)
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?s_query=editor-max-direct" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=1000001&traff=w5_1&traffslut=w5_1"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent)
    .toContain("Träff 1000002, sida 5")
  const requests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(requests.requests).toEqual([
    expect.objectContaining({
      query: expect.stringContaining(
        "query=editor-max-direct&offset=1000000&limit=3"
      )
    })
  ])
})

for (const invalidResponse of [
  {
    query: "incomplete-window",
    workId: "lb8345227",
    mediaType: "faksimil",
    route: "/editor/lb8345227/ix/4/f",
    range: "w5_1"
  },
  {
    query: "editor-etext-page-mismatch",
    workId: "lb-editor-doktor-glas",
    mediaType: "etext",
    route: "/editor/lb-editor-doktor-glas/ix/1/e",
    range: "w2_1"
  },
  {
    query: "editor-sparse-gap",
    workId: "lb-editor-sparse",
    mediaType: "faksimil",
    route: "/editor/lb-editor-sparse/ix/12/f",
    range: "w14_1"
  }
] as const) {
  test(`SSR rejects an Editor ${invalidResponse.query} hit response`, async ({ request }) => {
    const response = await request.get(
      `${invalidResponse.route}?s_query=${invalidResponse.query}` +
      `&s_lbworkid=${invalidResponse.workId}&s_mediatype=${invalidResponse.mediaType}` +
      "&s_word_form_only=true&s_include_modernized=true&hit_index=0" +
      `&traff=${invalidResponse.range}&traffslut=${invalidResponse.range}`
    )

    expect(response.status()).toBe(200)
    const { document } = parseHTML(await response.text())
    expect(document.querySelector("#search_nav")?.textContent)
      .toContain("Sökträffen kunde inte hämtas.")
  })
}

test("SSR accepts an Editor facsimile word prefix independent of its page index", async ({ request }) => {
  const response = await request.get(
    "/editor/lb8345227/ix/4/f?s_query=editor-leading-zero-page" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil" +
    "&s_word_form_only=true&s_include_modernized=true&hit_index=0" +
    "&traff=w05_1&traffslut=w05_1"
  )

  expect(response.status()).toBe(200)
  const { document } = parseHTML(await response.text())
  expect(document.querySelector("#search_nav")?.textContent).toContain("Träff 1, sida 5")
  expect(document.querySelector("#search_nav")?.textContent)
    .not.toContain("Sökträffen kunde inte hämtas.")
})

test("SSR rejects partial Editor contributor and part metadata atomically", async ({ request }) => {
  for (const workId of [
    "lb-editor-malformed-contributor",
    "lb-editor-malformed-part"
  ]) {
    const apiResponse = await request.get(`/nuxt-api/editor/${workId}/0/f`)
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
  expect(await requestLedger(request, "/_editor_manifest_requests")).toEqual([
    "/v2/works/lb-editor-malformed-contributor/editor-manifest?media_type=faksimil",
    "/v2/works/lb-editor-malformed-contributor/editor-manifest?media_type=faksimil",
    "/v2/works/lb-editor-malformed-part/editor-manifest?media_type=faksimil",
    "/v2/works/lb-editor-malformed-part/editor-manifest?media_type=faksimil"
  ])
})

test("source-quality Editor SSR accepts only markerless unavailable selection", async ({ request }) => {
  const base = "/editor/lb8345227/ix/4/f?s_query=source-quality-mixed&s_lbworkid=lb8345227"
    + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=1"
    + "&s_snapshot=gen-source-quality-0001"
  const response = await request.get(base)
  const { document } = parseHTML(await response.text())
  const navigation = document.querySelector("#search_nav")

  expect(navigation?.textContent).toContain("Träff 2")
  expect(navigation?.textContent).not.toContain("sida 5")
  expect(navigation?.textContent).toContain("Träffen kan inte öppnas exakt i läsaren.")
  expect(document.querySelector(".markee")).toBeNull()
  const nextHref = navigation?.querySelector('a[rel="next"]')?.getAttribute("href")
  expect(nextHref).toBeTruthy()
  const next = new URL(nextHref ?? "", "https://example.test")
  expect(next.pathname).toBe("/editor/lb8345227/ix/6/f")
  expect(next.searchParams.get("hit_index")).toBe("2")
  expect(next.searchParams.get("traff")).toBe("w7_1")
  expect(next.searchParams.get("traffslut")).toBe("w7_1")

  const stale = await request.get(`${base}&traff=w5_1&traffslut=w5_1`)
  expect(parseHTML(await stale.text()).document.querySelector("#search_nav")?.textContent)
    .toContain("Sökträffen kunde inte hämtas.")
})

for (const [label, markers, exposesError] of [
  ["exact markerless", "", true],
  ["lone marker", "&traff=w5_1", false],
  ["empty marker", "&traff=&traffslut=w5_1", false],
  ["duplicate marker", "&traff=w5_1&traff=w5_1&traffslut=w5_1", false],
]) {
  test(`source-quality Editor rejects ${label} route state`, async ({ request }) => {
  const base = "/editor/lb8345227/ix/4/f?s_query=source-quality-mixed&s_lbworkid=lb8345227"
    + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0"
    + "&s_snapshot=gen-source-quality-0001"
  const response = await request.get(`${base}${markers}`)
  const { document } = parseHTML(await response.text())
  expect(response.status()).toBe(200)
  if (exposesError) {
    expect(document.querySelector("#search_nav")?.textContent)
      .toContain("Sökträffen kunde inte hämtas.")
  } else {
    expect(document.querySelector("#search_nav")).toBeNull()
  }
  expect(document.querySelector(".markee")).toBeNull()
  })
}

test("source-quality Editor browser traversal keeps ix for unavailable then marks exact", async ({ page }) => {
  const start = "/editor/lb8345227/ix/4/f?s_query=source-quality-mixed&s_lbworkid=lb8345227"
    + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0"
    + "&traff=w5_1&traffslut=w5_1"
  await page.goto(start, { waitUntil: "networkidle" })
  await expect(page.locator(".markee")).toHaveCount(1)
  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator("#search_nav")).toContainText("Träff 2")
  await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")
  expect(new URL(page.url()).pathname).toBe("/editor/lb8345227/ix/4/f")
  expect(new URL(page.url()).searchParams.has("traff")).toBe(false)
  expect(new URL(page.url()).searchParams.has("traffslut")).toBe(false)
  await expect(page.locator(".markee")).toHaveCount(0)
  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator("#search_nav")).toContainText("Träff 3, sida 7")
  expect(new URL(page.url()).pathname).toBe("/editor/lb8345227/ix/6/f")
  await expect(page.locator(".markee")).toHaveCount(1)
})

test("source-quality Editor submits a first unavailable occurrence through its search controls", async ({ page }) => {
  const editorPath = "/editor/lb8345227/ix/4/f"
  await page.goto(editorPath, { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Sök i verket" }).click()
  await page.locator('input[aria-label="Sök i verket"]:visible').fill("source-quality-first-unavailable")
  await page.getByRole("button", { name: "Sök", exact: true }).click()

  await expect(page.locator("#search_nav")).toContainText("Träff 1")
  await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")
  expect(new URL(page.url()).pathname).toBe(editorPath)
  expect(new URL(page.url()).searchParams.get("s_query")).toBe("source-quality-first-unavailable")
  expect(new URL(page.url()).searchParams.get("hit_index")).toBe("0")
  expect(new URL(page.url()).searchParams.get("s_snapshot")).toBe("gen-fixture-0001")
  expect(new URL(page.url()).searchParams.has("traff")).toBe(false)
  await expect(page.locator(".markee")).toHaveCount(0)
})

test("source-quality Editor go-to fetches an uncached unavailable hit with its pinned snapshot", async ({
  page,
  request
}) => {
  const start = "/editor/lb8345227/ix/4/f?s_query=source-quality-uncached&s_lbworkid=lb8345227"
    + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0"
    + "&traff=w5_1&traffslut=w5_1"
  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(start, { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Gå direkt till träff . . ." }).click()
  await page.getByLabel("Träffnummer").fill("5")
  await page.getByLabel("Träffnummer").press("Enter")

  await expect(page.locator("#search_nav")).toContainText("Träff 5")
  await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")
  expect(new URL(page.url()).pathname).toBe("/editor/lb8345227/ix/4/f")
  expect(new URL(page.url()).searchParams.get("hit_index")).toBe("4")
  expect(new URL(page.url()).searchParams.has("traff")).toBe(false)
  await expect(page.locator(".markee")).toHaveCount(0)
  await expect.poll(async () => {
    const ledger = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    return ledger.requests.some((item: { query: string }) => {
      const query = new URLSearchParams(item.query)
      return query.get("query") === "source-quality-uncached" &&
        query.get("offset") === "3" && query.get("limit") === "3" &&
        query.get("snapshot") === "gen-fixture-0001"
    })
  }).toBe(true)
})

test("source-quality Editor keeps an unavailable selection through reload, history, and cached previous", async ({
  page
}) => {
  const start = "/editor/lb8345227/ix/4/f?s_query=source-quality-mixed&s_lbworkid=lb8345227"
    + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0"
    + "&traff=w5_1&traffslut=w5_1"
  await page.goto(start, { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page.locator(".markee")).toHaveCount(0)
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("#search_nav")).toContainText("Träff 2")
  await expect(page.locator(".markee")).toHaveCount(0)
  await page.goBack({ waitUntil: "networkidle" })
  await expect(page.locator(".markee")).toHaveCount(1)
  await page.goForward({ waitUntil: "networkidle" })
  await expect(page.locator(".markee")).toHaveCount(0)
  await page.getByRole("link", { name: "Föregående sökträff" }).click()
  await expect(page.locator("#search_nav")).toContainText("Träff 1, sida 5")
  await expect(page.locator(".markee")).toHaveCount(1)
})

for (const staleStatus of [200, 409]) {
  test(`source-quality Editor ignores a held obsolete ${staleStatus} after selection and search changes`, async ({
    page
  }) => {
    const start = "/editor/lb8345227/ix/4/f?s_query=source-quality-uncached&s_lbworkid=lb8345227"
      + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0"
      + "&traff=w5_1&traffslut=w5_1"
    await page.goto(start, { waitUntil: "networkidle" })
    await page.evaluate(status => {
      const nativeFetch = window.fetch.bind(window)
      let release!: () => void
      const gate = new Promise<void>(resolve => { release = resolve })
      const state = { started: false, release }
      Object.assign(window, { sourceQualityGate: state })
      window.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href)
        if (url.pathname.endsWith("/search-hits") &&
          url.searchParams.get("query") === "source-quality-uncached" &&
          url.searchParams.get("offset") === "3") {
          const response = await nativeFetch(input, init)
          state.started = true
          await gate
          if (status === 409) {
            return new Response(JSON.stringify({
              error: {
                code: "snapshot_unavailable",
                message: "Search snapshot unavailable",
                details: null
              },
              request_id: "fa781be9-6f29-4696-9aee-2bd75f2b32cb"
            }), { status: 409, headers: { "content-type": "application/json",
              "X-Request-ID": "fa781be9-6f29-4696-9aee-2bd75f2b32cb" } })
          }
          return response
        }
        return nativeFetch(input, init)
      }
    }, staleStatus)
    await page.getByRole("button", { name: "Gå direkt till träff . . ." }).click()
    await page.getByLabel("Träffnummer").fill("5")
    await page.getByLabel("Träffnummer").press("Enter")
    await page.waitForFunction(() => (
      window as unknown as { sourceQualityGate: { started: boolean } }
    ).sourceQualityGate.started)

    await page.getByRole("link", { name: "Nästa sökträff" }).click()
    await expect(page.locator("#search_nav")).toContainText("Träff 2")
    await expect(page.locator(".markee")).toHaveCount(0)
    await page.evaluate(path => {
      history.pushState({}, "", path)
      dispatchEvent(new PopStateEvent("popstate"))
    }, "/editor/lb8345227/ix/4/f?s_query=source-quality-first-unavailable&s_lbworkid=lb8345227"
      + "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true&hit_index=0")
    await expect(page.locator("#search_nav")).toContainText("Träff 1")
    await expect(page.locator("#search_nav")).toContainText("Träffen kan inte öppnas exakt i läsaren.")

    await page.evaluate(async () => {
      ;(window as unknown as { sourceQualityGate: { release: () => void } }).sourceQualityGate.release()
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await expect(page.locator("#search_nav")).toContainText("Träff 1")
    expect(new URL(page.url()).searchParams.get("s_query")).toBe("source-quality-first-unavailable")
    await expect(page.locator(".markee")).toHaveCount(0)
  })
}

import { expect, test } from "@playwright/test"

const editorFaksimil = "/editor/lb-editor-doktor/ix/1/f"
const editorEtext = "/editor/lb-editor-doktor-glas/ix/1/e"
const fixture = `http://127.0.0.1:${process.env.LBAPI_FIXTURE_PORT || 4100}`
const editorSearchHit = "/editor/lb8345227/ix/4/f?show_search_work&s_query=brev" +
  "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
  "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2"

async function navigateClient(page: import("@playwright/test").Page, path: string): Promise<void> {
  await page.evaluate(async target => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router: { push: (value: string) => Promise<void> } } } }
    }
    const router = root.__vue_app__?.config.globalProperties.$router
    if (!router) throw new Error("Nuxt client router is unavailable")
    try {
      await router.push(target)
    } catch {
      // Route validation reports the expected 404 by rejecting this navigation.
    }
  }, path)
}

test("editor Reader resolves compact media aliases with legacy asset URLs and raw-index navigation", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await expect(page.locator(".editor-reader")).toBeVisible()
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src",
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/editor/lb-editor-doktor/ix/2/f"
  )
  await expect(page.getByRole("link", { name: "Stäng editor" })).toHaveAttribute(
    "href",
    "/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext"
  )
  await expect(page.getByRole("link", { name: "Hjalmar Söderberg" })).toHaveAttribute(
    "href", "/f%C3%B6rfattare/S%C3%B6derbergH"
  )
  await expect(page.getByRole("link", { name: "Sök i författarens texter" }))
    .toHaveAttribute("href", "/s%C3%B6k?avancerad&forfattare=S%C3%B6derbergH")

  await page.getByRole("link", { name: "Nästa sida" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src",
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0003.jpeg"
  )
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f$/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src",
    "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )

  await page.goto(editorEtext, { waitUntil: "networkidle" })
  await expect(page.locator(".editor-reader .etext")).toContainText("EDITORSSIDA 1")
  await expect(page.locator(".editor-reader .etext em.emphasis")).toHaveText("bevarad")
  expect(await page.evaluate(() => "editorInjected" in globalThis)).toBe(false)
  await expect(page.locator(".editor-reader .etext script, .editor-reader .etext [onclick]")).toHaveCount(0)

  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Stäng editor" }).click()
  await expect(page).toHaveURL(/\/f%C3%B6rfattare\/S%C3%B6derbergH\/titlar\/DoktorGlas\/sida\/-2\/etext$/u)
  await expect(page.locator(".reader_main .etext")).toContainText("DOKTOR GLAS")
  await expect(page.locator(".reader-primary-error")).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f$/u)
})

test("editor Reader restores multipart contributor context and mapped navigation history", async ({
  page
}) => {
  await page.goto("/editor/lb-editor-boye/ix/0/f", { waitUntil: "networkidle" })

  const context = page.locator("#toolkit-right .editor-reader-context")
  await expect(context.getByRole("link", { name: "Karin Boye" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/BoyeK")
  await expect(context.getByRole("link", { name: "Paulina Helgeson (red.)" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/HelgesonP")
  await expect(context.locator(".current_part .navtitle")).toHaveCount(0)
  await expect(context.getByRole("link", { name: "Gå till första sidan" }))
    .toHaveAttribute("href", "/editor/lb-editor-boye/ix/2/f")
  await expect(context.getByRole("link", { name: "Gå till nästa del" }))
    .toHaveAttribute("href", "/editor/lb-editor-boye/ix/4/f")
  await expect(context.getByText("Gå bakåt en del", { exact: true }))
    .toHaveAttribute("aria-disabled", "true")

  await context.getByRole("link", { name: "Gå till nästa del" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-boye\/ix\/4\/f$/u)
  await expect(context.locator(".current_part .header").getByRole("link", {
    name: "Paulina Helgeson"
  })).toHaveAttribute("href", "/f%C3%B6rfattare/HelgesonP")
  await expect(context.locator(".current_part .navtitle")).toHaveText("Förord")
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-boye\/ix\/0\/f$/u)
  await expect(context.locator(".current_part .navtitle")).toHaveCount(0)
})

test("editor Reader restores contents and source dialogs with focus return", async ({ page }) => {
  await page.goto("/editor/lb-editor-boye/ix/4/f?keep=%2f&keep=%2F", {
    waitUntil: "networkidle"
  })

  const contentsTrigger = page.getByRole("link", { name: "Innehållsförteckning" })
  await contentsTrigger.click()
  await expect(page).toHaveURL(/\?keep=%2f&keep=%2F&innehall$/u)
  const contents = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expect(contents).toBeVisible()
  await expect(contents.getByRole("link", { name: "Förord" }))
    .toHaveAttribute("href", "/editor/lb-editor-boye/ix/4/f?keep=%2f&keep=%2F")
  await contents.getByRole("button", { name: "Stäng" }).click()
  await expect(contents).toHaveCount(0)
  await expect(contentsTrigger).toBeFocused()

  await page.goto(`${editorFaksimil}?keep=%2f&keep=%2F`, { waitUntil: "networkidle" })
  const sourceTrigger = page.getByRole("link", { name: "Mer om boken" })
  await sourceTrigger.click()
  await expect(page).toHaveURL(/\?keep=%2f&keep=%2F&om-boken$/u)
  const source = page.getByRole("dialog", { name: "Om boken" })
  await expect(source).toContainText("Doktor Glas. Roman")
  await expect(source.getByRole("link", { name: "Hjalmar Söderberg" }))
    .toHaveAttribute("href", "/f%C3%B6rfattare/S%C3%B6derbergH")
  await page.keyboard.press("Escape")
  await expect(source).toHaveCount(0)
  await expect(sourceTrigger).toBeFocused()

  await sourceTrigger.click()
  await expect(source).toBeVisible()
  await source.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } })
  await expect(source).toHaveCount(0)
  await expect(sourceTrigger).toBeFocused()
})

test("editor Reader hydrates a directly requested contents dialog once", async ({ page }) => {
  await page.goto("/editor/lb-editor-boye/ix/4/f?keep=%2f&innehall", {
    waitUntil: "networkidle"
  })

  const contents = page.getByRole("dialog", { name: "Innehållsförteckning" })
  await expect(contents).toHaveCount(1)
  await expect(contents).toBeVisible()
  await contents.getByRole("button", { name: "Stäng" }).click()
  await expect(contents).toHaveCount(0)
})

test("editor contents links keep modified clicks native and select normally", async ({ page }) => {
  const initial = "/editor/lb-editor-boye/ix/4/f?bare&keep=%2f&keep=%2F&innehall#part"
  await page.goto(initial, { waitUntil: "networkidle" })
  const hydratedInitial = "/editor/lb-editor-boye/ix/4/f" +
    "?bare&keep=/&keep=/&innehall#part"
  const dialog = page.getByRole("dialog", { name: "Innehållsförteckning" })
  const link = dialog.getByRole("link", { name: "Kronologi" })
  await expect(link).toHaveAttribute(
    "href",
    "/editor/lb-editor-boye/ix/8/f?bare&keep=%2f&keep=%2F#part"
  )
  const historyLength = await page.evaluate(() => window.history.length)

  for (const init of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { button: 1 }
  ]) {
    const nativeAllowed = await link.evaluate((anchor, eventInit) => {
      let defaultPreventedByComponent: boolean | null = null
      const blockNativeNavigation = (event: MouseEvent) => {
        defaultPreventedByComponent = event.defaultPrevented
        event.preventDefault()
      }
      anchor.addEventListener("click", blockNativeNavigation, { once: true })
      anchor.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...eventInit
      }))
      return defaultPreventedByComponent === false
    }, init)
    expect(nativeAllowed).toBe(true)
    await expect(dialog).toBeVisible()
    expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
      .toBe(hydratedInitial)
  }

  expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
  await link.click()
  await expect(page).toHaveURL(
    "/editor/lb-editor-boye/ix/8/f?bare&keep=%2f&keep=%2F#part"
  )
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength + 1)
})

test("editor Reader restores focus mode through raw-preserving router history", async ({ page }) => {
  const initial = `${editorFaksimil}?bare&repeat=%2f&repeat=%2F#focus-marker`
  await page.goto(initial, { waitUntil: "networkidle" })

  await page.getByRole("link", { name: "Läsfokus" }).click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe(`${editorFaksimil}?bare&repeat=%2f&repeat=%2F&fokus#focus-marker`)
  await expect(page.getByRole("toolbar", { name: "Läsfokus" })).toBeVisible()
  await expect(page.locator(".editor-reader .reader_main")).toHaveClass(/\bfocus\b/u)
  const toolbar = page.getByRole("toolbar", { name: "Läsfokus" })
  await page.getByRole("button", { name: "Dölj verktygsfält" }).click()
  await expect(toolbar).toBeHidden()
  await page.getByRole("button", { name: "Visa verktygsfält" }).click()
  await expect(toolbar).toBeVisible()
  await page.getByRole("button", { name: "Stäng Läsfokus" }).click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe(initial)
})

test("editor Reader work search restores reloadable hit state, marquee, and history", async ({
  page,
  request
}) => {
  await request.delete(`${fixture}/_reader_hit_requests`)
  const initial = "/editor/lb8345227/ix/4/f?keep=%2f&keep=%2F"
  await page.goto(initial, { waitUntil: "networkidle" })

  const trigger = page.getByRole("button", { name: "Sök i verket", exact: true })
  await trigger.click()
  const input = page.getByRole("searchbox", { name: "Sök i verket" })
  await expect(input).toBeFocused()
  await input.fill("brev")
  await page.getByRole("button", { name: "Sök", exact: true }).click()

  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/4\/f.*s_query=brev/u)
  const submitted = new URL(page.url())
  expect(Object.fromEntries(submitted.searchParams)).toMatchObject({
    s_query: "brev",
    s_lbworkid: "lb8345227",
    s_mediatype: "faksimil",
    s_word_form_only: "true",
    s_include_modernized: "true",
    hit_index: "0",
    traff: "w5_1",
    traffslut: "w5_2"
  })
  expect(submitted.searchParams.has("show_search_work")).toBe(true)
  expect(submitted.searchParams.getAll("keep")).toEqual(["/", "/"])
  const hitNavigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
  await expect(hitNavigation).toContainText("237 sökträffar")
  await expect(hitNavigation).toContainText("Träff 1, sida 5")
  await expect(page.locator("#w5_1.markee")).toHaveCount(1)
  await expect(page.locator("#w5_2.markee.flip")).toHaveCount(1)

  await hitNavigation.getByRole("link", { name: "Nästa sökträff" }).click()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/5\/f.*hit_index=1/u)
  await expect(page.locator("#w6_1.markee")).toHaveCount(1)
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("searchbox", { name: "Sök i verket" })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/4\/f.*hit_index=0/u)
  await expect(page.locator("#w5_1.markee")).toHaveCount(1)
  await page.goForward()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/5\/f.*hit_index=1/u)
  await expect(page.locator("#w6_1.markee")).toHaveCount(1)
  await page.goBack()
  await expect(page.locator("#w5_1.markee")).toHaveCount(1)

  await page.reload({ waitUntil: "networkidle" })
  await expect(hitNavigation).toContainText("Träff 1, sida 5")
  await expect(page.locator("#w5_1.markee")).toHaveCount(1)
  await hitNavigation.getByRole("button", { name: "Gå till sista träffen" }).click()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/6\/f.*hit_index=236/u)
  await expect(page.locator("#w7_1.markee")).toHaveCount(1)

  await hitNavigation.getByRole("button", { name: "Gå direkt till träff" }).click()
  const gotoHit = hitNavigation.getByRole("textbox", { name: "Träffnummer" })
  await gotoHit.fill("2")
  await gotoHit.press("Enter")
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/5\/f.*hit_index=1/u)
  await expect(page.locator("#w6_1.markee")).toHaveCount(1)

  const requests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(requests.requests).toEqual(expect.arrayContaining([
    expect.objectContaining({
      path: "/v2/works/lb8345227/search-hits",
      query: expect.stringContaining("media_type=faksimil&query=brev")
    })
  ]))

  await hitNavigation.getByRole("link", { name: "Stäng träffvisningen" }).click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search)
    .toBe("/editor/lb8345227/ix/5/f?keep=%2f&keep=%2F")
  await expect(page.locator(".editor-reader .markee")).toHaveCount(0)
  await expect(hitNavigation).toHaveCount(0)
})

test("editor Reader search navigation exposes native local controls", async ({ page }) => {
  const initial = `${editorSearchHit}&keep=%2f&keep=%2F`
  await page.goto(initial, { waitUntil: "networkidle" })

  const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
  const first = navigation.getByRole("button", { name: "Gå till första träffen" })
  const last = navigation.getByRole("button", { name: "Gå till sista träffen" })
  const direct = navigation.getByRole("button", { name: "Gå direkt till träff" })
  await expect(first).toBeVisible()
  await expect(last).toBeVisible()
  await expect(direct).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Gå till sista träffen" })).toHaveCount(0)

  await last.focus()
  await page.keyboard.press("Space")
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/6\/f.*hit_index=236/u)
  let search = new URL(page.url()).searchParams
  expect(search.get("s_query")).toBe("brev")
  expect(search.getAll("keep")).toEqual(["/", "/"])

  await direct.click()
  let gotoHit = navigation.getByRole("textbox", { name: "Träffnummer" })
  await expect(gotoHit).toBeFocused()
  await gotoHit.fill("2")
  await gotoHit.press("Enter")
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/5\/f.*hit_index=1/u)

  await direct.click()
  gotoHit = navigation.getByRole("textbox", { name: "Träffnummer" })
  await gotoHit.fill("1")
  await navigation.getByRole("button", { name: "Gå till träff", exact: true }).click()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/4\/f.*hit_index=0/u)
  search = new URL(page.url()).searchParams
  expect(search.get("s_query")).toBe("brev")
  expect(search.getAll("keep")).toEqual(["/", "/"])

  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/5\/f.*hit_index=1/u)
  await expect(navigation).toContainText("Träff 2, sida 6")
})

for (const state of ["loading", "failed"] as const) {
  test(`editor Reader hides local search commands while the current hit is ${state}`, async ({
    page,
    request
  }) => {
    if (state === "loading") {
      await request.put(`${fixture}/_reader_hit_delays`, { data: {
        "lb8345227|brev|0|3|false|true|false|false": 2_000
      } })
      await page.goto("/editor/lb8345227/ix/4/f", { waitUntil: "networkidle" })
      try {
        await page.evaluate(target => {
          const root = document.querySelector("#__nuxt") as HTMLElement & {
            __vue_app__?: { config: { globalProperties: {
              $router: { push: (value: string) => Promise<void> }
            } } }
          }
          void root.__vue_app__?.config.globalProperties.$router.push(target)
        }, editorSearchHit)
        const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
        await expect(page.locator(".spinner_search")).toHaveClass(/\bsearching\b/u)
        await expect(navigation.getByRole("button", {
          name: "Gå till första träffen"
        })).toHaveCount(0)
        await expect(navigation.getByRole("button", {
          name: "Gå till sista träffen"
        })).toHaveCount(0)
        await expect(navigation.getByRole("button", {
          name: "Gå direkt till träff . . ."
        })).toHaveCount(0)
        await expect(navigation.getByRole("link", { name: "Stäng träffvisningen" }))
          .toHaveAttribute("href", "/editor/lb8345227/ix/4/f")
      } finally {
        await request.delete(`${fixture}/_reader_hit_delays`)
      }
      return
    }

    await request.put(`${fixture}/_reader_hit_failure`)
    try {
      await page.goto(editorSearchHit, { waitUntil: "networkidle" })
      const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
      await expect(navigation).toContainText("Sökträffen kunde inte hämtas.")
      await expect(navigation.getByRole("button", {
        name: "Gå till första träffen"
      })).toHaveCount(0)
      await expect(navigation.getByRole("button", {
        name: "Gå till sista träffen"
      })).toHaveCount(0)
      await expect(navigation.getByRole("button", {
        name: "Gå direkt till träff . . ."
      })).toHaveCount(0)
      await expect(navigation.getByRole("link", { name: "Stäng träffvisningen" }))
        .toHaveAttribute("href", "/editor/lb8345227/ix/4/f")
    } finally {
      await request.delete(`${fixture}/_reader_hit_failure`)
    }
  })
}

test("editor Reader keeps a serialized work-search panel open while its page changes", async ({
  page
}) => {
  let releasePageRequest = () => {}
  let notePageRequest = () => {}
  const pageRequestStarted = new Promise<void>(resolve => {
    notePageRequest = resolve
  })
  const pageRequestReleased = new Promise<void>(resolve => {
    releasePageRequest = resolve
  })
  await page.route("**/api/editor/lb8345227/5/f", async route => {
    notePageRequest()
    await pageRequestReleased
    await route.continue()
  })
  await page.goto(editorSearchHit, { waitUntil: "networkidle" })
  const input = page.getByRole("searchbox", { name: "Sök i verket" })
  await expect(input).toBeVisible()

  try {
    await page.getByRole("navigation", { name: "Sökträffsnavigering" })
      .getByRole("link", { name: "Nästa sökträff" }).click()
    await pageRequestStarted
    await expect(input).toBeVisible()
  } finally {
    releasePageRequest()
  }
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/5\/f/u)
  await expect(input).toBeVisible()
})

test("editor Reader does not push history for the already-active search hit", async ({ page }) => {
  await page.goto(editorSearchHit, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    const state = window as typeof window & { __editorHitPushes?: number }
    const push = history.pushState.bind(history)
    state.__editorHitPushes = 0
    history.pushState = (...args) => {
      state.__editorHitPushes! += 1
      return push(...args)
    }
  })

  await page.getByRole("navigation", { name: "Sökträffsnavigering" })
    .getByRole("button", { name: "Gå till första träffen", exact: true }).click()
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))

  expect(await page.evaluate(() => (
    window as typeof window & { __editorHitPushes?: number }
  ).__editorHitPushes)).toBe(0)
  await expect(page).toHaveURL(editorSearchHit)
})

test("editor Reader aborts a superseded direct-hit lookup", async ({ page, request }) => {
  await request.delete(`${fixture}/_reader_hit_requests`)
  const slowKey = "lb8345227|brev|235|3|false|true|false|false"
  await request.put(`${fixture}/_reader_hit_delays`, { data: { [slowKey]: 600 } })
  try {
    await page.goto(editorSearchHit, { waitUntil: "networkidle" })
    await request.delete(`${fixture}/_reader_hit_requests`)
    await page.evaluate(() => {
      const scope = window as typeof window & { __editorDirectHitAbortSeen?: boolean }
      scope.__editorDirectHitAbortSeen = false
      const originalFetch = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const request = input instanceof Request ? input : null
        const url = request?.url ?? String(input)
        const signal = request?.signal ?? init?.signal
        if (url.includes("/search-hits") && url.includes("offset=235")) {
          signal?.addEventListener("abort", () => {
            scope.__editorDirectHitAbortSeen = true
          }, { once: true })
        }
        return originalFetch(input, init)
      }
    })
    const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
    await navigation.getByRole("button", { name: "Gå till sista träffen", exact: true }).click()
    await expect.poll(async () => (
      await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    ).requests.some((hit: { query: string }) => hit.query.includes("offset=235&limit=3")))
      .toBe(true)

    await navigation.getByRole("button", { name: "Gå till första träffen", exact: true }).click()
    await expect.poll(() => page.evaluate(() => (
      window as typeof window & { __editorDirectHitAbortSeen?: boolean }
    ).__editorDirectHitAbortSeen)).toBe(true)
    await expect(page).toHaveURL(editorSearchHit)

    await page.evaluate(() => {
      ;(window as typeof window & { __editorDirectHitAbortSeen?: boolean })
        .__editorDirectHitAbortSeen = false
    })
    await navigation.getByRole("button", { name: "Gå till sista träffen", exact: true }).click()
    await expect.poll(async () => (
      await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    ).requests.filter((hit: { query: string }) => hit.query.includes("offset=235&limit=3"))
    ).toHaveLength(2)
    const closeAbortedSynchronously = await navigation.evaluate(element => {
      const close = [...element.querySelectorAll<HTMLAnchorElement>("a")]
        .find(link => link.textContent?.trim() === "Stäng träffvisningen")!
      close.click()
      return (window as typeof window & { __editorDirectHitAbortSeen?: boolean })
        .__editorDirectHitAbortSeen
    })
    expect(closeAbortedSynchronously).toBe(true)
    await expect(page).toHaveURL("/editor/lb8345227/ix/4/f")
  } finally {
    await request.delete(`${fixture}/_reader_hit_delays`)
  }
})

test("editor Reader rejects a mismatched submitted-search envelope", async ({ page }) => {
  const initial = "/editor/lb8345227/ix/4/f"
  await page.goto(initial, { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Sök i verket", exact: true }).click()
  await page.getByRole("searchbox", { name: "Sök i verket" })
    .fill("mismatched-submit-envelope")
  await page.getByRole("button", { name: "Sök", exact: true }).click()

  await expect(page.getByRole("status")).toHaveText("Sökningen kunde inte genomföras.")
  await expect(page).toHaveURL(initial)
  await expect(page.getByRole("navigation", { name: "Sökträffsnavigering" })).toHaveCount(0)
})

test("editor Reader keeps direct hit lookup inside the maximum API offset", async ({
  page,
  request
}) => {
  const state = "s_query=editor-max-direct&s_lbworkid=lb8345227" +
    "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true" +
    "&hit_index=999999&traff=w5_1&traffslut=w5_1"
  await page.goto(`/editor/lb8345227/ix/4/f?${state}`, { waitUntil: "networkidle" })
  const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
  await expect(navigation).toContainText("Träff 1000000, sida 5")
  await request.delete(`${fixture}/_reader_hit_requests`)

  await navigation.getByRole("button", { name: "Gå direkt till träff" }).click()
  const input = navigation.getByRole("textbox", { name: "Träffnummer" })
  await input.fill("1000002")
  await input.press("Enter")

  await expect(page).toHaveURL(/hit_index=1000001/u)
  await expect(navigation).toContainText("Träff 1000002, sida 5")
  const requests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(requests.requests).toEqual(expect.arrayContaining([
    expect.objectContaining({
      query: expect.stringContaining(
        "query=editor-max-direct&offset=1000000&limit=3"
      )
    })
  ]))
})

test("editor Reader restores live-style bare prefix flags across hydration and reload", async ({
  page,
  request
}) => {
  await request.delete(`${fixture}/_reader_hit_requests`)
  const prefixUrl = "/editor/lb8345227/ix/4/f?keep=%2f&keep=%2F&show_search_work" +
    "&s_query=brev&s_lbworkid=lb8345227&s_mediatype=faksimil&s_prefix" +
    "&s_word_form_only&s_include_modernized&hit_index=0&traff=w5_1&traffslut=w5_2" +
    "#prefix-session"
  await page.goto(prefixUrl, { waitUntil: "networkidle" })

  const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
  await expect(navigation).toContainText("357 sökträffar")
  await expect(navigation).toContainText("Träff 1, sida 5")
  await expect(page.locator("#w5_1.markee")).toHaveCount(1)
  const next = navigation.getByRole("link", { name: "Nästa sökträff" })
  await expect(next).toHaveAttribute(
    "href",
    "/editor/lb8345227/ix/5/f?keep=%2f&keep=%2F&show_search_work" +
      "&s_query=brev&s_lbworkid=lb8345227&s_mediatype=faksimil" +
      "&s_word_form_only=true&s_include_modernized=true&s_prefix=true" +
      "&hit_index=1&traff=w6_1&traffslut=w6_1#prefix-session"
  )
  expect(await next.evaluate(link => {
    let preventedByComponent = true
    link.addEventListener("click", event => {
      preventedByComponent = event.defaultPrevented
      event.preventDefault()
    }, { once: true })
    link.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true
    }))
    return preventedByComponent
  })).toBe(false)
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/4\/f.*hit_index=0.*#prefix-session/u)
  await next.click()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/5\/f.*hit_index=1.*#prefix-session/u)
  await expect(page.locator("#w6_1.markee")).toHaveCount(1)
  await expect(navigation.getByRole("link", { name: "Föregående sökträff" })).toHaveAttribute(
    "href",
    "/editor/lb8345227/ix/4/f?keep=%2f&keep=%2F&show_search_work" +
      "&s_query=brev&s_lbworkid=lb8345227&s_mediatype=faksimil" +
      "&s_word_form_only=true&s_include_modernized=true&s_prefix=true" +
      "&hit_index=0&traff=w5_1&traffslut=w5_2#prefix-session"
  )
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb8345227\/ix\/4\/f.*hit_index=0.*#prefix-session/u)

  await page.reload({ waitUntil: "networkidle" })
  await expect(navigation).toContainText("357 sökträffar")
  await expect(page.locator("#w5_1.markee")).toHaveCount(1)
  const requests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(requests.requests).toEqual(expect.arrayContaining([
    expect.objectContaining({
      path: "/v2/works/lb8345227/search-hits",
      query: "media_type=faksimil&query=brev&offset=0&limit=3" +
        "&word_forms=false&include_older_spellings=true&prefix=true&suffix=false"
    })
  ]))
})

test("editor Reader treats omitted word-form-only as legacy lemma and rejects ambiguous flags", async ({
  page,
  request
}) => {
  const base = "/editor/lb8345227/ix/4/f?s_query=brev&s_lbworkid=lb8345227" +
    "&s_mediatype=faksimil&s_include_modernized=true" +
    "&hit_index=0&traff=w5_1&traffslut=w5_2"
  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(base, { waitUntil: "networkidle" })
  await expect(page.getByRole("navigation", { name: "Sökträffsnavigering" }))
    .toContainText("237 sökträffar")
  const lemmaRequests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(lemmaRequests.requests).toEqual([
    expect.objectContaining({ query: expect.stringContaining("word_forms=true") })
  ])

  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(`${base}&s_word_form_only&s_suffix`, { waitUntil: "networkidle" })
  const bareSuffixRequests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(bareSuffixRequests.requests).toEqual([
    expect.objectContaining({
      query: "media_type=faksimil&query=brev&offset=0&limit=3" +
        "&word_forms=false&include_older_spellings=true&prefix=false&suffix=true"
    })
  ])

  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(
    `${base}&s_word_form_only=false&s_prefix=false&s_suffix=false`,
    { waitUntil: "networkidle" }
  )
  const explicitFalseRequests = await (await request.get(`${fixture}/_reader_hit_requests`)).json()
  expect(explicitFalseRequests.requests).toEqual([
    expect.objectContaining({
      query: "media_type=faksimil&query=brev&offset=0&limit=3" +
        "&word_forms=true&include_older_spellings=true&prefix=false&suffix=false"
    })
  ])

  for (const invalid of [
    `${base}&s_prefix&s_prefix=false`,
    `${base}&s_suffix=1`,
    `${base}&s_word_form_only=true&s_word_form_only=false`,
    `${base}&s_include_modernized=`
  ]) {
    await request.delete(`${fixture}/_reader_hit_requests`)
    await page.goto(invalid, { waitUntil: "networkidle" })
    await expect(page.getByRole("navigation", { name: "Sökträffsnavigering" })).toHaveCount(0)
    expect((await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests)
      .toEqual([])
  }
})

test("editor Reader search state fails closed on mismatched identity and backend failure", async ({
  page,
  request
}) => {
  const suffix = "&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2"
  await request.delete(`${fixture}/_reader_hit_requests`)
  await page.goto(
    "/editor/lb8345227/ix/4/f?s_query=brev&s_lbworkid=other" + suffix,
    { waitUntil: "networkidle" }
  )
  await expect(page.getByRole("navigation", { name: "Sökträffsnavigering" })).toHaveCount(0)
  await expect(page.locator(".editor-reader .markee")).toHaveCount(0)
  expect((await (await request.get(`${fixture}/_reader_hit_requests`)).json()).requests)
    .toEqual([])

  await request.put(`${fixture}/_reader_hit_failure`)
  try {
    await page.goto(
      "/editor/lb8345227/ix/4/f?s_query=brev&s_lbworkid=lb8345227" + suffix,
      { waitUntil: "networkidle" }
    )
    await expect(page.getByRole("navigation", { name: "Sökträffsnavigering" }))
      .toContainText("Sökträffen kunde inte hämtas.")
    await expect(page.locator(".editor-reader .markee")).toHaveCount(0)
    await expect(page.locator(".editor-reader .faksimil")).toBeVisible()
  } finally {
    await request.delete(`${fixture}/_reader_hit_failure`)
  }
})

test("editor Reader rejects non-string highlight identifiers", async ({ page }) => {
  await page.goto(
    "/editor/lb8345227/ix/4/f?s_query=malformed-highlight-ids" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2",
    { waitUntil: "networkidle" }
  )

  const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
  await expect(navigation).toContainText("Sökträffen kunde inte hämtas.")
  await expect(page.locator(".editor-reader .markee")).toHaveCount(0)
})

test("superseded Editor hit requests cannot surface as current failures", async ({
  page,
  request
}) => {
  await page.goto("/editor/lb8345227/ix/4/f", { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)
  await request.put(`${fixture}/_reader_hit_delays`, { data: {
    "lb8345227|brev|0|3|false|true|false|false": 700,
    "lb8345227|brev|0|3|false|true|true|false": 500
  } })
  const hitUrl = (prefix: boolean) => (
    "/editor/lb8345227/ix/4/f?s_query=brev" +
    "&s_lbworkid=lb8345227&s_mediatype=faksimil&s_word_form_only=true" +
    "&s_include_modernized=true&hit_index=0&traff=w5_1&traffslut=w5_2" +
    (prefix ? "&s_prefix=true" : "")
  )
  try {
    await page.evaluate(url => {
      const nuxt = (window as typeof window & { useNuxtApp?: () => {
        $router: { push: (target: string) => Promise<unknown> }
      } }).useNuxtApp?.()
      void nuxt?.$router.push(url)
    }, hitUrl(false))
    await expect.poll(async () => (
      await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    ).requests.length).toBe(1)

    await page.evaluate(() => {
      const state = window as typeof window & { __editorHitFailureSeen?: boolean }
      state.__editorHitFailureSeen = false
      const navigation = document.querySelector('[aria-label="Sökträffsnavigering"]')
      if (!navigation) throw new Error("Editor hit navigation was not rendered")
      const recordFailure = () => {
        if (navigation.textContent?.includes("Sökträffen kunde inte hämtas.")) {
          state.__editorHitFailureSeen = true
        }
      }
      new MutationObserver(recordFailure).observe(navigation, {
        childList: true,
        characterData: true,
        subtree: true
      })
    })

    await page.evaluate(url => {
      const nuxt = (window as typeof window & { useNuxtApp?: () => {
        $router: { push: (target: string) => Promise<unknown> }
      } }).useNuxtApp?.()
      void nuxt?.$router.push(url)
    }, hitUrl(true))
    await expect.poll(async () => (
      await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    ).requests.length).toBe(2)
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => (
      (window as typeof window & { __editorHitFailureSeen?: boolean }).__editorHitFailureSeen
    ))).toBe(false)

    const navigation = page.getByRole("navigation", { name: "Sökträffsnavigering" })
    await expect(navigation).not.toContainText("Sökträffen kunde inte hämtas.")
    await expect(navigation).toContainText("357 sökträffar")
    await expect(page.locator("#w5_1.markee")).toHaveCount(1)
  } finally {
    await request.delete(`${fixture}/_reader_hit_delays`)
  }
})

for (const action of ["change options", "close the panel"] as const) {
  test(`editor Reader cancels a pending work search when users ${action}`, async ({
    page,
    request
  }) => {
    const initial = "/editor/lb8345227/ix/4/f"
    await page.goto(initial, { waitUntil: "networkidle" })
    await request.delete(`${fixture}/_reader_hit_requests`)
    const slowKey = "lb8345227|brev|0|1|false|true|false|false"
    await request.put(`${fixture}/_reader_hit_delays`, { data: { [slowKey]: 600 } })
    try {
      const trigger = page.getByRole("button", { name: "Sök i verket", exact: true })
      await trigger.click()
      await page.getByRole("searchbox", { name: "Sök i verket" }).fill("brev")
      await page.getByRole("button", { name: "Sök", exact: true }).click()
      await expect.poll(async () => (
        await (await request.get(`${fixture}/_reader_hit_requests`)).json()
      ).requests.length).toBe(1)

      if (action === "change options") {
        await page.getByRole("button", { name: "SÖK EFTER ORDBÖRJAN" }).click()
      } else {
        await trigger.click()
        await expect(page.getByRole("searchbox", { name: "Sök i verket" })).toBeHidden()
      }

      await page.waitForTimeout(700)
      await expect(page).toHaveURL(initial)
      await expect(page.getByRole("navigation", { name: "Sökträffsnavigering" }))
        .toHaveCount(0)
    } finally {
      await request.delete(`${fixture}/_reader_hit_delays`)
    }
  })
}

test("a delayed obsolete Editor hit cannot mark a later raw route", async ({ page, request }) => {
  await page.goto("/editor/lb8345227/ix/4/f", { waitUntil: "networkidle" })
  await request.delete(`${fixture}/_reader_hit_requests`)
  const slowKey = "lb8345227|brev|0|3|false|true|false|false"
  await request.put(`${fixture}/_reader_hit_delays`, { data: { [slowKey]: 350 } })
  try {
    await page.evaluate(() => {
      const nuxt = (window as typeof window & { useNuxtApp?: () => {
        $router: { push: (target: string) => Promise<unknown> }
      } }).useNuxtApp?.()
      void nuxt?.$router.push(
        "/editor/lb8345227/ix/4/f?s_query=brev&s_lbworkid=lb8345227" +
        "&s_mediatype=faksimil&s_word_form_only=true&s_include_modernized=true" +
        "&hit_index=0&traff=w5_1&traffslut=w5_2"
      )
    })
    await expect.poll(async () => (
      await (await request.get(`${fixture}/_reader_hit_requests`)).json()
    ).requests.length).toBe(1)
    await page.evaluate(() => {
      const nuxt = (window as typeof window & { useNuxtApp?: () => {
        $router: { push: (target: string) => Promise<unknown> }
      } }).useNuxtApp?.()
      void nuxt?.$router.push("/editor/lb8345227/ix/6/f")
    })
    await expect(page).toHaveURL("/editor/lb8345227/ix/6/f")
    await page.waitForTimeout(450)
    await expect(page.getByRole("navigation", { name: "Sökträffsnavigering" })).toHaveCount(0)
    await expect(page.locator(".editor-reader .markee")).toHaveCount(0)
  } finally {
    await request.delete(`${fixture}/_reader_hit_delays`)
  }
})

test("editor Reader suppresses non-atomic contributor and part metadata", async ({ page }) => {
  for (const workId of [
    "lb-editor-malformed-contributor",
    "lb-editor-malformed-part"
  ]) {
    await page.goto(`/editor/${workId}/ix/0/f`, { waitUntil: "networkidle" })
    const context = page.locator("#toolkit-right .editor-reader-context")
    await expect(context.locator(".editor-metadata-controls")).toHaveCount(0)
    await expect(context.getByRole("link", { name: "Karin Boye" })).toHaveCount(0)
    await expect(context.getByRole("link", { name: "Paulina Helgeson" })).toHaveCount(0)
    await expect(context.getByRole("link", { name: "Gå till nästa del" })).toHaveCount(0)
    await expect(context.getByText("Gå till nästa del", { exact: true }))
      .toHaveAttribute("aria-disabled", "true")
    await expect(context.getByRole("link", { name: "Nästa sida" }))
      .toHaveAttribute("href", `/editor/${workId}/ix/1/f`)
    await expect(page).toHaveTitle(`${workId} sida 0 | Litteraturbanken`)
    await expect(page.getByRole("link", { name: "Stäng editor" })).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("Ett verkligt jordiskt liv. Brev")
    await expect(page.locator("body")).not.toContainText("2022")
  }
})

test("contextual editor e-text route renders the exact Editor representation", async ({
  page
}) => {
  await page.goto("/editor/lb-editor-doktor-glas/ix/2/e", { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .etext")).toContainText("EDITORSSIDA 2")
  await expect(page.locator(".editor-reader .reader-error")).toHaveCount(0)
})

test("editor Reader rejects unknown aliases and negative raw indexes", async ({ page }) => {
  expect((await page.goto("/editor/lb-editor-doktor/ix/1/etext"))?.status()).toBe(404)
  expect((await page.goto("/editor/lb-editor-doktor/ix/-1/f"))?.status()).toBe(404)
})

test("editor Reader client navigation rejects malformed route identities as 404s", async ({ page }) => {
  for (const path of [
    "/editor/%20/ix/1/f",
    "/editor/lb-editor-doktor/ix/10000000/f"
  ]) {
    await page.goto(editorFaksimil, { waitUntil: "networkidle" })
    await navigateClient(page, path)
    await expect(page).toHaveTitle("Sidan kan inte hittas | Litteraturbanken")
    await expect(page.locator(".editor-reader")).toHaveCount(0)
  }
})

test("editor Reader navigates only actual indices from sparse metadata", async ({ page }) => {
  await page.goto("/editor/lb-editor-sparse/ix/12/f", { waitUntil: "networkidle" })

  await expect(page.getByRole("link", { name: "Föregående sida" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/2/f")
  await expect(page.getByRole("link", { name: "Nästa sida" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/57/f")
  await expect(page.getByRole("link", { name: "Gå till första sidan" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/2/f")
  await expect(page.getByRole("link", { name: "Gå till sista sidan" }))
    .toHaveAttribute("href", "/editor/lb-editor-sparse/ix/57/f")
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toHaveCount(0)
  expect((await page.goto("/editor/lb-editor-sparse/ix/13/f"))?.status()).toBe(404)
})

test("editor Reader first/last controls and raw slider push history", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Gå till första sidan" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)
  await page.getByRole("link", { name: "Gå till sista sidan" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)

  const slider = page.getByRole("slider", { name: "Gå till sida" })
  await expect(slider).toHaveAttribute("min", "0")
  await expect(slider).toHaveAttribute("max", "2")
  await slider.evaluate(input => {
    const range = input as HTMLInputElement
    range.value = "1"
    range.dispatchEvent(new Event("input", { bubbles: true }))
    range.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f$/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)
})

test("editor facsimile size and rotation controls are real accessible controls", async ({
  page
}, testInfo) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  const image = page.locator(".editor-reader .faksimil")
  const smaller = page.getByRole("button", { name: "Mindre" })
  const larger = page.getByRole("button", { name: "Större" })
  const rotateLeft = page.getByRole("button", { name: "Vänster" })

  await expect(smaller).toBeEnabled()
  await expect(larger).toBeEnabled()
  await larger.click()
  await expect(image).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_4/lb-editor-doktor_4_0002.jpeg"
  )
  await expect(image).toHaveCSS("width", "900px")
  if (testInfo.project.name === "mobile-chromium") {
    await expect(rotateLeft).toBeHidden()
  } else {
    await rotateLeft.click()
    await expect(image).toHaveCSS("transform", /matrix\(0, -1, 1, 0, 0, 0\)/u)
  }
})

test("editor renders the sole manifest facsimile size without fabricating controls", async ({
  page,
  request
}) => {
  const imageUrl = "/txt/lb-editor-size-four/lb-editor-size-four_4/" +
    "lb-editor-size-four_4_0002.jpeg"
  await request.delete(`${fixture}/_editor_facsimile_requests`)

  await page.goto("/editor/lb-editor-size-four/ix/1/f", { waitUntil: "networkidle" })

  const image = page.locator(".editor-reader .faksimil")
  await expect(image).toHaveAttribute("src", imageUrl)
  await expect(image).toHaveCSS("width", "900px")
  await expect(page.getByRole("button", { name: "Mindre" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Större" })).toBeDisabled()
  const ledgerResponse = await request.get(`${fixture}/_editor_facsimile_requests`)
  expect(await ledgerResponse.json()).toEqual({
    requests: [
      { method: "HEAD", path: imageUrl },
      { method: "GET", path: imageUrl }
    ]
  })
})

test("editor metadata fallback exposes only honest raw paging controls", async ({ page }) => {
  await page.goto("/editor/lb-editor-fallback/ix/1/f", { waitUntil: "networkidle" })

  await expect(page.locator("#toolkit-right .editor-metadata-controls")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Nästa sida" })).toBeVisible()
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toBeVisible()
  await expect(page.locator("#toolkit-right a:not([href])")).toHaveCount(0)
})

test("editor OCR overlay remains aligned without blocking navigation", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  const image = page.locator(".editor-reader .faksimil")
  const overlay = page.locator(".editor-reader .overlay")
  await expect(overlay).toContainText("OCR")
  await expect.poll(async () => {
    const [imageBox, overlayBox] = await Promise.all([
      image.boundingBox(),
      overlay.boundingBox()
    ])
    if (!imageBox || !overlayBox) return null
    return {
      left: Math.round(overlayBox.x - imageBox.x),
      top: Math.round(overlayBox.y - imageBox.y),
      width: Math.round(overlayBox.width - imageBox.width)
    }
  }).toEqual({ left: 0, top: 0, width: 0 })

  await page.getByRole("link", { name: "Nästa sida" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
})

test("editor OCR query keeps the legacy text-only inspection mode", async ({ page }) => {
  await page.goto(`${editorFaksimil}?ocr`, { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .reader_main")).toHaveClass(/\bocr\b/u)
  await expect(page.locator(".editor-reader .overlay")).toHaveCSS("color", "rgb(0, 0, 0)")
  await expect(page.locator(".editor-reader .faksimil")).toHaveCSS("visibility", "hidden")

  await page.getByRole("link", { name: "Nästa sida" }).click()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f\?ocr$/u)
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/1\/f\?ocr$/u)
})

test("editor OCR query keeps the facsimile visible when no overlay exists", async ({ page }) => {
  await page.goto("/editor/lb-editor-no-ocr/ix/1/f?ocr", { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .overlay")).toHaveCount(0)
  await expect(page.locator(".editor-reader .reader_main")).not.toHaveClass(/\bocr\b/u)
  await expect(page.locator(".editor-reader .faksimil")).toHaveCSS("visibility", "visible")
})

test("editor route errors never leave the preceding page under the new identity", async ({
  page,
  request
}) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await request.put(`${fixture}/_editor_metadata_failure`)
  try {
    await page.getByRole("link", { name: "Nästa sida" }).click()
    await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
    await expect(page.getByRole("alert")).toContainText("Ett fel inträffade")
    await expect(page.locator(".editor-reader .faksimil")).toHaveCount(0)
  } finally {
    await request.delete(`${fixture}/_editor_metadata_failure`)
  }
})

test("editor links preserve raw queries and fragments while Back restores history", async ({
  page
}) => {
  const initial = `${editorFaksimil}?bare&repeat=%2f&repeat=%2F#ocr-marker`
  await page.goto(initial, { waitUntil: "networkidle" })

  await expect(page.getByRole("link", { name: "Nästa sida" })).toHaveAttribute(
    "href",
    "/editor/lb-editor-doktor/ix/2/f?bare&repeat=%2f&repeat=%2F#ocr-marker"
  )
  await page.getByRole("link", { name: "Nästa sida" }).click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe("/editor/lb-editor-doktor/ix/2/f?bare&repeat=%2f&repeat=%2F#ocr-marker")
  await page.goBack()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe(initial)
})

test("editor page links keep question marks inside fragments out of the query", async ({ page }) => {
  const initial = `${editorFaksimil}#note?om-boken`
  await page.goto(initial, { waitUntil: "networkidle" })

  const nextPage = page.getByRole("link", { name: "Nästa sida" })
  await expect(nextPage).toHaveAttribute(
    "href",
    "/editor/lb-editor-doktor/ix/2/f#note?om-boken"
  )
  await nextPage.click()
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
    .toBe("/editor/lb-editor-doktor/ix/2/f#note?om-boken")
  await expect(page.getByRole("dialog", { name: "Om boken" })).toHaveCount(0)
})

test("editor n/f and d/m shortcuts push bounded raw-page history", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.locator("body").press("n")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src", "/txt/lb-editor-doktor/lb-editor-doktor_3/lb-editor-doktor_3_0002.jpeg"
  )
  await page.locator("body").press("f")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)

  await page.goto("/editor/lb-editor-long/ix/12/f", { waitUntil: "networkidle" })
  await page.locator("body").press("d")
  await expect(page).toHaveURL(/\/editor\/lb-editor-long\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page.locator(".editor-reader .faksimil")).toHaveAttribute(
    "src", "/txt/lb-editor-long/lb-editor-long_4/lb-editor-long_4_0013.jpeg"
  )
  await page.locator("body").press("m")
  await expect(page).toHaveURL(/\/editor\/lb-editor-long\/ix\/22\/f$/u)
})

test("editor Left and Right arrows retain Angular boundary and Shift paging", async ({
  page
}) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.locator("body").press("Shift+ArrowRight")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page).toHaveURL(editorFaksimil)
  await expect(page.locator(".editor-reader .faksimil")).toBeVisible()
  await page.locator("body").press("Shift+ArrowLeft")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)

  await page.goto(editorFaksimil, { waitUntil: "networkidle" })
  await page.evaluate(() => window.scrollTo({ left: document.documentElement.scrollWidth }))
  await page.locator("body").press("ArrowRight")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/2\/f$/u)
  await page.goBack()
  await expect(page).toHaveURL(editorFaksimil)
  await expect(page.locator(".editor-reader .faksimil")).toBeVisible()
  await page.evaluate(() => window.scrollTo({ left: 0 }))
  await page.locator("body").press("ArrowLeft")
  await expect(page).toHaveURL(/\/editor\/lb-editor-doktor\/ix\/0\/f$/u)
})

test("editor sidebar and slider reuse the established Reader geometry", async ({ page }) => {
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  await expect(page.locator("main#mainview main.editor-reader")).toHaveCount(0)
  await expect(page.locator("#toolkit-right > .reader-context")).toBeVisible()
  await expect(page.locator("#toolkit-right .rz-bar")).toHaveCount(2)
  await expect(page.locator("#toolkit-right .rz-pointer")).toHaveCount(1)
  await expect(page.getByRole("slider", { name: "Gå till sida" })).toHaveCSS("opacity", "0")
  await expect(page.locator('#toolkit-right a[rel="next"] .navicon')).toBeVisible()
  await expect.poll(async () => {
    const [bar, pointer] = await Promise.all([
      page.locator("#toolkit-right .rz-bar").first().boundingBox(),
      page.locator("#toolkit-right .rz-pointer").boundingBox()
    ])
    if (!bar || !pointer) return null
    return Math.round((pointer.x + pointer.width / 2 - bar.x) / bar.width * 100)
  }).toBe(50)
  await expect(page.locator("#toolkit-right a:not([href])")).toHaveCount(0)
})

test("editor mobile viewport keeps the page and authority sidebar available", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(editorFaksimil, { waitUntil: "networkidle" })

  await expect(page.locator(".editor-reader .reader_main")).toBeVisible()
  await expect(page.locator(".editor-reader .faksimil")).toBeVisible()
  await expect(page.locator("#rightCorridor")).toHaveCSS("display", "inline-block")
  await expect(page.locator("#toolkit-right > .reader-context")).toBeVisible()
})

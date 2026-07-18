import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import {
  lagerlofBibliography,
  soderbergPresentation
} from "../fixtures/author-document-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const audioOrigin = "https://litteraturbanken.se"
const authorExclude = "intro,db_*,doc_type,corpus,es_id,doc_id,doc_type,corpus_id,imported,updated,sources,intro_text,wikidata,dramawebben"
const restrictedPrefixes = ["/api/", "/red/", "/txt/", "/export/", "/query/", "/xhr/", "/ws/"]

const cases = [
  {
    name: "presentation",
    route: "/författare/S%C3%B6derbergH/presentation",
    descriptor: soderbergPresentation,
    bodyFile: "SoderbergH-presentation.html",
    expectedBody: "Hjalmar Söderberg, född 1869"
  },
  {
    name: "bibliografi",
    route: "/författare/Lagerl%C3%B6fS/bibliografi",
    descriptor: lagerlofBibliography,
    bodyFile: "LagerlofS-bibliografi.html",
    expectedBody: "Selma Lagerlöf. Bibliografi"
  }
] as const

function legacyAuthor(documentCase: typeof cases[number]) {
  const value = documentCase.descriptor
  return {
    authorid: value.author_id,
    authorid_norm: value.normalized_author_id,
    full_name: value.full_name,
    surname: value.full_name.split(" ").at(-1),
    birth: value.birth_year ? { plain: value.birth_year } : null,
    death: value.death_year ? { plain: value.death_year } : null,
    intro: value.has_introduction ? "<p>Introduktion finns.</p>" : null,
    intro_author: null,
    sources: [],
    pseudonym: [],
    other_name: [],
    picture: false,
    pictureinfo: null,
    presentation: documentCase.name === "presentation",
    bibliography: documentCase.name === "bibliografi",
    searchable: Boolean(value.search_url),
    external_ref: null,
    wikidata: {},
    dramawebben: value.has_dramawebben ? { intro: null, sources: [] } : null
  }
}

let authorityFonts: Buffer
let ordinaryBackground: Buffer
let dramawebbenBackground: Buffer

test.beforeAll(async () => {
  ;[authorityFonts, ordinaryBackground, dramawebbenBackground] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(resolve(import.meta.dirname, "../../../app/img/forf2_bkg.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_fade_more.jpg"))
  ])
})

for (const documentCase of cases) {
  test(`captures the Angular ${documentCase.name} authority`, async ({ page }, testInfo) => {
    expect(testInfo.project.use.baseURL).toBe(authorityOrigin)
    const profile = legacyAuthor(documentCase)
    const body = await readFile(resolve(
      import.meta.dirname,
      `../fixtures/author-document-content/${documentCase.bodyFile}`
    ))
    const authorRequests: string[] = []
    const authorsRequests: string[] = []
    const workRequests: string[] = []
    const audioRequests: string[] = []
    const mapRequests: string[] = []
    const contentRequests: string[] = []
    const bootstrapRequests: string[] = []
    const backgroundRequests: string[] = []
    const unexpectedRequests: string[] = []
    const productionRequests: string[] = []
    const problems: string[] = []
    const knownAuthorityProblems: string[] = []

    page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        const problem = `console ${message.type()}: ${message.text()}`
        if (message.text().includes("unrecognized expression: a.footnote[href^=#ftn]")) {
          knownAuthorityProblems.push(problem)
        } else {
          problems.push(problem)
        }
      }
    })

    await page.route("**/*", route => {
      const request = route.request()
      const url = new URL(request.url())
      const label = `${request.method()} ${request.url()}`
      const decodedPathname = decodeURIComponent(url.pathname)

      if (request.method() === "GET" && url.origin === authorityOrigin
        && decodedPathname === `/api/get_author/${profile.authorid}` && !url.search) {
        authorRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: profile }) })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/get_authors"
        && url.searchParams.get("exclude") === authorExclude) {
        authorsRequests.push(`${url.pathname}${url.search}`)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && (/^\/api\/list_all\//u.test(url.pathname)
          || url.pathname.startsWith("/api/list_parts_in_others_works/"))) {
        workRequests.push(`${url.pathname}${url.search}`)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/api/query/litteraturkartan") {
        mapRequests.push(`${url.pathname}${url.search}`)
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hits: 0 }) })
      }
      if (request.method() === "GET" && url.origin === audioOrigin
        && url.pathname === "/ljudochbild/wp-json/wp/v2/pages"
        && url.searchParams.get("slug") === profile.authorid_norm.toLowerCase()
        && url.searchParams.get("_fields") === "slug") {
        audioRequests.push(`${url.origin}${url.pathname}${url.search}`)
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ slug: profile.authorid_norm.toLowerCase() }])
        })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === documentCase.descriptor.source_path && !url.search) {
        contentRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml") {
        bootstrapRequests.push(`${url.pathname}${url.search}`)
        return route.fulfill({ status: 200, contentType: "application/xml", body: "<backgrounds />" })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && url.pathname === "/red/css/etext.css" && !url.search) {
        bootstrapRequests.push(url.pathname)
        return route.fulfill({ status: 200, contentType: "text/css", body: "" })
      }
      if (request.method() === "GET" && url.origin === authorityOrigin
        && ["/img/forf2_bkg.jpg", "/img/dramawebben_fade_more.jpg"].includes(url.pathname)
        && !url.search) {
        backgroundRequests.push(url.pathname)
        return route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: url.pathname.includes("dramawebben") ? dramawebbenBackground : ordinaryBackground
        })
      }
      if (request.method() === "GET" && url.hostname === "cloud.typography.com"
        && url.pathname === "/7426274/770508/css/fonts.css") {
        bootstrapRequests.push(`${url.origin}${url.pathname}`)
        return route.fulfill({ status: 200, contentType: "text/css", body: authorityFonts })
      }
      if (request.method() === "GET" && url.hostname === "www.googletagmanager.com"
        && url.pathname === "/gtag/js") {
        bootstrapRequests.push(`${url.origin}${url.pathname}${url.search}`)
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
      }
      if (url.origin !== authorityOrigin) {
        productionRequests.push(label)
        return route.abort("blockedbyclient")
      }
      if (restrictedPrefixes.some(prefix => url.pathname.startsWith(prefix))) {
        unexpectedRequests.push(label)
        return route.abort("blockedbyclient")
      }
      return route.continue()
    })

    const response = await page.goto(documentCase.route, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page.locator("body.focus.page-authorInfo.ready")).toHaveCount(1)
    await expect(page.locator("#mainview > author-info-page > div > h1"))
      .toContainText(documentCase.descriptor.full_name)
    await expect(page.locator(".page_content .content.unbox")).toContainText(documentCase.expectedBody)
    await expect(page.locator("ul.links a")).toHaveText(documentCase.name === "presentation"
      ? ["Introduktion", "Verk", "Ljud", "Sök i texterna"]
      : ["Introduktion", "Verk", "Ljud", "Dramawebben", "Sök i texterna"])
    await expect(page.locator("ul.links li.active")).toHaveCount(0)
    await expect(page.locator(".preloader")).toBeHidden()
    await waitForVisualAssets(page)

    expect(authorRequests).toHaveLength(1)
    expect(authorsRequests).toHaveLength(1)
    expect(workRequests).toHaveLength(10)
    expect(audioRequests).toHaveLength(1)
    expect(mapRequests).toHaveLength(1)
    expect(contentRequests).toEqual([documentCase.descriptor.source_path])
    expect(bootstrapRequests).toHaveLength(4)
    expect(backgroundRequests.sort()).toEqual([
      "/img/dramawebben_fade_more.jpg",
      "/img/forf2_bkg.jpg",
      "/img/forf2_bkg.jpg"
    ].sort())
    expect(unexpectedRequests).toEqual([])
    expect(productionRequests).toEqual([])
    expect(knownAuthorityProblems).toHaveLength(1)
    expect(problems).toEqual([])

    const directory = resolve(import.meta.dirname, "baselines")
    await mkdir(directory, { recursive: true })
    const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
    await page.screenshot({
      path: resolve(directory, `author-document-${documentCase.name}-${device}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    })
  })
}

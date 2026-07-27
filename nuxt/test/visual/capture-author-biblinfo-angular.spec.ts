import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

import { angularBibliographyXml } from "../fixtures/bibliography-data.mjs"
import { strindbergAuthorProfile } from "../fixtures/author-profile-data.mjs"
import { waitForVisualAssets } from "../helpers/visual"
import { allowedAuthorShellStaticRequests } from "./angular-author-shell-static"

test.use({ serviceWorkers: "block" })

const authorityOrigin = "http://127.0.0.1:9000"
const bibliographyOrigin = "http://demolittb.spraakdata.gu.se"
const audioOrigin = "https://litteraturbanken.se"
const routePath = "/författare/StrindbergA/biblinfo"

function requestSignature(url: URL) {
  const query = [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  return query ? `${url.pathname}?${query}` : url.pathname
}

function legacyProfile() {
  const related = new Map(strindbergAuthorProfile.related_links.map(link => [link.label, link.url]))
  const encyclopedia = new Map(strindbergAuthorProfile.encyclopedia_links.map(link => [link.label, link.url]))
  return {
    authorid: strindbergAuthorProfile.author_id,
    authorid_norm: strindbergAuthorProfile.author_id,
    full_name: strindbergAuthorProfile.full_name,
    surname: strindbergAuthorProfile.surname,
    birth: { plain: strindbergAuthorProfile.birth_year },
    death: { plain: strindbergAuthorProfile.death_year },
    intro: strindbergAuthorProfile.introduction_html,
    intro_author: strindbergAuthorProfile.introduction_by?.author_id ?? null,
    sources: [...strindbergAuthorProfile.source_html],
    pseudonym: strindbergAuthorProfile.pseudonyms.map(person => ({
      authorid: person.author_id,
      full_name: person.full_name,
      surname: person.surname
    })),
    other_name: [...strindbergAuthorProfile.other_names],
    picture: true,
    pictureinfo: strindbergAuthorProfile.portrait?.caption_html ?? null,
    searchable: Boolean(strindbergAuthorProfile.search_url),
    presentation: related.has("Presentation"),
    bibliography: related.has("Bibliografi"),
    external_ref: strindbergAuthorProfile.related_links
      .filter(link => !["Presentation", "Bibliografi"].includes(link.label))
      .map(link => ({ label: link.label, url: link.url.replace(/^\//, "") })),
    wikidata: {
      sbl_link: new URL(encyclopedia.get("Svenskt biografiskt lexikon")!).searchParams.get("id"),
      wikipedia: encyclopedia.get("Wikipedia") ?? null
    },
    dramawebben: {
      intro: strindbergAuthorProfile.dramawebben?.introduction_html ?? null,
      intro_author: strindbergAuthorProfile.dramawebben?.introduction_by?.author_id ?? null,
      sources: [...(strindbergAuthorProfile.dramawebben?.source_html ?? [])],
      picture: Boolean(strindbergAuthorProfile.dramawebben?.portrait),
      picture_info: strindbergAuthorProfile.dramawebben?.portrait?.caption_html ?? null
    }
  }
}

test("captures the Angular bibliography authority inside the author shell", async ({ page }, testInfo) => {
  expect(testInfo.project.use.baseURL).toBe(authorityOrigin)
  const profile = legacyProfile()
  const expectedShellDocument = new URL(routePath, authorityOrigin)
  const profileRequests: string[] = []
  const bibliographyRequests: string[] = []
  const legacyDocumentRequests: string[] = []
  const shellRequests: string[] = []
  const unexpectedRequests: string[] = []
  const productionRequests: string[] = []
  const problems: string[] = []
  const [authorityFonts, ordinaryBackground, dramawebbenBackground, portrait] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../../../app/styles/fonts/601526/32FBEBA806C948833.css")),
    readFile(resolve(import.meta.dirname, "../../../app/img/forf2_bkg.jpg")),
    readFile(resolve(import.meta.dirname, "../../../app/img/dramawebben_fade_more.jpg")),
    readFile(resolve(import.meta.dirname, "../../app/assets/img/lagerlof_portrait.jpg"))
  ])

  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`))
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })

  await page.route("**/*", route => {
    const request = route.request()
    const url = new URL(request.url())
    const label = `${request.method()} ${request.url()}`
    const signature = requestSignature(url)
    if (request.method() === "GET" && url.origin === bibliographyOrigin
      && url.pathname === "/sla-bibliografi/"
      && JSON.stringify([...url.searchParams.entries()]) === JSON.stringify([["username", "app"]])) {
      bibliographyRequests.push(signature)
      return route.fulfill({ status: 200, contentType: "application/xml; charset=utf-8", body: angularBibliographyXml })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin
      && decodeURIComponent(url.pathname) === `/api/get_author/${profile.authorid}` && !url.search) {
      profileRequests.push(signature)
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: profile }) })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin
      && url.pathname === "/red/forfattare/StrindbergA/biblinfo/index.html" && !url.search) {
      legacyDocumentRequests.push(url.pathname)
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<html><body></body></html>" })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin && url.pathname === "/api/get_authors") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{
        authorid: strindbergAuthorProfile.introduction_by?.author_id,
        full_name: strindbergAuthorProfile.introduction_by?.full_name,
        surname: strindbergAuthorProfile.introduction_by?.surname
      }] }) })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin
      && (url.pathname.startsWith("/api/list_all/") || url.pathname.startsWith("/api/list_parts_in_others_works/") || url.pathname === "/api/query/litteraturkartan")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], hits: 0 }) })
    }
    if (request.method() === "GET" && url.origin === audioOrigin && url.pathname === "/ljudochbild/wp-json/wp/v2/pages") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin
      && url.pathname === "/red/bilder/bakgrundsbilder/backgrounds.xml") {
      return route.fulfill({ status: 200, contentType: "application/xml", body: "<backgrounds />" })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin
      && ["forf2_bkg.jpg", "dramawebben_fade_more.jpg"].some(name => url.pathname.endsWith(name))) {
      return route.fulfill({ status: 200, contentType: "image/jpeg", body: url.pathname.endsWith("dramawebben_fade_more.jpg") ? dramawebbenBackground : ordinaryBackground })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin && url.pathname === "/red/forfattare/StrindbergA/StrindbergA_large.jpeg") {
      return route.fulfill({ status: 200, contentType: "image/jpeg", body: portrait })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin && url.pathname === "/red/css/etext.css" && !url.search) {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" })
    }
    if (request.method() === "GET" && url.hostname === "cloud.typography.com" && url.pathname === "/7426274/770508/css/fonts.css" && !url.search) {
      return route.fulfill({ status: 200, contentType: "text/css", body: authorityFonts })
    }
    if (request.method() === "GET" && url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
      return route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
    }
    if (request.method() === "GET" && url.origin === authorityOrigin
      && (url.href === expectedShellDocument.href || allowedAuthorShellStaticRequests.has(`${url.pathname}${url.search}`))) {
      shellRequests.push(label)
      return route.continue()
    }
    if (url.origin !== authorityOrigin) {
      productionRequests.push(label)
      return route.abort("blockedbyclient")
    }
    unexpectedRequests.push(label)
    return route.abort("blockedbyclient")
  })

  const response = await page.goto(routePath, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect.poll(async () => ({
    bodyCount: await page.locator("body.focus.page-authorInfo.ready").count(),
    problems,
    productionRequests,
    unexpectedRequests
  }), { timeout: 45_000 }).toEqual({
    bodyCount: 1,
    problems: [],
    productionRequests: [],
    unexpectedRequests: []
  })
  await expect(page.locator("#mainview h1").first()).toHaveText("August Strindberg  (1849-1912)")
  expect(await page.locator("author-info-page").evaluate(element =>
    window.angular.element(element).isolateScope().showpage
  )).toBe("biblinfo")
  await expect(page.locator(".page_content h1")).toHaveText("Bibliografisk databas")
  await expect(page.locator(".results")).toContainText("Gösta Berlings saga")
  await expect(page.locator("#toolkit-biblinfo .num_hits.ng-binding")).toHaveText("3 träffar")
  await expect(page.locator("#toolkit-biblinfo .num_hits", { hasText: "Inga träffar" })).toBeHidden()
  await waitForVisualAssets(page)
  expect(await page.evaluate(() => document.fonts.status)).toBe("loaded")

  expect(profileRequests).toEqual([`/api/get_author/${profile.authorid}`])
  expect(bibliographyRequests).toEqual(["/sla-bibliografi/?username=app"])
  expect(legacyDocumentRequests).toEqual(["/red/forfattare/StrindbergA/biblinfo/index.html"])
  const shellUrls = shellRequests.map(label => new URL(label.replace(/^GET /, "")))
  expect(shellUrls.filter(url => url.href === expectedShellDocument.href)).toHaveLength(1)
  expect(shellUrls.filter(url => allowedAuthorShellStaticRequests.has(`${url.pathname}${url.search}`))
    .map(url => `${url.pathname}${url.search}`).sort()).toEqual([...allowedAuthorShellStaticRequests].sort())
  expect(shellRequests).toHaveLength(allowedAuthorShellStaticRequests.size + 1)
  expect(unexpectedRequests).toEqual([])
  expect(productionRequests).toEqual([])
  expect(problems).toEqual([])

  const directory = resolve(import.meta.dirname, "baselines")
  await mkdir(directory, { recursive: true })
  const device = testInfo.project.name === "angular-mobile" ? "mobile" : "desktop"
  await page.screenshot({
    path: resolve(directory, `author-biblinfo-${device}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  })
})
